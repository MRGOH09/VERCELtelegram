import supabase from '../../lib/supabase.js'
import { format } from 'date-fns'
import { sendTelegramMessage, sendTelegramMessages } from '../../lib/helpers.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'

function inTZ(date) {
  const offset = parseInt(process.env.APP_TZ_OFFSET_MINUTES || '480', 10) // default UTC+8
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + offset * 60000)
}

async function computeLeaderboards(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  // top 15 by total amount today
  const { data: rows } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .eq('ymd', ymd)
  const totals = (rows || []).map(r => ({ user_id: r.user_id, total: Number(r.sum_a||0) + Number(r.sum_b||0) + Number(r.sum_c||0) }))
  totals.sort((a,b) => b.total - a.total)
  const top = totals.slice(0, 15)

  // branch top by completion rate
  const { data: br } = await supabase.from('branch_daily').select('branch_code,done,total,rate').eq('ymd', ymd)
  const branchTop = (br || []).sort((a,b) => (b.rate||0) - (a.rate||0)).slice(0, 10)

  await supabase.from('leaderboard_daily').upsert({ ymd, top_json: top, branch_top_json: branchTop })
}

async function breakStreaksIfMissed(forDate) {
  // If a user current_streak>0 and last_record < yesterday, set to 0
  const d = new Date(forDate)
  d.setDate(d.getDate() - 1)
  const yesterday = format(d, 'yyyy-MM-dd')
  // naive approach: select users where last_record < yesterday
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,current_streak,last_record')
  for (const p of profs || []) {
    if ((p.current_streak || 0) > 0 && p.last_record && p.last_record < yesterday) {
      await supabase.from('user_profile').update({ current_streak: 0 }).eq('user_id', p.user_id)
    }
  }
}

async function pushBranchLeaderboards(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: lb } = await supabase
    .from('leaderboard_daily')
    .select('branch_top_json')
    .eq('ymd', ymd)
    .maybeSingle()
  const branchTop = lb?.branch_top_json || []
  const { data: leads } = await supabase.from('branch_leads').select('branch_code,leader_chat_ids')
  const map = new Map()
  for (const b of branchTop) map.set(b.branch_code || b.branch || b.code, b)
  for (const row of leads || []) {
    const stat = map.get(row.branch_code)
    if (!stat) continue
    const text = formatTemplate(zh.cron.branch_lead, { code: row.branch_code, rate: stat.rate || 0, done: stat.done || 0, total: stat.total || 0 })
    for (const chatId of row.leader_chat_ids || []) {
      await sendTelegramMessage(chatId, text)
    }
  }
}

async function personalMorningReports(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  // Fetch top list and compute ranks
  const { data: rows } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .eq('ymd', ymd)
  const totals = (rows || []).map(r => ({ user_id: r.user_id, total: Number(r.sum_a||0) + Number(r.sum_b||0) + Number(r.sum_c||0) }))
  totals.sort((a,b) => b.total - a.total)
  const rankMap = new Map()
  totals.forEach((r, idx) => rankMap.set(r.user_id, idx + 1))

  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,chat_id')
  const chatMap = new Map((profs || []).filter(p => p.chat_id).map(p => [p.user_id, p.chat_id]))

  const topText = totals.slice(0, 15).map((r, i) => `${i+1}. ${r.total.toFixed(2)}`).join('\n') || '—'

  const chatIds = Array.from(chatMap.values())
  await sendTelegramMessages(chatIds, (chatId) => {
    // find userId by chatId
    const entry = Array.from(chatMap.entries()).find(([, c]) => c === chatId)
    const userId = entry?.[0]
    const myRank = userId ? (rankMap.get(userId) || '暂未上榜') : '—'
    return formatTemplate(zh.cron.morning_rank, { rank: myRank, top: topText })
  })
}

async function usersWithoutRecordToday(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: allUsers } = await supabase
    .from('user_profile')
    .select('user_id,chat_id')
  const { data: recs } = await supabase
    .from('records')
    .select('user_id')
    .eq('ymd', ymd)
    .eq('is_voided', false)
  const have = new Set((recs || []).map(r => r.user_id))
  return (allUsers || []).filter(u => u.chat_id && !have.has(u.user_id)).map(u => u.chat_id)
}

async function monthlySnapshotsIfNeeded(forDate) {
  const d = new Date(forDate)
  const hh = d.getHours(), mm = d.getMinutes()
  if (d.getDate() === 1) {
    const yyyymm = format(d, 'yyyy-MM')
    const { data: profs } = await supabase
      .from('user_profile')
      .select('user_id,monthly_income,a_pct,b_pct')
    for (const p of profs || []) {
      await supabase.from('user_month_budget').upsert({
        user_id: p.user_id, yyyymm, income: p.monthly_income || 0, a_pct: p.a_pct || 0, b_pct: p.b_pct || 0
      })
    }
  }
}

async function dailyReports(forDate) {
  const today = format(forDate, 'yyyy-MM-dd')
  const yyyyMM = format(forDate, 'yyyy-MM')
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,chat_id')
  const byChat = (profs || []).filter(p => p.chat_id)
  for (const p of byChat) {
    // totals today
    const { data: ds } = await supabase
      .from('daily_summary')
      .select('sum_a,sum_b,sum_c')
      .eq('user_id', p.user_id)
      .eq('ymd', today)
      .maybeSingle()
    const ta = Number(ds?.sum_a || 0), tb = Number(ds?.sum_b || 0), tc = Number(ds?.sum_c || 0)
    // snapshot + mtd
    const { data: snap } = await supabase
      .from('user_month_budget')
      .select('*')
      .eq('user_id', p.user_id)
      .eq('yyyymm', yyyyMM)
      .maybeSingle()
    const { data: mtd } = await supabase
      .from('daily_summary')
      .select('sum_a,sum_b,sum_c')
      .gte('ymd', `${yyyyMM}-01`)
      .lte('ymd', today)
      .eq('user_id', p.user_id)
    const m = (mtd || []).reduce((acc, r) => ({ a: acc.a + Number(r.sum_a||0), b: acc.b + Number(r.sum_b||0), c: acc.c + Number(r.sum_c||0) }), { a:0,b:0,c:0 })
    const pa = snap?.cap_a_amount > 0 ? Math.min(100, Math.round((m.a / snap.cap_a_amount) * 100)) : 0
    const pb = snap?.cap_b_amount > 0 ? Math.min(100, Math.round((m.b / snap.cap_b_amount) * 100)) : 0
    const pc = snap?.cap_c_amount > 0 ? Math.min(100, Math.round(((m.c + (snap?.epf_amount||0)) / snap.cap_c_amount) * 100)) : 0
    // 旅游预算(月) = user_profile.travel_budget_annual / 12（仅提示，不计入账）
    const { data: prof } = await supabase
      .from('user_profile')
      .select('travel_budget_annual')
      .eq('user_id', p.user_id)
      .maybeSingle()
    const travelMonthly = prof ? Number((prof.travel_budget_annual || 0) / 12).toFixed(2) : '0.00'
    const text = formatTemplate(zh.cron.daily_report, { a: ta.toFixed(2), b: tb.toFixed(2), c: tc.toFixed(2), pa, pb, pc, travel: travelMonthly })
    await sendTelegramMessage(p.chat_id, text)
  }
}

export default async function handler(req, res) {
  try {
    const now = new Date()
    const local = inTZ(now)
    const hhmm = `${local.getHours().toString().padStart(2,'0')}:${local.getMinutes().toString().padStart(2,'0')}`

    if (hhmm === '03:00') {
      await breakStreaksIfMissed(local)
    }
    if (hhmm === '10:00') {
      await computeLeaderboards(local)
      await pushBranchLeaderboards(local)
      await personalMorningReports(local)
    }
    if (hhmm === '20:00') {
      const chats = await usersWithoutRecordToday(local)
      await sendTelegramMessages(chats, zh.cron.reminder)
    }
    if (hhmm === '20:30') {
      await dailyReports(local)
    }
    await monthlySnapshotsIfNeeded(local)

    return res.status(200).json({ ok: true, hhmm })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'cron failed', detail: String(e.message || e) })
  }
}

