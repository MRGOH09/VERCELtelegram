import supabase from './supabase.js'
import { format } from 'date-fns'
import { sendBatchMessages } from './telegram.js'
import { batchEnsureMonthlyBudgets } from './monthly-budget.js'
import { zh } from './i18n.js'
import { formatTemplate } from './helpers.js'
import { isInSeptemberChallenge, addChallengeMessageToMorningRank } from './september-challenge-messages.js'

export async function computeLeaderboards(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  
  console.log(`[computeLeaderboards] 计算排行榜，日期: ${ymd}`)
  
  // 直接从 records 表计算每日支出总计
  const { data: records } = await supabase
    .from('records')
    .select('user_id,amount,category_group')
    .eq('ymd', ymd)
    .eq('is_voided', false)
  
  // 按用户分组计算总支出
  const userTotals = new Map()
  for (const rec of records || []) {
    const userId = rec.user_id
    const amount = Number(rec.amount || 0)
    const current = userTotals.get(userId) || { user_id: userId, sum_a: 0, sum_b: 0, sum_c: 0, total: 0 }
    
    if (rec.category_group === 'A') current.sum_a += amount
    else if (rec.category_group === 'B') current.sum_b += amount
    else if (rec.category_group === 'C') current.sum_c += amount
    
    current.total = current.sum_a + current.sum_b + current.sum_c
    userTotals.set(userId, current)
  }
  
  const totals = Array.from(userTotals.values())
  totals.sort((a,b) => b.total - a.total)
  const top = totals.slice(0, 15)
  
  console.log(`[computeLeaderboards] 计算出 ${top.length} 个用户排行`)

  // KISS: 只查询分行统计需要的字段
  const { data: branchUsers } = await supabase
    .from('users')
    .select('id,branch_code')
    .not('branch_code', 'is', null)
  
  console.log(`[computeLeaderboards] 查询到 ${branchUsers?.length || 0} 个有分行用户`)
  
  // 今日活跃用户（有记录的用户）
  const todayActiveUsers = new Set((records || []).map(r => r.user_id))
  
  // 获取用户详细信息用于streak计算
  const { data: userProfiles } = await supabase
    .from('user_profile')
    .select('user_id, current_streak, total_records, last_record')
  
  const userProfileMap = new Map()
  userProfiles?.forEach(p => {
    userProfileMap.set(p.user_id, p)
  })
  
  const branchStats = new Map()
  
  // 按分行统计完整数据
  branchUsers?.forEach(u => {
    const branchCode = u.branch_code
    const profile = userProfileMap.get(u.id) || {}
    const stats = branchStats.get(branchCode) || { 
      branch_code: branchCode, 
      done: 0, 
      total: 0, 
      rate: 0,
      streaks: [],
      totalRecords: [],
      recordDays: []
    }
    
    stats.total += 1
    if (todayActiveUsers.has(u.id)) {
      stats.done += 1
    }
    
    // 收集streak和记录数据
    if (profile.current_streak) stats.streaks.push(profile.current_streak)
    if (profile.total_records) stats.totalRecords.push(profile.total_records)
    
    // 计算记录天数（基于total_records的估算）
    if (profile.total_records && profile.total_records > 0) {
      stats.recordDays.push(Math.min(profile.total_records, 31)) // 最多31天
    }
    
    stats.rate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100 * 100) / 100 : 0
    branchStats.set(branchCode, stats)
  })
  
  // 计算分行统计指标
  for (const [branchCode, stats] of branchStats.entries()) {
    // 平均连续记录天数
    stats.avg_streak = stats.streaks.length > 0 ? 
      Math.round(stats.streaks.reduce((a, b) => a + b, 0) / stats.streaks.length) : 0
    
    // 最高连续记录
    stats.max_streak = stats.streaks.length > 0 ? Math.max(...stats.streaks) : 0
    
    // 平均记录天数
    stats.avg_record_days = stats.recordDays.length > 0 ? 
      Math.round(stats.recordDays.reduce((a, b) => a + b, 0) / stats.recordDays.length) : 0
    
    // 找到最高streak的用户（简化处理）
    stats.max_streak_user = stats.max_streak > 0 ? '分行冠军' : '无'
    
    // 昨日完成率就是今日完成率（因为我们计算的是每日数据）
    stats.yesterday_rate = stats.rate
    
    // 清理临时数组，只保留最终统计数据
    delete stats.streaks
    delete stats.totalRecords
    delete stats.recordDays
    
    branchStats.set(branchCode, stats)
  }
  
  const branchTop = Array.from(branchStats.values())
    .sort((a,b) => (b.rate||0) - (a.rate||0))
    .slice(0, 10)
  
  console.log(`[computeLeaderboards] 计算出 ${branchTop.length} 个分行数据`)

  // 同步写入 branch_daily 表用于历史统计
  const branchDailyRecords = branchTop.map(branch => ({
    branch_code: branch.branch_code,
    ymd,
    done: branch.done,
    total: branch.total,
    rate: branch.rate
  }))

  if (branchDailyRecords.length > 0) {
    await supabase.from('branch_daily').upsert(branchDailyRecords, { 
      onConflict: 'branch_code,ymd' 
    })
    console.log(`[computeLeaderboards] 已同步 ${branchDailyRecords.length} 个分行数据到 branch_daily`)
  } else {
    console.log(`[computeLeaderboards] 警告：没有分行数据可同步到 branch_daily（可能所有用户都未设置分行）`)
  }

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
    .select('user_id,chat_id,display_name,current_streak,last_record,monthly_income,a_pct')
  
  // 确保所有活跃用户都有当月预算记录
  const byChat = (profs || []).filter(p => p.chat_id)
  if (byChat.length > 0) {
    const budgetRequests = byChat.map(p => ({ 
      userId: p.user_id, 
      yyyymm: yyyyMM 
    }))
    
    try {
      const budgetStats = await batchEnsureMonthlyBudgets(budgetRequests)
      console.log(`[personalMorningReports] 预算记录确保完成:`, budgetStats)
    } catch (error) {
      console.error(`[personalMorningReports] 批量创建预算失败，继续执行:`, error)
    }
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
        .select('monthly_income, travel_budget_annual, annual_medical_insurance, annual_car_insurance, a_pct')
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
      
      // 收集记录日期用于计算记录天数（与 calculateSummary 逻辑一致）
      const recordDates = new Set()
      
      records.forEach(record => {
        const group = record.category_group
        if (groupStats[group]) {
          groupStats[group].total += Number(record.amount || 0)
          groupStats[group].count += 1
        }
        
        // 收集不重复的记录日期
        if (record.ymd) {
          recordDates.add(record.ymd)
        }
      })
      
      // 计算新的记录指标（与 calculateSummary 逻辑一致）
      const recordMetrics = {
        totalRecords: records.length,        // 总记录笔数
        recordDays: recordDates.size,        // 记录天数（不重复日期数量）
        avgRecordsPerDay: recordDates.size > 0 ? (records.length / recordDates.size).toFixed(1) : '0.0'  // 平均每天记录数
      }

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

      // 计算数据（与 user-system.js 完全一致）
      const aTotal = groupStats.A.total
      
      // 学习总额 = B类记录 + 旅游基金 (保留2位小数精度)
      const travelMonthly = Math.round((profile?.travel_budget_annual || 0) / 12 * 100) / 100
      const bTotal = Math.round((groupStats.B.total + travelMonthly) * 100) / 100
      
      // 储蓄 = 收入 - 开销 - 学习 (可能为负数，保留2位小数精度)
      const cTotal = Math.round((monthlyIncome - aTotal - bTotal) * 100) / 100
      
      const lastMonthTotal = lastMonthGroupStats.A.total + lastMonthGroupStats.B.total + lastMonthGroupStats.C.total
      const thisMonthTotal = aTotal + bTotal + cTotal

      // 计算百分比
      const ra = monthlyIncome > 0 ? (aTotal / monthlyIncome * 100).toFixed(1) : '0.0'
      const rb = monthlyIncome > 0 ? (bTotal / monthlyIncome * 100).toFixed(1) : '0.0'
      const rc = monthlyIncome > 0 ? (cTotal / monthlyIncome * 100).toFixed(1) : '0.0'

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
      
      // 获取用户设置的预算占比
      const budget_a = Number(profile?.a_pct || 60)  // 生活开销预算占比
      
      // 计算预算状态
      const current_a_pct = Number(ra)  // 当前生活开销占比
      
      // 生成预算状态文字
      let budget_status_a
      
      if (current_a_pct <= budget_a) {
        const remaining_pct = budget_a - current_a_pct
        budget_status_a = `还剩 ${remaining_pct.toFixed(1)}%`
      } else {
        const over_pct = current_a_pct - budget_a
        budget_status_a = `超支 ${over_pct.toFixed(1)}%`
      }

      return {
        user_id: p.user_id,
        chat_id: p.chat_id,
        name: p.display_name || '—',
        today: todaySet.has(p.user_id) ? 1 : 0,
        streak: streak,
        last: p.last_record || null,
        // 理财数据（与 /my 命令完全一致）
        income: monthlyIncome,
        a: aTotal, b: bTotal, c: cTotal,
        ra, rb, rc,
        completion,
        progress,
        // 新增预算相关数据
        budget_a,
        budget_status_a,
        // 新增记录指标
        recordMetrics
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
        streak: Number(p.current_streak || 0),
        // 新增预算相关数据
        budget_a: Number(p.a_pct || 0),
        budget_status_a: `还剩 ${Number(p.a_pct || 0).toFixed(1)}%`,
        // 新增记录指标默认值
        recordMetrics: {
          totalRecords: 0,
          recordDays: 0, 
          avgRecordsPerDay: '0.0'
        }
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
    text: templateFn(u.income, u.a, u.b, u.c, u.ra, u.rb, u.rc, u.completion, u.progress, u.streak, u.budget_a, u.budget_status_a, u.recordMetrics?.totalRecords || 0, u.recordMetrics?.recordDays || 0, u.recordMetrics?.avgRecordsPerDay || '0.0') 
  }))
  const sendResults = await sendBatchMessages(messages)
  return {
    ...sendResults,
    messages: messages  // 返回消息数组供其他函数使用
  }
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

// 个人理财报告 + 分行排行榜真正合并发送
export async function personalMorningReportsWithBranch(forDate) {
  console.log('[personalMorningReportsWithBranch] 简化方案：先发理财报告，再发分行信息...')
  
  // 1. 先发送理财报告（使用原来能工作的函数）
  const personalResults = await personalMorningReports(forDate, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a, total_records, record_days, avg_records_per_day) => {
    const baseMessage = formatTemplate(zh.cron.morning_rank, { 
      income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a, total_records, record_days, avg_records_per_day 
    })
    
    if (isInSeptemberChallenge(forDate)) {
      return addChallengeMessageToMorningRank(baseMessage, forDate)
    }
    
    return baseMessage
  })
  
  console.log(`[personalMorningReportsWithBranch] 理财报告发送完成: 成功 ${personalResults.sent}, 失败 ${personalResults.failed}`)
  
  // 2. 如果理财报告发送成功，再发送分行排行榜（作为第二条消息）
  if (personalResults.messages && personalResults.messages.length > 0) {
    const branchRankings = await getBranchRankingsData(forDate)
    
    // 简化查询：直接获取所有用户的分行信息
    const { data: userBranches } = await supabase
      .from('user_profile')
      .select('chat_id,user_id')
      .not('chat_id', 'is', null)
    
    // 然后获取这些用户的分行信息
    const userIds = userBranches?.map(u => u.user_id) || []
    const { data: usersData } = await supabase
      .from('users')
      .select('id,branch_code')
      .in('id', userIds)
    
    // 建立 user_id -> branch_code 的映射
    const userIdToBranch = new Map()
    usersData?.forEach(u => {
      if (u.branch_code) {
        userIdToBranch.set(u.id, u.branch_code)
      }
    })
    
    console.log(`[personalMorningReportsWithBranch] 用户分行映射:`, Array.from(userIdToBranch.entries()))
    
    // 建立 chat_id -> branch_code 的映射
    const userBranchMap = new Map()
    userBranches?.forEach(u => {
      const branchCode = userIdToBranch.get(u.user_id)
      if (branchCode) {
        userBranchMap.set(u.chat_id, branchCode)
        console.log(`[personalMorningReportsWithBranch] 映射用户 chat_id:${u.chat_id} (type:${typeof u.chat_id}) -> 分行:${branchCode}`)
      }
    })
    
    console.log(`[personalMorningReportsWithBranch] userBranchMap大小: ${userBranchMap.size}`)
    
    const branchMessages = personalResults.messages.map(msg => {
      const userBranch = userBranchMap.get(msg.chat_id)
      const branchRanking = branchRankings.get(userBranch)
      
      console.log(`[personalMorningReportsWithBranch] 处理消息 chat_id:${msg.chat_id} (type:${typeof msg.chat_id})`)
      console.log(`[personalMorningReportsWithBranch] 从userBranchMap查找分行:`, userBranch)
      console.log(`[personalMorningReportsWithBranch] chat_id匹配检查:`, Array.from(userBranchMap.keys()).includes(msg.chat_id))
      
      let branchText = '📊 分行排行榜:\n'
      if (userBranch) {
        branchText += `🏢 您的分行: ${userBranch}\n`
        if (branchRanking) {
          branchText += branchRanking
        } else {
          branchText += '暂无排行榜数据'
        }
      } else {
        branchText += '您还没有设置分行代码'
      }
      
      return {
        chat_id: msg.chat_id,
        text: branchText
      }
    })
    
    console.log(`[personalMorningReportsWithBranch] 准备发送 ${branchMessages.length} 条分行排行榜消息`)
    const branchResults = await sendBatchMessages(branchMessages)
    console.log(`[personalMorningReportsWithBranch] 分行排行榜发送完成: 成功 ${branchResults.sent}, 失败 ${branchResults.failed}`)
    
    return {
      sent: personalResults.sent + branchResults.sent,
      failed: personalResults.failed + branchResults.failed,
      totalTime: (personalResults.totalTime || 0) + (branchResults.totalTime || 0),
      rate: personalResults.rate || 0
    }
  }
  
  return personalResults
}

// 获取分行排行榜数据
export async function getBranchRankingsData(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  
  // 获取排行榜数据
  const { data: lb } = await supabase
    .from('leaderboard_daily')
    .select('branch_top_json')
    .eq('ymd', ymd)
    .maybeSingle()
  
  const branchTop = lb?.branch_top_json || []
  console.log(`[getBranchRankingsData] 获取到 ${branchTop.length} 个分行数据`)
  
  const map = new Map()
  
  for (const b of branchTop) {
    const branchCode = b.branch_code || b.branch || b.code
    if (branchCode) {
      map.set(branchCode, b)
      console.log(`[getBranchRankingsData] 添加分行: ${branchCode}, rate: ${b.rate}`)
    }
  }
  
  // 近7天均值 - 暂时使用当前值作为近7天平均（因为branch_daily表未填充）
  const avgMap = new Map()
  
  // 为每个分行设置当前完成率作为临时7天平均值
  for (const [branchCode, stat] of map.entries()) {
    avgMap.set(branchCode, [Number(stat.rate || 0)])
    console.log(`[getBranchRankingsData] 分行 ${branchCode} 使用当前完成率 ${stat.rate}% 作为临时7天平均`)
  }
  
  // 生成分行排行榜消息
  const branchMessages = new Map()
  
  for (const [branchCode, stat] of map.entries()) {
    const arr = avgMap.get(branchCode) || []
    const avg7 = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : 0
    
    const branchText = formatTemplate(zh.cron.branch_lead, {
      code: branchCode,
      yesterday_rate: stat.rate || 0,  // 使用当日完成率
      done: stat.done || 0,
      total: stat.total || 0,
      avg_record_days: stat.avg_record_days || 0,
      max_streak: stat.max_streak || 0,
      max_streak_user: stat.max_streak_user || '无',
      avg_streak: stat.avg_streak || 0
    })
    
    branchMessages.set(branchCode, branchText)
    console.log(`[getBranchRankingsData] 生成分行消息: ${branchCode}`)
  }
  
  console.log(`[getBranchRankingsData] 总共生成 ${branchMessages.size} 个分行消息`)
  
  return branchMessages
}

