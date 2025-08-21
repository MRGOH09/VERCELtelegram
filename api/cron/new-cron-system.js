import { todayYMD } from '../../lib/time.js'
import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports, 
  breakStreaksOneShot,
  usersWithoutRecordToday,
  dailyReports
} from '../../lib/cron-utils.js'
import supabase from '../../lib/supabase.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    const hour = now.getHours()
    const { action, adminId, mode, task } = req.body || {}
    
    console.info(`[unified-cron] 执行时间：${now.toISOString()}，小时：${hour}`)
    
    // 如果是GET请求或者没有body参数，执行每日cron任务
    if (req.method === 'GET' || (!action && !adminId && !task)) {
      return await handleDailyCron(req, res, now)
    }
    
    // 兼容旧的手动触发模式
    if (action && adminId) {
      return await handleTriggerMode(req, res, action, adminId)
    }
    
    if (task) {
      return await handleSpecificTask(req, res, task, adminId)
    }
    
    // 默认按小时执行
    return await handleDailySettlement(req, res, now)
    
  } catch (e) {
    console.error('[unified-cron] 执行失败:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

// Cron 模式：凌晨2点自动执行
async function handleCronMode(req, res) {
  try {
    const now = new Date()
    const isFirstDayOfMonth = now.getDate() === 1
    
    console.info(`[cron:unified-cron] 开始执行，时间：${now.getHours()}:00，是否月初：${isFirstDayOfMonth}`)
    
    let results = {
      morning: null,
      noon: null,
      evening: null,
      timestamp: now.toISOString(),
      totalSent: 0,
      totalFailed: 0
    }
    
    // 每天凌晨2点运行一次，智能处理所有时间逻辑
    // 1. 早晨任务（凌晨2点执行）
    results.morning = await handleMorningTasks(now, isFirstDayOfMonth)
    results.totalSent += (results.morning?.totalSent || 0)
    results.totalFailed += (results.morning?.totalFailed || 0)
    
    // 2. 模拟中午任务（计算并准备，但不立即发送）
    const noonResults = await prepareNoonTasks(now)
    results.noon = noonResults
    
    // 3. 模拟晚上任务（计算并准备，但不立即发送）
    const eveningResults = await prepareEveningTasks(now)
    results.evening = eveningResults
    
    // 4. 发送 admin 总报告
    await sendAdminReport(results, now)
    
    console.info('[cron:unified-cron] 执行完成', results)
    return res.status(200).json({ ok: true, results })
    
  } catch (e) {
    console.error('[cron:unified-cron] 执行失败:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

// 手动触发模式：执行特定时间的推送
async function handleTriggerMode(req, res, action, adminId) {
  try {
    if (!action) {
      return res.status(400).json({ 
        ok: false, 
        error: 'action is required',
        availableActions: ['noon', 'evening']
      })
    }

    if (!adminId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'adminId is required for security'
      })
    }

    // 验证管理员身份
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!adminIds.includes(adminId.toString())) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Unauthorized: Not an admin'
      })
    }

    console.log(`[trigger:unified-cron] Admin ${adminId} 触发推送，动作：${action}`)
    
    const now = new Date()
    
    let results = {
      action,
      adminId,
      triggerTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      totalSent: 0,
      totalFailed: 0,
      details: {}
    }
    
    // 根据动作执行相应的推送
    switch (action) {
      case 'noon':
        results.details = await executeNoonPush(now)
        break
        
      case 'evening':
        results.details = await executeEveningPush(now)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown action: ${action}`,
          availableActions: ['noon', 'evening']
        })
    }
    
    // 计算总发送和失败数
    results.totalSent = (results.details.reminder?.sent || 0) + (results.details.daily?.sent || 0) + (results.details.evening?.sent || 0)
    results.totalFailed = (results.details.reminder?.failed || 0) + (results.details.daily?.failed || 0) + (results.details.evening?.failed || 0)
    
    // 发送执行结果到 Admin
    await sendTriggerReport(results, now, adminId)
    
    console.log(`[trigger:unified-cron] 推送完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `手动触发推送 ${action} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[trigger:unified-cron] 推送失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 执行特定任务模式
async function handleSpecificTask(req, res, task, adminId = null) {
  try {
    console.log(`[specific-task] 执行特定任务：${task}`)
    
    const now = new Date()
    let results = {
      task,
      adminId,
      executeTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      success: false,
      details: {}
    }
    
    // 根据任务类型执行相应的功能
    switch (task) {
      case 'break-streaks':
        results.details = await executeBreakStreaks(now)
        break
        
      case 'daily-report':
        results.details = await executeDailyReport(now)
        break
        
      case 'morning-tasks':
        results.details = await executeMorningTasks(now)
        break
        
      case 'reminder':
        results.details = await executeReminder(now)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown task: ${task}`,
          availableTasks: ['break-streaks', 'daily-report', 'morning-tasks', 'reminder']
        })
    }
    
    results.success = true
    
    // 如果是Admin执行，发送报告
    if (adminId) {
      await sendTaskReport(results, now, adminId)
    }
    
    console.log(`[specific-task] 任务执行完成：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `任务 ${task} 执行完成`,
      results 
    })
    
  } catch (e) {
    console.error('[specific-task] 任务执行失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 早晨任务处理
async function handleMorningTasks(now, isFirstDayOfMonth) {
  console.log('[morning] 开始执行早晨任务...')
  
  // 断签清零
  await breakStreaksOneShot()
  
  // 每月1号自动入账
  if (isFirstDayOfMonth) {
    await handleMonthlyAutoPost(now)
  }
  
  // 计算排行榜
  await computeLeaderboards(now)
  
  // 推送个人排名报告
  const personalResults = await personalMorningReports(now, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a) => 
    formatTemplate(zh.cron.morning_rank, { income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a })
  )
  
  // 每周一推送分行排行榜
  const isMonday = now.getDay() === 1
  let branchResults = null
  if (isMonday) {
    branchResults = await pushBranchLeaderboards(now, (code, stat) => 
      formatTemplate(zh.cron.branch_lead, { 
        code, 
        rate: stat.rate||0, 
        done: stat.done||0, 
        total: stat.total||0 
      })
    )
  }
  
  const totalSent = (personalResults?.sent || 0) + (branchResults?.sent || 0)
  const totalFailed = (personalResults?.failed || 0) + (branchResults?.failed || 0)
  
  return {
    personal: personalResults,
    branch: branchResults,
    autoPost: isFirstDayOfMonth,
    totalSent,
    totalFailed
  }
}

// 准备中午任务数据
async function prepareNoonTasks(now) {
  console.log('[noon] 准备中午任务数据...')
  
  // 获取今日未记录用户
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 计算中午任务的数据，但不立即发送
  const reminderData = {
    userCount: usersWithoutRecord.length,
    users: usersWithoutRecord,
    ready: true,
    note: '中午任务数据已准备，将在中午12点通过其他方式触发'
  }
  
  // 计算日报数据
  const dailyData = {
    ready: true,
    note: '日报数据已准备，将在中午12点通过其他方式触发'
  }
  
  return {
    reminder: reminderData,
    daily: dailyData,
    totalSent: 0,
    totalFailed: 0
  }
}

// 准备晚间任务数据
async function prepareEveningTasks(now) {
  console.log('[evening] 准备晚上任务数据...')
  
  // 获取今日未记录用户
  const usersWithoutRecord = await usersWithoutRecordToday(now)
  
  // 计算晚上任务的数据，但不立即发送
  const eveningData = {
    userCount: usersWithoutRecord.length,
    users: usersWithoutRecord,
    ready: true,
    note: '晚上任务数据已准备，将在晚上10点通过其他方式触发'
  }
  
  return {
    evening: eveningData,
    totalSent: 0,
    totalFailed: 0
  }
}

// 执行中午推送
async function executeNoonPush(now) {
  console.log('[trigger:unified-cron] 执行中午推送...')
  
  const results = {}
  
  // 执行用户提醒
  try {
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    const reminderMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generatePersonalizedReminder(chatId, now)
    }))
    
    const reminderResults = await sendBatchMessages(reminderMessages)
    results.reminder = { success: true, result: reminderResults, userCount: usersWithoutRecord.length }
  } catch (e) {
    results.reminder = { success: false, error: e.message }
  }
  
  // 执行日报推送
  try {
    const dailyResults = await dailyReports(now, ({a,b,c, ra, rb, rc, travel}) =>
      formatTemplate(zh.cron.daily_report, { 
        a: a.toFixed?.(2) || a, 
        b: b.toFixed?.(2) || b, 
        c: c.toFixed?.(2) || c, 
        ra, rb, rc, travel 
      })
    )
    results.daily = { success: true, result: dailyResults }
  } catch (e) {
    results.daily = { success: false, error: e.message }
  }
  
  return results
}

// 执行晚间推送
async function executeEveningPush(now) {
  console.log('[trigger:unified-cron] 执行晚间推送...')
  
  const results = {}
  
  // 执行晚间提醒
  try {
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    const eveningMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateEveningReminder(chatId, now)
    }))
    
    const eveningResults = await sendBatchMessages(eveningMessages)
    results.evening = { success: true, result: eveningResults, userCount: usersWithoutRecord.length }
  } catch (e) {
    results.evening = { success: false, error: e.message }
  }
  
  return results
}

// 执行断签清零
async function executeBreakStreaks(now) {
  console.log('[specific-task] 执行断签清零...')
  
  try {
    const result = await breakStreaksOneShot()
    return { success: true, result }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// 执行日报
async function executeDailyReport(now) {
  console.log('[specific-task] 执行日报...')
  
  try {
    const dailyResults = await dailyReports(now, ({a,b,c, ra, rb, rc, travel}) =>
      formatTemplate(zh.cron.daily_report, { 
        a: a.toFixed?.(2) || a, 
        b: b.toFixed?.(2) || b, 
        c: c.toFixed?.(2) || c, 
        ra, rb, rc, travel 
      })
    )
    return { success: true, result: dailyResults }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// 执行早晨任务
async function executeMorningTasks(now) {
  console.log('[specific-task] 执行早晨任务...')
  
  try {
    const isFirstDayOfMonth = now.getDate() === 1
    const results = await handleMorningTasks(now, isFirstDayOfMonth)
    return { success: true, results }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// 执行提醒
async function executeReminder(now) {
  console.log('[specific-task] 执行提醒...')
  
  try {
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    const reminderMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generatePersonalizedReminder(chatId, now)
    }))
    
    const reminderResults = await sendBatchMessages(reminderMessages)
    return { success: true, result: reminderResults, userCount: usersWithoutRecord.length }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// 月度自动入账
async function handleMonthlyAutoPost(now) {
  console.log('[autoPost] 开始执行月度自动入账...')
  
  const yyyymm = now.toISOString().slice(0,7)
  const ymd = `${yyyymm}-01`
  
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,travel_budget_annual,annual_medical_insurance,annual_car_insurance')
  
  let insertedCount = 0
  
  for (const p of profs||[]) {
    const posts = [
      { g: 'B', c: 'travel_auto', amt: Number(p.travel_budget_annual||0)/12 },
      { g: 'C', c: 'ins_med_auto', amt: Number(p.annual_medical_insurance||0)/12 },
      { g: 'C', c: 'ins_car_auto', amt: Number(p.annual_car_insurance||0)/12 }
    ].filter(x=>x.amt>0)
    
    for (const it of posts) {
      const { data: exist } = await supabase
        .from('records')
        .select('id')
        .eq('user_id', p.user_id)
        .eq('ymd', ymd)
        .eq('category_code', it.c)
        .eq('is_voided', false)
        .maybeSingle()
      
      if (!exist) {
        await supabase.from('records').insert([{ 
          user_id: p.user_id, 
          category_group: it.g, 
          category_code: it.c, 
          amount: it.amt, 
          note: 'Auto-post', 
          ymd 
        }])
        insertedCount++
      }
    }
  }
  
  console.log(`[autoPost] 月度自动入账完成，新增 ${insertedCount} 条记录`)
  return { insertedCount }
}

// 生成个性化提醒
function generatePersonalizedReminder(chatId, now) {
  return formatTemplate(zh.cron.reminder, {
    date: now.toISOString().slice(0, 10),
    a: '0.00',
    b: '0.00', 
    c: '0.00',
    ra: '0%',
    rb: '0%',
    rc: '0%'
  })
}

// 生成晚间提醒
function generateEveningReminder(chatId, now) {
  return `🌙 晚间提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n⏰ 现在是晚上 10:00\n\n💡 你还没有记录任何开销哦！\n\n🚀 行动才会改变！\n💰 记录今天的支出，让理财更精准！\n\n💪 现在就开始记账吧！`
}

// 发送 Admin 报告
async function sendAdminReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[admin] 没有配置管理员ID，跳过admin报告')
      return
    }
    
    const report = generateAdminReport(results, now)
    
    const adminMessages = adminIds.map(chatId => ({
      chat_id: chatId,
      text: report
    }))
    
    const adminResults = await sendBatchMessages(adminMessages)
    console.log(`[admin] Admin报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[admin] 发送admin报告失败:', e)
  }
}

// 生成 Admin 报告
function generateAdminReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `📊 统一Cron任务执行报告\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
  
  // 早晨任务报告
  if (results.morning) {
    report += `🌅 早晨推送 (2:00 AM)：\n`
    report += `   • 分行排行：成功 ${results.morning.branch?.sent || 0}，失败 ${results.morning.branch?.failed || 0}\n`
    report += `   • 个人排名：成功 ${results.morning.personal?.sent || 0}，失败 ${results.morning.personal?.failed || 0}\n`
    report += `   • 月度入账：${results.morning.autoPost ? '已执行' : '跳过'}\n`
    report += `   • 总计：成功 ${results.morning.totalSent}，失败 ${results.morning.totalFailed}\n\n`
  }
  
  // 中午任务报告
  if (results.noon) {
    report += `🌞 中午任务准备：\n`
    report += `   • 用户提醒：已准备 ${results.noon.reminder?.userCount || 0} 用户\n`
    report += `   • 每日报告：数据已准备\n`
    report += `   • 状态：${results.noon.reminder?.note || '准备完成'}\n\n`
  }
  
  // 晚上任务报告
  if (results.evening) {
    report += `🌙 晚上任务准备：\n`
    report += `   • 晚间提醒：已准备 ${results.evening.evening?.userCount || 0} 用户\n`
    report += `   • 状态：${results.evening.evening?.note || '准备完成'}\n\n`
  }
  
  // 总体统计
  report += `📈 总体统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `💡 说明：由于Hobby计划限制，中午和晚上的推送任务数据已准备，需要通过其他方式触发。\n\n`
  report += `✅ 任务执行完成！`
  
  return report
}

// 发送触发报告
async function sendTriggerReport(results, now, adminId) {
  try {
    const report = generateTriggerReport(results, now)
    
    const adminMessage = {
      chat_id: adminId,
      text: report
    }
    
    const adminResults = await sendBatchMessages([adminMessage])
    console.log(`[trigger:unified-cron] 触发报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[trigger:unified-cron] 发送触发报告失败:', e)
  }
}

// 生成触发报告
function generateTriggerReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `🚀 手动触发推送报告\n\n📅 触发日期：${date}\n⏰ 触发时间：${time}\n🎯 触发动作：${results.action}\n👨‍💼 触发者：${results.adminId}\n\n`
  
  // 根据动作生成相应的报告
  if (results.action === 'noon') {
    report += `🌞 中午推送执行结果：\n`
    if (results.details.reminder) {
      report += `   • 用户提醒：${results.details.reminder.success ? '✅ 成功' : '❌ 失败'} (${results.details.reminder.userCount || 0} 用户)\n`
    }
    if (results.details.daily) {
      report += `   • 每日报告：${results.details.daily.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.action === 'evening') {
    report += `🌙 晚间推送执行结果：\n`
    if (results.details.evening) {
      report += `   • 晚间提醒：${results.details.evening.success ? '✅ 成功' : '❌ 失败'} (${results.details.evening.userCount || 0} 用户)\n`
    }
    report += '\n'
  }
  
  // 总体统计
  report += `📈 推送统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `🚀 手动触发推送完成！`
  
  return report
}

// 发送任务报告
async function sendTaskReport(results, now, adminId) {
  try {
    const report = generateTaskReport(results, now)
    
    const adminMessage = {
      chat_id: adminId,
      text: report
    }
    
    const adminResults = await sendBatchMessages([adminMessage])
    console.log(`[specific-task] 任务报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[specific-task] 发送任务报告失败:', e)
  }
}

// 生成任务报告
function generateTaskReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `🔧 特定任务执行报告\n\n📅 执行日期：${date}\n⏰ 执行时间：${time}\n🎯 执行任务：${results.task}\n👨‍💼 执行者：${results.adminId}\n\n`
  
  // 根据任务类型生成相应的报告
  if (results.task === 'break-streaks') {
    report += `⏰ 断签清零执行结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.task === 'daily-report') {
    report += `📊 日报执行结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.task === 'morning-tasks') {
    report += `🌅 早晨任务执行结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.task === 'reminder') {
    report += `🔔 提醒执行结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
      if (results.details.userCount !== undefined) {
        report += `   • 用户数量：${results.details.userCount} 人\n`
      }
    }
    report += '\n'
  }
  
  report += `🔧 特定任务执行完成！`
  
  return report
}

// 新增：每日结算处理函数
async function handleDailySettlement(req, res, now) {
  console.log('[daily-settlement] 凌晨2点：开始执行每日结算...')
  
  const results = {
    action: 'daily-settlement',
    timestamp: now.toISOString(),
    hour: 2,
    breakStreaks: null,
    monthlyAutoPost: null,
    totalSent: 0,
    totalFailed: 0
  }
  
  try {
    // 1. 断签清零
    console.log('[daily-settlement] 执行断签清零...')
    results.breakStreaks = await breakStreaksOneShot()
    
    // 2. 每月1号自动入账
    const isFirstDayOfMonth = now.getDate() === 1
    if (isFirstDayOfMonth) {
      console.log('[daily-settlement] 执行月度自动入账...')
      results.monthlyAutoPost = await handleMonthlyAutoPost(now)
    }
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log('[daily-settlement] 每日结算完成')
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[daily-settlement] 执行失败:', error)
    results.error = error.message
    return res.status(500).json({ ok: false, error: error.message, results })
  }
}

// 新增：晨间推送处理函数
async function handleMorningPush(req, res, now) {
  console.log('[morning-push] 早上8点：开始执行晨间推送...')
  
  const results = {
    action: 'morning-push',
    timestamp: now.toISOString(),
    hour: 8,
    personal: null,
    branch: null,
    totalSent: 0,
    totalFailed: 0
  }
  
  try {
    // 1. 计算排行榜
    await computeLeaderboards(now)
    
    // 2. 推送个人理财报告
    console.log('[morning-push] 推送个人理财报告...')
    results.personal = await personalMorningReports(now, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a) => 
      formatTemplate(zh.cron.morning_rank, { income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a })
    )
    
    // 3. 推送分行排行榜
    console.log('[morning-push] 推送分行排行榜...')
    results.branch = await pushBranchLeaderboards(now, (code, stat) => 
      formatTemplate(zh.cron.branch_lead, { 
        code, 
        rate: stat.rate||0, 
        done: stat.done||0, 
        total: stat.total||0,
        avg7: stat.avg7||0
      })
    )
    
    // 汇总统计
    results.totalSent = (results.personal?.sent || 0) + (results.branch?.sent || 0)
    results.totalFailed = (results.personal?.failed || 0) + (results.branch?.failed || 0)
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log(`[morning-push] 晨间推送完成，发送：${results.totalSent}，失败：${results.totalFailed}`)
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[morning-push] 执行失败:', error)
    results.error = error.message
    return res.status(500).json({ ok: false, error: error.message, results })
  }
}

// 新增：晚间提醒处理函数
async function handleEveningReminder(req, res, now) {
  console.log('[evening-reminder] 晚上10点：开始执行晚间提醒...')
  
  const results = {
    action: 'evening-reminder',
    timestamp: now.toISOString(),
    hour: 22,
    userCount: 0,
    totalSent: 0,
    totalFailed: 0
  }
  
  try {
    // 获取今日未记录用户
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    results.userCount = usersWithoutRecord.length
    
    if (usersWithoutRecord.length === 0) {
      console.log('[evening-reminder] 所有用户都已记录，无需提醒')
      return res.status(200).json({ ok: true, message: 'All users have recorded today', results })
    }
    
    // 生成提醒消息
    const reminderMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateEveningReminder(chatId, now)
    }))
    
    // 批量发送提醒
    const sendResults = await sendBatchMessages(reminderMessages)
    results.totalSent = sendResults.sent || 0
    results.totalFailed = sendResults.failed || 0
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log(`[evening-reminder] 晚间提醒完成，提醒${results.userCount}用户，发送：${results.totalSent}，失败：${results.totalFailed}`)
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[evening-reminder] 执行失败:', error)
    results.error = error.message
    return res.status(500).json({ ok: false, error: error.message, results })
  }
}

// 每日Cron任务：在凌晨2点执行2AM+8AM功能
async function handleDailyCron(req, res, now) {
  console.log('[daily-cron] 凌晨2点Cron：执行2AM断签清零 + 8AM晨间推送...')
  
  const results = {
    action: 'daily-cron-2am-8am',
    timestamp: now.toISOString(),
    cronHour: now.getHours(),
    breakStreaks: null,        // 2AM: 断签清零
    monthlyAutoPost: null,     // 2AM: 月度入账
    morningPush: null,         // 8AM: 晨间推送
    totalSent: 0,
    totalFailed: 0
  }
  
  try {
    // 1. 凌晨2点逻辑：断签清零（基于2AM时间判断）
    console.log('[daily-cron] 执行断签清零（2AM逻辑）...')
    results.breakStreaks = await breakStreaksOneShot()
    
    // 2. 月度自动入账（每月1号）
    const isFirstDayOfMonth = now.getDate() === 1
    if (isFirstDayOfMonth) {
      console.log('[daily-cron] 执行月度自动入账...')
      results.monthlyAutoPost = await handleMonthlyAutoPost(now)
    }
    
    // 3. 8AM功能：晨间推送
    console.log('[daily-cron] 执行8AM晨间推送...')
    await computeLeaderboards(now)
    
    // 个人理财报告
    results.morningPush = {
      personal: await personalMorningReports(now, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a) => 
        formatTemplate(zh.cron.morning_rank, { income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a })
      ),
      // 分行排行榜
      branch: await pushBranchLeaderboards(now, (code, stat) => 
        formatTemplate(zh.cron.branch_lead, { 
          code, 
          rate: stat.rate||0, 
          done: stat.done||0, 
          total: stat.total||0,
          avg7: stat.avg7||0
        })
      )
    }
    
    // 汇总统计（只有2AM+8AM功能）
    results.totalSent = (results.morningPush?.personal?.sent || 0) + 
                       (results.morningPush?.branch?.sent || 0)
    results.totalFailed = (results.morningPush?.personal?.failed || 0) + 
                         (results.morningPush?.branch?.failed || 0)
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log(`[daily-cron] 每日Cron完成，发送：${results.totalSent}，失败：${results.totalFailed}`)
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[daily-cron] 执行失败:', error)
    results.error = error.message
    return res.status(500).json({ ok: false, error: error.message, results })
  }
} 