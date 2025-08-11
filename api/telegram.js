import supabase from '../lib/supabase.js'
import { zh } from '../lib/i18n.js'
import { sendTelegramMessage, assertTelegramSecret, parsePercentageInput, parseAmountInput } from '../lib/helpers.js'
import { getOrCreateUserByTelegram, getState, setState, clearState } from '../lib/state.js'

const GROUP_CATEGORIES = {
  A: [
    ['food', '餐饮'], ['ent', '娱乐'], ['shop', '购物'], ['transport', '交通'], ['utilities', '水电'], ['mobile', '手机'], ['household', '家用'], ['other', '其他']
  ],
  B: [
    ['books', '书籍'], ['course', '课程'], ['training', '培训'], ['cert', '认证']
  ],
  C: [
    ['stock', '股票'], ['fd', '定存'], ['insurance', '保险'], ['emerg', '紧急基金'], ['other', '其他']
  ]
}

function groupKeyboard() {
  return { inline_keyboard: [[
    { text: 'A 开销', callback_data: 'rec:grp:A' },
    { text: 'B 学习', callback_data: 'rec:grp:B' },
    { text: 'C 储蓄', callback_data: 'rec:grp:C' }
  ]] }
}

function categoryKeyboard(group) {
  const items = GROUP_CATEGORIES[group] || []
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    const row = []
    for (let j = i; j < Math.min(i + 2, items.length); j++) {
      const [code, label] = items[j]
      row.push({ text: label, callback_data: `rec:cat:${code}` })
    }
    rows.push(row)
  }
  return { inline_keyboard: rows }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!assertTelegramSecret(req.headers)) {
    console.error('Bad secret', { expected: !!process.env.TELEGRAM_WEBHOOK_SECRET, got: req.headers['x-telegram-bot-api-secret-token'] || req.headers['X-Telegram-Bot-Api-Secret-Token'] })
    return res.status(401).json({ error: zh.bad_secret })
  }

  try {
    const update = req.body
    // Route callback queries to handler
    if (update && update.callback_query) {
      return handleCallback(update, req, res)
    }
    const msg = update.message || update.edited_message || update.callback_query?.message
    if (!msg) return res.status(200).json({ ok: true })

    const chatId = msg.chat.id
    const from = msg.from
    const text = (msg.text || '').trim()

    if (text.startsWith('/start')) {
      // Ensure user exists
      const { data: u, error: uErr } = await supabase
        .from('users')
        .select('id, branch_code')
        .eq('telegram_id', from.id)
        .maybeSingle()
      if (uErr) throw uErr
      let userId = u?.id
      if (!userId) {
        const { data: newU, error: insUErr } = await supabase
          .from('users')
          .insert([{ telegram_id: from.id, name: from.first_name || from.username || 'user', branch_code: process.env.DEFAULT_BRANCH || 'MAIN' }])
          .select('id')
          .single()
        if (insUErr) throw insUErr
        userId = newU.id
        const { error: insProfErr } = await supabase
          .from('user_profile')
          .insert([{ user_id: userId, display_name: from.first_name || from.username || 'user', chat_id: chatId }])
        if (insProfErr) throw insProfErr
      } else {
        await supabase.from('user_profile').upsert({ user_id: userId, display_name: from.first_name || from.username || 'user', chat_id: chatId })
      }

      await sendTelegramMessage(chatId, `${zh.hello}\n\n${zh.start_hint}`)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/record')) {
      const userId = await getOrCreateUserByTelegram(from, chatId)
      await setState(userId, 'record', 'choose_group', {})
      await sendTelegramMessage(chatId, '请选择分组（A/B/C）', { reply_markup: groupKeyboard() })
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/my')) {
      const range = (text.split(/\s+/)[1] || 'month').toLowerCase()
      const { data: u, error: uErr } = await supabase.from('users').select('id').eq('telegram_id', from.id).single()
      if (uErr) { await sendTelegramMessage(chatId, '请先 /start'); return res.status(200).json({ ok: true }) }
      const url = new URL(req.headers['x-forwarded-url'] || `https://${req.headers.host}${req.url}`)
      const base = `${url.protocol}//${url.host}`
      const r = await fetch(`${base}/api/my?userId=${u.id}&range=${encodeURIComponent(range)}`)
      const data = await r.json()
      if (!r.ok) { await sendTelegramMessage(chatId, '查询失败'); return res.status(200).json({ ok: true }) }
      const a = data.progress?.a ?? 0
      const b = data.progress?.b ?? 0
      const c = data.progress?.c ?? 0
      await sendTelegramMessage(chatId, `📊 ${range} 统计\nA=${data.totals.a.toFixed(2)} B=${data.totals.b.toFixed(2)} C=${data.totals.c.toFixed(2)}\n🎯 进度：A ${a}%｜B ${b}%｜C ${c}%（含 EPF）`)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/broadcast')) {
      const admins = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      if (!admins.includes(String(from.id))) {
        await sendTelegramMessage(chatId, '无权限')
        return res.status(200).json({ ok: true })
      }
      const content = text.replace('/broadcast', '').trim()
      if (!content) { await sendTelegramMessage(chatId, '用法：/broadcast 文本'); return res.status(200).json({ ok: true }) }
      const { data: profs } = await supabase.from('user_profile').select('chat_id').not('chat_id', 'is', null)
      const chatIds = (profs || []).map(p => p.chat_id)
      let sent = 0
      for (const cid of chatIds) {
        try { await sendTelegramMessage(cid, content) } catch {}
        sent += 1
        if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1100))
      }
      await sendTelegramMessage(chatId, `已发送：${sent}`)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('收入') || text.includes('A%') || text.includes('B%')) {
      // 简化输入解析：收入 X；A% Y；B% Z；旅游年额 T；上月开销 P；分行 CODE
      const kvs = {}
      const segs = text.split(/[；;\n]/)
      for (const s of segs) {
        const [k, v] = s.split(/[:：\s]+/)
        if (!k || !v) continue
        kvs[k.trim()] = v.trim()
      }
      const income = parseAmountInput(kvs['收入']) ?? 0
      const aPct = parsePercentageInput(kvs['A%']) ?? 0
      const bPct = parsePercentageInput(kvs['B%']) ?? 0
      const travel = parseAmountInput(kvs['旅游年额']) ?? 0
      const prev = parseAmountInput(kvs['上月开销']) ?? 0
      const branch = (kvs['分行'] || process.env.DEFAULT_BRANCH || 'MAIN').toUpperCase()

      const { data: u, error: uErr } = await supabase.from('users').select('id').eq('telegram_id', from.id).maybeSingle()
      if (uErr) throw uErr
      let userId = u?.id
      if (!userId) {
        const { data: newU, error: insUErr } = await supabase
          .from('users')
          .insert([{ telegram_id: from.id, name: from.first_name || from.username || 'user', branch_code: branch }])
          .select('id')
          .single()
        if (insUErr) throw insUErr
        userId = newU.id
      } else {
        await supabase.from('users').update({ branch_code: branch }).eq('id', userId)
      }
      await supabase.from('user_profile').upsert({
        user_id: userId,
        display_name: from.first_name || from.username || 'user',
        chat_id: chatId,
        monthly_income: income,
        a_pct: aPct,
        b_pct: bPct,
        travel_budget_annual: travel,
        prev_month_spend: prev
      })

      // 写当月快照
      const yyyymm = new Date().toISOString().slice(0,7)
      await supabase.from('user_month_budget').upsert({ user_id: userId, yyyymm, income, a_pct: aPct, b_pct: bPct })
      await sendTelegramMessage(chatId, zh.start_saved)
      return res.status(200).json({ ok: true })
    }

    // If user is in state flow=record, handle steps for amount/note
    const userIdForState = await getOrCreateUserByTelegram(from, chatId)
    const st = await getState(userIdForState)
    if (st?.flow === 'record') {
      if (st.step === 'amount') {
        const amt = parseAmountInput(text)
        if (amt == null) { await sendTelegramMessage(chatId, '请输入合法金额（0-1,000,000，最多两位小数）'); return res.status(200).json({ ok: true }) }
        const payload = { ...st.payload, amount: amt }
        await setState(userIdForState, 'record', 'note', payload)
        await sendTelegramMessage(chatId, '请输入备注（可直接发送 /skip 跳过）')
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'note') {
        const note = text === '/skip' ? '' : text.slice(0, 200)
        const payload = { ...st.payload, note }
        await setState(userIdForState, 'record', 'confirm', payload)
        const preview = `请确认：\n组别：${payload.group}\n分类：${payload.category}\n金额：${payload.amount.toFixed(2)}\n备注：${note || '—'}`
        await sendTelegramMessage(chatId, preview, { reply_markup: { inline_keyboard: [[{ text: '✅ 确认', callback_data: 'rec:confirm' }, { text: '❌ 取消', callback_data: 'rec:cancel' }]] } })
        return res.status(200).json({ ok: true })
      }
    }

    // fallback
    await sendTelegramMessage(chatId, '可用命令：/start /record /my')
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(200).json({ ok: true })
  }
}

// Handle callback queries (inline keyboard)
export async function handleCallback(update, req, res) {
  try {
    const cq = update.callback_query
    if (!cq) return res.status(200).json({ ok: true })
    const chatId = cq.message.chat.id
    const from = cq.from
    const data = cq.data || ''
    const userId = await getOrCreateUserByTelegram(from, chatId)
    const st = await getState(userId)
    if (!st || st.flow !== 'record') {
      await sendTelegramMessage(chatId, '请发送 /record 开始记录')
      return res.status(200).json({ ok: true })
    }
    if (data.startsWith('rec:grp:')) {
      const grp = data.split(':').pop()
      await setState(userId, 'record', 'choose_category', { group: grp })
      await sendTelegramMessage(chatId, `已选择 ${grp}，请选择分类：`, { reply_markup: categoryKeyboard(grp) })
      return res.status(200).json({ ok: true })
    }
    if (data.startsWith('rec:cat:')) {
      const cat = data.split(':').pop()
      const payload = { ...(st.payload || {}), category: cat, group: (st.payload||{}).group }
      await setState(userId, 'record', 'amount', payload)
      await sendTelegramMessage(chatId, '请输入金额（两位小数，可整数）')
      return res.status(200).json({ ok: true })
    }
    if (data === 'rec:confirm') {
      if (st.step !== 'confirm') { await sendTelegramMessage(chatId, '状态已过期，请重新 /record'); await clearState(userId); return res.status(200).json({ ok: true }) }
      const payload = st.payload || {}
      // 调用后端 /api/record 执行入库 + 聚合 + streak
      const url = new URL(req.headers['x-forwarded-url'] || `https://${req.headers.host}${req.url}`)
      const base = `${url.protocol}//${url.host}`
      const resp = await fetch(`${base}/api/record`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userId, category_group: payload.group, category_code: payload.category, amount: payload.amount, note: payload.note || '', ymd: new Date().toISOString().slice(0,10) })
      })
      if (!resp.ok) { await sendTelegramMessage(chatId, '写入失败，请重试'); return res.status(200).json({ ok: true }) }
      await clearState(userId)
      await sendTelegramMessage(chatId, `✅ 已记录：${payload.group} ${Number(payload.amount).toFixed(2)}`)
      return res.status(200).json({ ok: true })
    }
    if (data === 'rec:cancel') {
      await clearState(userId)
      await sendTelegramMessage(chatId, '已取消。')
      return res.status(200).json({ ok: true })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(200).json({ ok: true })
  }
}

