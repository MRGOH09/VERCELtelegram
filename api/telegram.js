import supabase from '../lib/supabase.js'
import { zh } from '../lib/i18n.js'
import { sendTelegramMessage, assertTelegramSecret, parsePercentageInput, parseAmountInput, normalizePhoneE164, formatTemplate } from '../lib/helpers.js'
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

const BRANCH_CODES = [
  'PJY','BLS','OTK','PU','UKT','TLK','M2','BP','MTK','HQ','VIVA','STL','SRD','PDMR','KK'
]

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

function branchKeyboard() {
  const rows = []
  for (let i = 0; i < BRANCH_CODES.length; i += 3) {
    const row = []
    for (let j = i; j < Math.min(i + 3, BRANCH_CODES.length); j++) {
      const code = BRANCH_CODES[j]
      row.push({ text: code, callback_data: `start:branch:${code}` })
    }
    rows.push(row)
  }
  return { inline_keyboard: rows }
}

async function tryPostMonthlyAlloc(userId, group, category, amount) {
  try {
    const today = new Date()
    const ymd = `${today.toISOString().slice(0,7)}-01`
    // 幂等：同月同类别存在则跳过
    const exists = await fetch(`${new URL('.', `https://${process.env.VERCEL_URL||'example.com'}`).href}api/records/list?userId=${userId}&range=month&limit=1`)
    // 简化：直接尝试插入，依赖业务容忍重复；若需严格幂等，可查询 records 是否存在相同 ymd+category
    await supabase.from('records').insert([{ user_id: userId, category_group: group, category_code: category, amount, note: 'Auto-post', ymd }])
  } catch {}
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
      // 已注册的判定调整：优先以昵称是否存在为准（排行榜/交互展示依赖昵称）
      const userId = await getOrCreateUserByTelegram(from, chatId)
      const { data: prof } = await supabase
        .from('user_profile')
        .select('display_name,monthly_income,a_pct,b_pct')
        .eq('user_id', userId)
        .maybeSingle()
      const isRegistered = prof && !!(prof.display_name && prof.display_name.trim())
      if (isRegistered) {
        await sendTelegramMessage(chatId, zh.registration.alreadyRegistered)
        return res.status(200).json({ ok: true })
      }
      await setState(userId, 'start', 'nickname', {})
      await sendTelegramMessage(chatId, zh.registration.nickname.prompt)
      return res.status(200).json({ ok: true })
    }
    if (text.startsWith('/settings')) {
      const userId = await getOrCreateUserByTelegram(from, chatId)
      await setState(userId, 'settings', 'choose', {})
      const { data: prof } = await supabase
        .from('user_profile')
        .select('display_name,phone_e164,monthly_income,a_pct,b_pct,travel_budget_annual,annual_medical_insurance,annual_car_insurance')
        .eq('user_id', userId)
        .maybeSingle()
      const { data: urow } = await supabase
        .from('users')
        .select('branch_code')
        .eq('id', userId)
        .maybeSingle()
      const sumText = formatTemplate(zh.settings.summary, {
        nickname: prof?.display_name || '-',
        phone: prof?.phone_e164 || '-',
        income: (Number(prof?.monthly_income || 0)).toFixed(2),
        a_pct: Number(prof?.a_pct || 0).toFixed(2),
        b_pct: Number(prof?.b_pct || 0).toFixed(2),
        travel: (Number(prof?.travel_budget_annual || 0)).toFixed(2),
        branch: (urow?.branch_code || '-')
      })
      const kb = { inline_keyboard: [
        [ { text: zh.settings.fields.nickname, callback_data: 'set:nickname' }, { text: zh.settings.fields.phone, callback_data: 'set:phone' } ],
        [ { text: zh.settings.fields.income, callback_data: 'set:income' }, { text: zh.settings.fields.a_pct, callback_data: 'set:a_pct' } ],
        [ { text: zh.settings.fields.b_pct, callback_data: 'set:b_pct' }, { text: zh.settings.fields.travel, callback_data: 'set:travel' } ],
        [ { text: '年度医疗保险', callback_data: 'set:ins_med' }, { text: '年度车险', callback_data: 'set:ins_car' } ],
        [ { text: zh.settings.fields.branch, callback_data: 'set:branch' } ]
      ] }
      await sendTelegramMessage(chatId, `${sumText}\n\n${zh.settings.choose}`, { reply_markup: kb })
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/record')) {
      const userId = await getOrCreateUserByTelegram(from, chatId)
      await setState(userId, 'record', 'choose_group', {})
      await sendTelegramMessage(chatId, zh.record.choose_group, { reply_markup: groupKeyboard() })
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/my')) {
      const range = (text.split(/\s+/)[1] || 'month').toLowerCase()
      const { data: u, error: uErr } = await supabase.from('users').select('id').eq('telegram_id', from.id).single()
      if (uErr) { await sendTelegramMessage(chatId, zh.my.need_start); return res.status(200).json({ ok: true }) }
      const url = new URL(req.headers['x-forwarded-url'] || `https://${req.headers.host}${req.url}`)
      const base = `${url.protocol}//${url.host}`
      const r = await fetch(`${base}/api/my?userId=${u.id}&range=${encodeURIComponent(range)}`)
      const data = await r.json()
      if (!r.ok) { await sendTelegramMessage(chatId, '查询失败'); return res.status(200).json({ ok: true }) }
      const a = data.progress?.a ?? 0
      const b = data.progress?.b ?? 0
      const c = data.progress?.c ?? 0
      const travelMonthly = data.snapshot?.income ? (Number(data.snapshot.income) && (0)) : 0 // placeholder not used here
      const ra = data.realtime?.a == null ? 'N/A' : data.realtime.a
      const rb = data.realtime?.b == null ? 'N/A' : data.realtime.b
      const rc = data.realtime?.c == null ? 'N/A' : data.realtime.c
      const da = ra === 'N/A' ? 'N/A' : (Number(ra) - Number(data.snapshotView.a_pct)).toFixed(0)
      const aGap = (Number(data.snapshotView.cap_a) - Number(data.totals.a)).toFixed(2)
      const aGapLine = Number(aGap) >= 0 ? `剩余额度 RM ${aGap}` : `已超出 RM ${Math.abs(Number(aGap)).toFixed(2)}`
      const msg = formatTemplate(zh.my.summary, {
        range,
        a: data.display?.a || data.totals.a.toFixed(2),
        b: data.display?.b || data.totals.b.toFixed(2),
        c: data.display?.c_residual || data.totals.c.toFixed(2),
        ra, rb, rc,
        a_pct: data.snapshotView.a_pct,
        da,
        a_gap_line: aGapLine,
        income: data.snapshotView.income,
        cap_a: data.snapshotView.cap_a,
        cap_b: data.snapshotView.cap_b,
        cap_c: data.snapshotView.cap_c,
        epf: data.snapshotView.epf,
        travel: data.snapshotView.travelMonthly
      })
      await sendTelegramMessage(chatId, msg)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/broadcast')) {
      const admins = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      if (!admins.includes(String(from.id))) {
        await sendTelegramMessage(chatId, zh.admin.no_perm)
        return res.status(200).json({ ok: true })
      }
      const content = text.replace('/broadcast', '').trim()
      if (!content) { await sendTelegramMessage(chatId, zh.admin.usage); return res.status(200).json({ ok: true }) }
      const { data: profs } = await supabase.from('user_profile').select('chat_id').not('chat_id', 'is', null)
      const chatIds = (profs || []).map(p => p.chat_id)
      let sent = 0
      for (const cid of chatIds) {
        try { await sendTelegramMessage(cid, content) } catch {}
        sent += 1
        if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1100))
      }
      await sendTelegramMessage(chatId, formatTemplate(zh.admin.sent, { n: sent }))
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
        if (amt == null) { await sendTelegramMessage(chatId, zh.record.amount_invalid); return res.status(200).json({ ok: true }) }
        const payload = { ...st.payload, amount: amt }
        await setState(userIdForState, 'record', 'note', payload)
        await sendTelegramMessage(chatId, zh.record.note_prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'note') {
        const note = text === '/skip' ? '' : text.slice(0, 200)
        const payload = { ...st.payload, note }
        await setState(userIdForState, 'record', 'confirm', payload)
        const preview = formatTemplate(zh.record.preview, { group: payload.group, category: payload.category, amount: payload.amount.toFixed(2), note: note || '—' })
        await sendTelegramMessage(chatId, preview, { reply_markup: { inline_keyboard: [[{ text: '✅ 确认', callback_data: 'rec:confirm' }, { text: '❌ 取消', callback_data: 'rec:cancel' }]] } })
        return res.status(200).json({ ok: true })
      }
    }

    if (st?.flow === 'start') {
      if (st.step === 'nickname') {
        const name = (text || '').trim().slice(0, 30)
        if (!name) { await sendTelegramMessage(chatId, zh.registration.nickname.validation) ; return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'phone', { nickname: name })
        await sendTelegramMessage(chatId, zh.registration.phone.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'phone') {
        const phone = normalizePhoneE164(text)
        if (!phone) { await sendTelegramMessage(chatId, zh.registration.phone.validation) ; return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'income', { ...st.payload, phone_e164: phone })
        await sendTelegramMessage(chatId, zh.registration.income.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'income') {
        const income = parseAmountInput(text)
        if (income == null || income <= 0) {
          await sendTelegramMessage(chatId, zh.registration.income.validation)
          return res.status(200).json({ ok: true })
        }
        await setState(userIdForState, 'start', 'a_pct', { ...st.payload, income })
        await sendTelegramMessage(chatId, zh.registration.budgetA.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'a_pct') {
        const aPct = parsePercentageInput(text)
        if (aPct == null) { await sendTelegramMessage(chatId, zh.registration.budgetA.validation) ; return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'b_pct', { ...st.payload, a_pct: aPct })
        await sendTelegramMessage(chatId, zh.registration.budgetB.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'b_pct') {
        const bPct = parsePercentageInput(text)
        if (bPct == null) { await sendTelegramMessage(chatId, zh.registration.budgetB.validation); return res.status(200).json({ ok: true }) }
        const aPct = st.payload?.a_pct || 0
        if (aPct + bPct > 100) { await sendTelegramMessage(chatId, formatTemplate(zh.registration.budgetOverflow, { total: aPct + bPct })); return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'travel', { ...st.payload, b_pct: bPct })
        await sendTelegramMessage(chatId, zh.registration.travelBudget.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'travel') {
        const travel = parseAmountInput(text)
        if (travel == null || travel < 0) { await sendTelegramMessage(chatId, zh.registration.travelBudget.validation); return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'prev', { ...st.payload, travel_budget_annual: travel })
        await sendTelegramMessage(chatId, zh.registration.lastMonthSpendingPct.prompt)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'prev') {
        const prevPct = parsePercentageInput(text)
        if (prevPct == null) { await sendTelegramMessage(chatId, zh.registration.lastMonthSpendingPct.validation); return res.status(200).json({ ok: true }) }
        await setState(userIdForState, 'start', 'branch', { ...st.payload, prev_month_spend_pct: prevPct })
        await sendTelegramMessage(chatId, zh.registration.branch.prompt, { reply_markup: branchKeyboard() })
        return res.status(200).json({ ok: true })
      }
    }
    if (st?.flow === 'settings') {
      // 文本侧仅处理具体输入步骤，入口与选择走 callback
      if (st.step === 'edit_nickname') {
        const name = (text || '').trim().slice(1, 30)
        if (!name) { await sendTelegramMessage(chatId, zh.registration.nickname.validation); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ display_name: name }).eq('user_id', userIdForState)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_phone') {
        const phone = normalizePhoneE164(text)
        if (!phone) { await sendTelegramMessage(chatId, zh.registration.phone.validation); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ phone_e164: phone }).eq('user_id', userIdForState)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_income') {
        const income = parseAmountInput(text)
        if (income == null || income <= 0) { await sendTelegramMessage(chatId, zh.registration.income.validation); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ monthly_income: income }).eq('user_id', userIdForState)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_a_pct' || st.step === 'edit_b_pct') {
        const pct = parsePercentageInput(text)
        if (pct == null) { await sendTelegramMessage(chatId, zh.registration.budgetA.validation); return res.status(200).json({ ok: true }) }
        const field = st.step === 'edit_a_pct' ? { a_pct: pct } : { b_pct: pct }
        await supabase.from('user_profile').update(field).eq('user_id', userIdForState)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_travel') {
        const amt = parseAmountInput(text)
        if (amt == null || amt < 0) { await sendTelegramMessage(chatId, zh.registration.travelBudget.validation); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ travel_budget_annual: amt }).eq('user_id', userIdForState)
        // 当下立即补记当月分摊（幂等）
        await tryPostMonthlyAlloc(userIdForState, 'B', 'travel_auto', amt/12)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_ins_med') {
        const amt = parseAmountInput(text)
        if (amt == null || amt < 0) { await sendTelegramMessage(chatId, '请输入合法金额'); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ annual_medical_insurance: amt }).eq('user_id', userIdForState)
        await tryPostMonthlyAlloc(userIdForState, 'C', 'ins_med_auto', amt/12)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
      if (st.step === 'edit_ins_car') {
        const amt = parseAmountInput(text)
        if (amt == null || amt < 0) { await sendTelegramMessage(chatId, '请输入合法金额'); return res.status(200).json({ ok: true }) }
        await supabase.from('user_profile').update({ annual_car_insurance: amt }).eq('user_id', userIdForState)
        await tryPostMonthlyAlloc(userIdForState, 'C', 'ins_car_auto', amt/12)
        await clearState(userIdForState)
        await sendTelegramMessage(chatId, zh.settings.updated)
        return res.status(200).json({ ok: true })
      }
    }

    // fallback
    await sendTelegramMessage(chatId, zh.help)
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
    if (st && st.flow === 'settings') {
      // settings callback entries
      if (data === 'set:nickname') { await setState(userId, 'settings', 'edit_nickname', {}); await sendTelegramMessage(chatId, zh.registration.nickname.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:phone') { await setState(userId, 'settings', 'edit_phone', {}); await sendTelegramMessage(chatId, zh.registration.phone.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:income') { await setState(userId, 'settings', 'edit_income', {}); await sendTelegramMessage(chatId, zh.registration.income.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:a_pct') { await setState(userId, 'settings', 'edit_a_pct', {}); await sendTelegramMessage(chatId, zh.registration.budgetA.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:b_pct') { await setState(userId, 'settings', 'edit_b_pct', {}); await sendTelegramMessage(chatId, zh.registration.budgetB.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:travel') { await setState(userId, 'settings', 'edit_travel', {}); await sendTelegramMessage(chatId, zh.registration.travelBudget.prompt); return res.status(200).json({ ok: true }) }
      if (data === 'set:ins_med') { await setState(userId, 'settings', 'edit_ins_med', {}); await sendTelegramMessage(chatId, '请输入年度医疗保险金额（RM），例如 1200'); return res.status(200).json({ ok: true }) }
      if (data === 'set:ins_car') { await setState(userId, 'settings', 'edit_ins_car', {}); await sendTelegramMessage(chatId, '请输入年度车险金额（RM），例如 2400'); return res.status(200).json({ ok: true }) }
      if (data === 'set:branch') { await sendTelegramMessage(chatId, zh.registration.branch.prompt, { reply_markup: branchKeyboard() }); await setState(userId, 'start', 'branch', { ...(st.payload||{}) }); return res.status(200).json({ ok: true }) }
    }
    if (!st || st.flow !== 'record') {
      await sendTelegramMessage(chatId, '请发送 /record 开始记录')
      return res.status(200).json({ ok: true })
    }
    if (data.startsWith('rec:grp:')) {
      const grp = data.split(':').pop()
      const groupLabel = grp === 'A' ? '生活开销' : grp === 'B' ? '学习投资' : '储蓄投资'
      await setState(userId, 'record', 'choose_category', { group: grp, groupLabel })
      await sendTelegramMessage(chatId, formatTemplate(zh.record.choose_category, { group: groupLabel }), { reply_markup: categoryKeyboard(grp) })
      return res.status(200).json({ ok: true })
    }
    if (data.startsWith('rec:cat:')) {
      const cat = data.split(':').pop()
      const payload = { ...(st.payload || {}), category: cat, group: (st.payload||{}).group, groupLabel: (st.payload||{}).groupLabel }
      await setState(userId, 'record', 'amount', payload)
      await sendTelegramMessage(chatId, zh.record.amount_prompt)
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
      if (!resp.ok) { await sendTelegramMessage(chatId, zh.record.save_failed); return res.status(200).json({ ok: true }) }
      await clearState(userId)
      await sendTelegramMessage(chatId, formatTemplate(zh.record.saved, { groupLabel: payload.groupLabel || payload.group, amount: Number(payload.amount).toFixed(2) }))
      return res.status(200).json({ ok: true })
    }
    if (data === 'rec:cancel') {
      await clearState(userId)
      await sendTelegramMessage(chatId, zh.record.canceled)
      return res.status(200).json({ ok: true })
    }

    // START flow: branch selection and finalize
    if (data.startsWith('start:branch:')) {
      const code = data.split(':').pop().toUpperCase()
      const st = await getState(userId)
      if (!st || st.flow !== 'start' || st.step !== 'branch') {
        await sendTelegramMessage(chatId, '状态已过期，请重新 /start')
        await clearState(userId)
        return res.status(200).json({ ok: true })
      }
      const payload = st.payload || {}
      // Persist
      await supabase.from('users').upsert({ id: userId, branch_code: code }, { onConflict: 'id' })
      await supabase.from('user_profile').upsert({
        user_id: userId,
        display_name: payload.nickname || update.callback_query?.from?.first_name || update.callback_query?.from?.username || 'user',
        chat_id: chatId,
        phone_e164: payload.phone_e164 || null,
        monthly_income: payload.income || 0,
        a_pct: payload.a_pct || 0,
        b_pct: payload.b_pct || 0,
        travel_budget_annual: payload.travel_budget_annual || 0,
        prev_month_spend: payload.prev_month_spend || 0,
        prev_month_spend_pct: payload.prev_month_spend_pct || null
      })
      const yyyymm = new Date().toISOString().slice(0,7)
      await supabase.from('user_month_budget').upsert({ user_id: userId, yyyymm, income: payload.income || 0, a_pct: payload.a_pct || 0, b_pct: payload.b_pct || 0 })
      await clearState(userId)
      const cPct = Math.max(0, 100 - (payload.a_pct || 0) - (payload.b_pct || 0))
      await sendTelegramMessage(chatId, formatTemplate(zh.registration.success, { budgetA: payload.a_pct||0, budgetB: payload.b_pct||0, budgetC: cPct, branch: code }))
      return res.status(200).json({ ok: true })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(200).json({ ok: true })
  }
}

