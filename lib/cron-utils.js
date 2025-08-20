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

  // 添加 onConflict 确保幂等性
  await supabase.from('leaderboard_daily').upsert({ ymd, top_json: top, branch_top_json: branchTop }, { onConflict: 'ymd' })
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
  // 近7天均值
  const since = new Date(forDate); since.setDate(since.getDate()-6)
  const { data: seven } = await supabase
    .from('branch_daily')
    .select('branch_code,rate,ymd')
    .gte('ymd', format(since,'yyyy-MM-dd'))
    .lte('ymd', ymd)
  const avgMap = new Map()
  for (const r of seven||[]) {
    const k = r.branch_code; const arr = avgMap.get(k) || []; arr.push(Number(r.rate||0)); avgMap.set(k, arr)
  }
  const messages = []
  for (const row of leads || []) {
    const stat = map.get(row.branch_code); if (!stat) continue
    const arr = avgMap.get(row.branch_code) || []
    const avg7 = arr.length? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*100)/100 : 0
    const text = templateFn(row.branch_code, { ...stat, avg7 })
    for (const cid of row.leader_chat_ids || []) messages.push({ chat_id: cid, text })
  }
  return await sendBatchMessages(messages)
}

export async function personalMorningReports(forDate, templateFn) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  const yyyyMM = format(forDate, 'yyyy-MM')
  
  // 查今天有记录的用户
  const { data: recs } = await supabase
    .from('records')
    .select('user_id')
    .eq('ymd', ymd)
    .eq('is_voided', false)
  const todaySet = new Set((recs || []).map(r => r.user_id))

  // 拉取用户基础：昵称/聊天/streak/last_record
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,chat_id,display_name,current_streak,last_record,monthly_income,a_pct,b_pct')

  // 批量获取所有用户的当月预算快照
  const { data: budgets } = await supabase
    .from('user_month_budget')
    .select('user_id,income,a_pct,b_pct,epf_amount')
    .eq('yyyymm', yyyyMM)

  // 批量获取所有用户的本月汇总
  const { data: monthSummaries } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .gte('ymd', `${yyyyMM}-01`)
    .lte('ymd', ymd)

  // 构建查找映射
  const budgetMap = new Map((budgets || []).map(b => [b.user_id, b]))
  const monthMap = new Map()
  for (const s of monthSummaries || []) {
    if (!monthMap.has(s.user_id)) monthMap.set(s.user_id, { a: 0, b: 0, c: 0 })
    const m = monthMap.get(s.user_id)
    m.a += Number(s.sum_a || 0)
    m.b += Number(s.sum_b || 0)
    m.c += Number(s.sum_c || 0)
  }

  const users = (profs || []).filter(p => p.chat_id).map(p => {
    const budget = budgetMap.get(p.user_id)
    const monthSum = monthMap.get(p.user_id) || { a: 0, b: 0, c: 0 }
    
    // 优先使用预算快照，fallback 到 profile
    const income = Number(budget?.income || p.monthly_income || 0)
    const aPct = Number(budget?.a_pct || p.a_pct || 0)
    const bPct = Number(budget?.b_pct || p.b_pct || 0)
    const cPct = Math.max(0, 100 - aPct - bPct)
    
    const a = monthSum.a || 0
    const b = monthSum.b || 0
    const c = monthSum.c || 0
    
    // 计算百分比
    const ra = income > 0 ? (a / income * 100).toFixed(1) : '0.0'
    const rb = income > 0 ? (b / income * 100).toFixed(1) : '0.0'
    const rc = income > 0 ? (c / income * 100).toFixed(1) : '0.0'
    
    // 计算预算完成度
    const completion = income > 0 ? Math.min(100, ((a + b + c) / income * 100)).toFixed(1) : '0.0'
    
    return {
      user_id: p.user_id,
      chat_id: p.chat_id,
      name: p.display_name || '—',
      today: todaySet.has(p.user_id) ? 1 : 0,
      streak: Number(p.current_streak || 0),
      last: p.last_record || null,
      // 理财数据
      income,
      a, b, c,
      ra, rb, rc,
      completion,
      progress: '+0%', // 暂时设为默认值
      streak: Number(p.current_streak || 0)
    }
  })

  users.sort((a, b) => {
    if (b.today !== a.today) return b.today - a.today
    if (b.streak !== a.streak) return b.streak - a.streak
    // 最近记录日期新的在前
    const la = a.last ? a.last : '0000-00-00'
    const lb = b.last ? b.last : '0000-00-00'
    return lb.localeCompare(la)
  })

  const topText = users.slice(0, 15).map((u, i) => `${i+1}. ${u.name} | ${u.today? '今日已记录' : '今日未记录'} | streak ${u.streak}${u.last? ' | 上次 '+u.last : ''}`).join('\n') || '—'

  const rankMap = new Map(); users.forEach((u, i) => rankMap.set(u.user_id, i + 1))
  const messages = users.map(u => ({ 
    chat_id: u.chat_id, 
    text: templateFn(u.income, u.a, u.b, u.c, u.ra, u.rb, u.rc, u.completion, u.progress, u.streak) 
  }))
  return await sendBatchMessages(messages)
}

export async function dailyReports(forDate, templateFn) {
  const today = format(forDate, 'yyyy-MM-dd')
  const yyyyMM = format(forDate, 'yyyy-MM')
  
  // 批量获取所有用户资料
  const { data: profs } = await supabase.from('user_profile').select('user_id,chat_id,monthly_income,a_pct,b_pct,travel_budget_annual')
  const byChat = (profs || []).filter(p => p.chat_id)
  
  // 批量获取所有用户的当月预算快照（优先读取）
  const { data: budgets } = await supabase
    .from('user_month_budget')
    .select('user_id,income,a_pct,b_pct,epf_amount')
    .eq('yyyymm', yyyyMM)
  
  // 批量获取所有用户的今日汇总
  const { data: todaySummaries } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .eq('ymd', today)
  
  // 批量获取所有用户的本月汇总
  const { data: monthSummaries } = await supabase
    .from('daily_summary')
    .select('user_id,sum_a,sum_b,sum_c')
    .gte('ymd', `${yyyyMM}-01`)
    .lte('ymd', today)
  
  // 构建查找映射
  const budgetMap = new Map((budgets || []).map(b => [b.user_id, b]))
  const todayMap = new Map((todaySummaries || []).map(s => [s.user_id, s]))
  const monthMap = new Map()
  for (const s of monthSummaries || []) {
    if (!monthMap.has(s.user_id)) monthMap.set(s.user_id, { a: 0, b: 0, c: 0 })
    const m = monthMap.get(s.user_id)
    m.a += Number(s.sum_a || 0)
    m.b += Number(s.sum_b || 0)
    m.c += Number(s.sum_c || 0)
  }
  
  // 构建所有消息
  const messages = []
  for (const p of byChat) {
    const budget = budgetMap.get(p.user_id)
    const todaySum = todayMap.get(p.user_id) || { sum_a: 0, sum_b: 0, sum_c: 0 }
    const monthSum = monthMap.get(p.user_id) || { a: 0, b: 0, c: 0 }
    
    // 优先使用预算快照，fallback 到 profile
    const income = Number(budget?.income || p.monthly_income || 0)
    const aPct = Number(budget?.a_pct || p.a_pct || 0)
    const bPct = Number(budget?.b_pct || p.b_pct || 0)
    const cPct = Math.max(0, 100 - aPct - bPct)
    const epf = Number(budget?.epf_amount || income * 24 / 100)
    
    const ta = Number(todaySum.sum_a || 0)
    const tb = Number(todaySum.sum_b || 0)
    const tc = Number(todaySum.sum_c || 0)
    
    const travelMonthlyNum = Number(p.travel_budget_annual || 0) / 12
    
    // 实时占比计算
    const denom = income > 0 ? income : 0
    const ra = denom > 0 ? Math.round((monthSum.a / denom) * 100) : null
    const rb = denom > 0 ? Math.round(((monthSum.b + travelMonthlyNum) / denom) * 100) : null
    const rc = denom > 0 ? Math.max(0, 100 - (ra || 0) - (rb || 0)) : null
    
    const text = templateFn({ a: ta, b: tb, c: tc, ra, rb, rc, travel: travelMonthlyNum.toFixed(2) })
    messages.push({ chat_id: p.chat_id, text })
  }
  
  // 一次性批量发送所有消息
  return await sendBatchMessages(messages)
}

export async function breakStreaksOneShot() {
  try {
    // 使用批量 SQL 操作，一次性重置所有断签用户
    const { data, error } = await supabase
      .from('user_profile')
      .update({ current_streak: 0 })
      .lt('last_record', format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'))
      .gt('current_streak', 0)
    
    if (error) {
      console.error('批量断签清零失败:', error)
      // fallback 到逐条更新
      const { data: profs } = await supabase
        .from('user_profile')
        .select('user_id,current_streak,last_record')
        .gt('current_streak', 0)
      
      let resetCount = 0
      for (const p of profs || []) {
        if (!p.last_record || p.last_record < format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')) {
          await supabase.from('user_profile').update({ current_streak: 0 }).eq('user_id', p.user_id)
          resetCount++
        }
      }
      return { resetCount, method: 'fallback' }
    }
    
    // 获取实际更新的行数
    const { count } = await supabase
      .from('user_profile')
      .select('*', { count: 'exact', head: true })
      .eq('current_streak', 0)
      .lt('last_record', format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'))
    
    return { resetCount: count || 0, method: 'batch' }
  } catch (e) {
    console.error('断签清零异常:', e)
    return { resetCount: 0, method: 'error', error: e.message }
  }
}

