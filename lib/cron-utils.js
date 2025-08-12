import supabase from './supabase.js'
import { format } from 'date-fns'
import { sendBatchMessages } from './telegram.js'

export async function computeLeaderboards(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: rows } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .eq('ymd', ymd)
  const totals = (rows || []).map(r => ({ user_id: r.user_id, total: Number(r.sum_a||0) + Number(r.sum_b||0) + Number(r.sum_c||0) }))
  totals.sort((a,b) => b.total - a.total)
  const top = totals.slice(0, 15)

  const { data: br } = await supabase.from('branch_daily').select('branch_code,done,total,rate').eq('ymd', ymd)
  const branchTop = (br || []).sort((a,b) => (b.rate||0) - (a.rate||0)).slice(0, 10)

  await supabase.from('leaderboard_daily').upsert({ ymd, top_json: top, branch_top_json: branchTop })
  return { ymd, top, branchTop }
}

export async function usersWithoutRecordToday(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: allUsers } = await supabase.from('user_profile').select('user_id,chat_id')
  const { data: recs } = await supabase.from('records').select('user_id').eq('ymd', ymd).eq('is_voided', false)
  const have = new Set((recs || []).map(r => r.user_id))
  return (allUsers || []).filter(u => u.chat_id && !have.has(u.user_id)).map(u => u.chat_id)
}

export async function pushBranchLeaderboards(forDate, templateFn) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: lb } = await supabase.from('leaderboard_daily').select('branch_top_json').eq('ymd', ymd).maybeSingle()
  const branchTop = lb?.branch_top_json || []
  const { data: leads } = await supabase.from('branch_leads').select('branch_code,leader_chat_ids')
  const map = new Map(); for (const b of branchTop) map.set(b.branch_code || b.branch || b.code, b)
  const messages = []
  for (const row of leads || []) {
    const stat = map.get(row.branch_code); if (!stat) continue
    const text = templateFn(row.branch_code, stat)
    for (const cid of row.leader_chat_ids || []) messages.push({ chat_id: cid, text })
  }
  return await sendBatchMessages(messages)
}

export async function personalMorningReports(forDate, templateFn) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const { data: rows } = await supabase
    .from('daily_summary').select('user_id,sum_a,sum_b,sum_c').eq('ymd', ymd)
  const totals = (rows || []).map(r => ({ user_id: r.user_id, total: Number(r.sum_a||0) + Number(r.sum_b||0) + Number(r.sum_c||0) }))
  totals.sort((a,b) => b.total - a.total)
  const rankMap = new Map(); totals.forEach((r, i) => rankMap.set(r.user_id, i+1))
  const { data: profs } = await supabase.from('user_profile').select('user_id,chat_id')
  const chatMap = new Map((profs || []).filter(p => p.chat_id).map(p => [p.user_id, p.chat_id]))
  const topText = totals.slice(0, 15).map((r,i)=>`${i+1}. ${r.total.toFixed(2)}`).join('\n') || '—'
  const messages = []
  for (const [uid, chatId] of chatMap.entries()) {
    const myRank = rankMap.get(uid) || '暂未上榜'
    messages.push({ chat_id: chatId, text: templateFn(myRank, topText) })
  }
  return await sendBatchMessages(messages)
}

export async function dailyReports(forDate, templateFn) {
  const today = format(forDate, 'yyyy-MM-dd')
  const yyyyMM = format(forDate, 'yyyy-MM')
  const { data: profs } = await supabase.from('user_profile').select('user_id,chat_id,monthly_income,a_pct,b_pct,travel_budget_annual')
  const byChat = (profs || []).filter(p => p.chat_id)
  let sent=0, failed=0
  for (const p of byChat) {
    const { data: ds } = await supabase.from('daily_summary').select('sum_a,sum_b,sum_c').eq('user_id', p.user_id).eq('ymd', today).maybeSingle()
    const ta = Number(ds?.sum_a||0), tb=Number(ds?.sum_b||0), tc=Number(ds?.sum_c||0)
    const income = Number(p.monthly_income||0)
    const aPct = Number(p.a_pct||0); const bPct = Number(p.b_pct||0); const cPct=Math.max(0, 100-aPct-bPct)
    const capA = income * aPct / 100; const capB= income * bPct/100; const capC= income * cPct/100
    const epf = income * 24 / 100
    const travelMonthlyNum = Number(p.travel_budget_annual||0)/12
    const { data: mtd } = await supabase.from('daily_summary').select('sum_a,sum_b,sum_c').gte('ymd', `${yyyyMM}-01`).lte('ymd', today).eq('user_id', p.user_id)
    const m = (mtd||[]).reduce((acc,r)=>({a:acc.a+Number(r.sum_a||0),b:acc.b+Number(r.sum_b||0),c:acc.c+Number(r.sum_c||0)}),{a:0,b:0,c:0})
    const pa = capA>0? Math.min(100, Math.round(m.a/capA*100)) : 0
    const pb = capB>0? Math.min(100, Math.round(m.b/capB*100)) : 0 // 旅游仅展示
    const pc = capC>0? Math.min(100, Math.round((m.c+epf)/capC*100)) : 0
    const text = templateFn({a:ta,b:tb,c:tc, pa,pb,pc, travel: travelMonthlyNum.toFixed(2)})
    try { await sendBatchMessages([{ chat_id: p.chat_id, text }]); sent+=1 } catch(e){ failed+=1 }
  }
  return { sent, failed }
}

export async function breakStreaksOneShot() {
  const { error } = await supabase.rpc('noop') // placeholder to ensure client ready
  // 单条 SQL 重置
  const sql = `update user_profile
    set current_streak = 0
    where current_streak > 0 and (last_record is null or last_record < (current_date - interval '1 day'));`
  try {
    await supabase.from('event_audit') // use postgrest to run a dummy select to keep session
  } catch {}
  // PostgREST 无法执行任意 SQL，这里改为基于列条件的更新：
  const { data: profs } = await supabase.from('user_profile').select('user_id,current_streak,last_record')
  for (const p of profs||[]) {
    if ((p.current_streak||0)>0 && (!p.last_record || p.last_record < format(new Date(Date.now()-86400000), 'yyyy-MM-dd'))) {
      await supabase.from('user_profile').update({ current_streak: 0 }).eq('user_id', p.user_id)
    }
  }
}

