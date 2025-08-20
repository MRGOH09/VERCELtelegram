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
  
  // 调试日志：检查获取到的用户数据
  console.log(`[DEBUG] 获取到 ${profs?.length || 0} 个用户`)
  if (profs && profs.length > 0) {
    console.log(`[DEBUG] 第一个用户数据:`, profs[0])
  }

  // 使用与 /my 命令完全相同的逻辑
  const users = (profs || []).filter(p => p.chat_id).map(async (p) => {
    try {
      // 获取本月记录（与 /my 命令相同）
      const { data: records } = await supabase
        .from('records')
        .select('amount, category_group, category_code, ymd')
        .eq('user_id', p.user_id)
        .gte('ymd', `${yyyyMM}-01`)
        .lte('ymd', `${yyyyMM}-31`)
        .eq('is_voided', false)

      // 获取上月记录用于对比
      const lastMonth = new Date(forDate)
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      const lastMonthStr = format(lastMonth, 'yyyy-MM')
      
      const { data: lastMonthRecords } = await supabase
        .from('records')
        .select('amount, category_group, category_code, ymd')
        .eq('user_id', p.user_id)
        .gte('ymd', `${lastMonthStr}-01`)
        .lte('ymd', `${lastMonthStr}-31`)
        .eq('is_voided', false)

      // 获取用户资料
      const { data: profile } = await supabase
        .from('user_profile')
        .select('monthly_income, travel_budget_annual, annual_medical_insurance, annual_car_insurance')
        .eq('user_id', p.user_id)
        .single()

      // 使用与 /my 命令完全相同的计算逻辑
      const monthlyIncome = Number(profile?.monthly_income || 0)
      
      // 按分组统计本月数据
      const groupStats = {
        A: { total: 0, count: 0 }, // 开销
        B: { total: 0, count: 0 }, // 学习
        C: { total: 0, count: 0 }  // 储蓄
      }
      
      records.forEach(record => {
        const group = record.category_group
        if (groupStats[group]) {
          groupStats[group].total += Number(record.amount || 0)
          groupStats[group].count += 1
        }
      })

      // 按分组统计上月数据
      const lastMonthGroupStats = {
        A: { total: 0, count: 0 },
        B: { total: 0, count: 0 },
        C: { total: 0, count: 0 }
      }
      
      lastMonthRecords.forEach(record => {
        const group = record.category_group
        if (lastMonthGroupStats[group]) {
          lastMonthGroupStats[group].total += Number(record.amount || 0)
          lastMonthGroupStats[group].count += 1
        }
      })

      // 计算数据（与 /my 命令完全一致）
      const a = groupStats.A.total
      const b = groupStats.B.total
      const c = groupStats.C.total
      
      const lastMonthTotal = lastMonthGroupStats.A.total + lastMonthGroupStats.B.total + lastMonthGroupStats.C.total
      const thisMonthTotal = a + b + c

      // 计算百分比
      const ra = monthlyIncome > 0 ? (a / monthlyIncome * 100).toFixed(1) : '0.0'
      const rb = monthlyIncome > 0 ? (b / monthlyIncome * 100).toFixed(1) : '0.0'
      const rc = monthlyIncome > 0 ? (c / monthlyIncome * 100).toFixed(1) : '0.0'

      // 计算预算完成度
      const completion = monthlyIncome > 0 ? Math.min(100, (thisMonthTotal / monthlyIncome * 100)).toFixed(1) : '0.0'

      // 计算上月对比
      let progress = '+0%'
      if (lastMonthTotal > 0 && thisMonthTotal > 0) {
        const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100)
        progress = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
      }

      // 获取正确的连续记录天数
      const streak = Number(p.current_streak || 0)
      
      // 调试日志
      console.log(`[DEBUG] 用户 ${p.user_id} (${p.display_name}):`)
      console.log(`  - current_streak: ${p.current_streak} (类型: ${typeof p.current_streak})`)
      console.log(`  - 转换后: ${streak}`)
      console.log(`  - 上月总支出: ${lastMonthTotal}`)
      console.log(`  - 本月总支出: ${thisMonthTotal}`)

      return {
        user_id: p.user_id,
        chat_id: p.chat_id,
        name: p.display_name || '—',
        today: todaySet.has(p.user_id) ? 1 : 0,
        streak: streak,
        last: p.last_record || null,
        // 理财数据（与 /my 命令完全一致）
        income: monthlyIncome,
        a, b, c,
        ra, rb, rc,
        completion,
        progress,
        streak
      }
    } catch (error) {
      console.error(`[personalMorningReports] 获取用户 ${p.user_id} 数据失败:`, error)
      // 返回基础数据
      return {
        user_id: p.user_id,
        chat_id: p.chat_id,
        name: p.display_name || '—',
        today: todaySet.has(p.user_id) ? 1 : 0,
        streak: Number(p.current_streak || 0),
        last: p.last_record || null,
        income: Number(p.monthly_income || 0),
        a: 0, b: 0, c: 0,
        ra: '0.0', rb: '0.0', rc: '0.0',
        completion: '0.0',
        progress: '+0%',
        streak: Number(p.current_streak || 0)
      }
    }
  })

  // 等待所有异步操作完成
  const resolvedUsers = await Promise.all(users)

  resolvedUsers.sort((a, b) => {
    if (b.today !== a.today) return b.today - a.today
    if (b.streak !== a.streak) return b.streak - a.streak
    // 最近记录日期新的在前
    const la = a.last ? a.last : '0000-00-00'
    const lb = b.last ? b.last : '0000-00-00'
    return lb.localeCompare(la)
  })

  const topText = resolvedUsers.slice(0, 15).map((u, i) => `${i+1}. ${u.name} | ${u.today? '今日已记录' : '今日未记录'} | streak ${u.streak}${u.last? ' | 上次 '+u.last : ''}`).join('\n') || '—'

  const rankMap = new Map(); resolvedUsers.forEach((u, i) => rankMap.set(u.user_id, i + 1))
  const messages = resolvedUsers.map(u => ({ 
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

