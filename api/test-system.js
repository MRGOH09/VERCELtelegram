import { todayYMD } from '../lib/time.js'
import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports, 
  breakStreaksOneShot,
  usersWithoutRecordToday,
  dailyReports
} from '../lib/cron-utils.js'
import supabase from '../lib/supabase.js'
import { zh } from '../lib/i18n.js'
import { formatTemplate } from '../lib/helpers.js'
import { sendBatchMessages } from '../lib/telegram.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { action, adminId, type, userId, testType } = req.body
    
    if (!action) {
      return res.status(400).json({ 
        ok: false, 
        error: 'action is required',
        availableActions: ['morning', 'noon', 'evening', 'all', 'monthly', 'break-streaks', 'quick-test', 'test-push']
      })
    }

    // 类型1：公开推送测试（不需要adminId，但需要userId）
    if (action === 'test-push' && userId) {
      return await handlePublicPushTest(req, res, userId, testType)
    }

    // 类型2：普通测试（不需要adminId）
    if (type === 'public' || (!adminId && action === 'quick-test')) {
      return await handlePublicTest(req, res, action)
    }

    // 类型3：Admin测试（需要adminId）
    if (adminId) {
      return await handleAdminTest(req, res, action, adminId)
    }

    // 默认：普通测试
    return await handlePublicTest(req, res, action)
    
  } catch (e) {
    console.error('[test-system] 测试失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 公开推送测试模式
async function handlePublicPushTest(req, res, userId, testType) {
  try {
    console.log(`[public-push-test] 用户 ${userId} 开始测试推送，类型：${testType}`)
    
    if (!testType) {
      return res.status(400).json({ 
        ok: false, 
        error: 'testType is required for push test',
        availableTestTypes: ['reminder', 'daily-report', 'evening-reminder', 'quick-message']
      })
    }

    const now = new Date()
    
    let results = {
      action: 'test-push',
      type: 'public-push',
      userId,
      testType,
      testTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      success: false,
      details: {}
    }
    
    // 根据测试类型执行相应的推送测试
    switch (testType) {
      case 'reminder':
        results.details = await testReminderPush(now, userId)
        break
        
      case 'daily-report':
        results.details = await testDailyReportPush(now, userId)
        break
        
      case 'evening-reminder':
        results.details = await testEveningReminderPush(now, userId)
        break
        
      case 'quick-message':
        results.details = await testQuickMessagePush(now, userId)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown testType: ${testType}`,
          availableTestTypes: ['reminder', 'daily-report', 'evening-reminder', 'quick-message']
        })
    }
    
    results.success = results.details.success
    
    console.log(`[public-push-test] 推送测试完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `公开推送测试 ${testType} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[public-push-test] 推送测试失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 测试提醒推送
async function testReminderPush(now, userId) {
  console.log('[public-push-test] 测试提醒推送...')
  
  try {
    // 生成测试提醒消息
    const testMessage = generateTestReminderMessage(now, userId)
    
    // 发送到指定用户
    const result = await sendBatchMessages([{
      chat_id: userId,
      text: testMessage
    }])
    
    return { 
      success: true, 
      result,
      message: '提醒推送测试消息已发送',
      messageContent: testMessage
    }
  } catch (e) {
    return { 
      success: false, 
      error: e.message 
    }
  }
}

// 测试日报推送
async function testDailyReportPush(now, userId) {
  console.log('[public-push-test] 测试日报推送...')
  
  try {
    // 生成测试日报消息
    const testMessage = generateTestDailyReportMessage(now, userId)
    
    // 发送到指定用户
    const result = await sendBatchMessages([{
      chat_id: userId,
      text: testMessage
    }])
    
    return { 
      success: true, 
      result,
      message: '日报推送测试消息已发送',
      messageContent: testMessage
    }
  } catch (e) {
    return { 
      success: false, 
      error: e.message 
    }
  }
}

// 测试晚间提醒推送
async function testEveningReminderPush(now, userId) {
  console.log('[public-push-test] 测试晚间提醒推送...')
  
  try {
    // 生成测试晚间提醒消息
    const testMessage = generateTestEveningReminderMessage(now, userId)
    
    // 发送到指定用户
    const result = await sendBatchMessages([{
      chat_id: userId,
      text: testMessage
    }])
    
    return { 
      success: true, 
      result,
      message: '晚间提醒推送测试消息已发送',
      messageContent: testMessage
    }
  } catch (e) {
    return { 
      success: false, 
      error: e.message 
    }
  }
}

// 测试快速消息推送
async function testQuickMessagePush(now, userId) {
  console.log('[public-push-test] 测试快速消息推送...')
  
  try {
    // 生成测试快速消息
    const testMessage = generateTestQuickMessage(now, userId)
    
    // 发送到指定用户
    const result = await sendBatchMessages([{
      chat_id: userId,
      text: testMessage
    }])
    
    return { 
      success: true, 
      result,
      message: '快速消息推送测试消息已发送',
      messageContent: testMessage
    }
  } catch (e) {
    return { 
      success: false, 
      error: e.message 
    }
  }
}

// 生成测试提醒消息
function generateTestReminderMessage(now, userId) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  return `🧪 测试提醒推送\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n👤 测试用户：${userId}\n\n💰 今日进度：\n• 开销：RM 0.00\n• 学习：RM 0.00\n• 储蓄：RM 0.00\n\n📊 本月占比：\n• 开销：0%\n• 学习：0%\n• 储蓄：0%\n\n🎯 这是一条测试提醒消息！\n💡 用于验证推送系统是否正常工作\n\n✅ 如果您收到这条消息，说明推送系统正常！`
}

// 生成测试日报消息
function generateTestDailyReportMessage(now, userId) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  return `🧪 测试日报推送\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n👤 测试用户：${userId}\n\n📊 今日统计：\n• 开销：RM 0.00 (0%)\n• 学习：RM 0.00 (0%)\n• 储蓄：RM 0.00 (0%)\n• 旅行：RM 0.00\n\n🎯 这是一条测试日报消息！\n💡 用于验证日报推送功能\n\n✅ 如果您收到这条消息，说明日报推送系统正常！`
}

// 生成测试晚间提醒消息
function generateTestEveningReminderMessage(now, userId) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  return `🧪 测试晚间提醒推送\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n👤 测试用户：${userId}\n\n🌙 晚间提醒测试：\n💡 这是一条测试晚间提醒消息！\n\n🌃 用于验证晚间推送功能\n💰 保持记录，管理财务！\n\n💪 记得记账哦！\n\n✅ 如果您收到这条消息，说明晚间推送系统正常！`
}

// 生成测试快速消息
function generateTestQuickMessage(now, userId) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  return `🧪 测试快速消息推送\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n👤 测试用户：${userId}\n\n⚡ 快速消息测试：\n💡 这是一条测试快速消息！\n\n🎯 用于验证快速推送功能\n🚀 测试推送系统的响应速度\n\n✅ 如果您收到这条消息，说明快速推送系统正常！\n\n💡 您可以继续测试其他功能：\n• reminder - 提醒推送\n• daily-report - 日报推送\n• evening-reminder - 晚间提醒\n• quick-message - 快速消息`
}

// 普通测试模式
async function handlePublicTest(req, res, action) {
  try {
    console.log(`[public-test] 开始普通测试，动作：${action}`)
    
    const now = new Date()
    const isFirstDayOfMonth = now.getDate() === 1
    
    let results = {
      action,
      type: 'public',
      testTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      totalSent: 0,
      totalFailed: 0,
      details: {}
    }
    
    // 根据动作执行相应的测试
    switch (action) {
      case 'quick-test':
        results.details = await quickTest(now)
        break
        
      case 'morning':
        results.details = await testMorningTasks(now, isFirstDayOfMonth)
        break
        
      case 'noon':
        results.details = await testNoonTasks(now)
        break
        
      case 'evening':
        results.details = await testEveningTasks(now)
        break
        
      case 'monthly':
        results.details = await testMonthlyAutoPost(now)
        break
        
      case 'break-streaks':
        results.details = await testBreakStreaks(now)
        break
        
      case 'all':
        results.details = await testAllTasks(now, isFirstDayOfMonth)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown action: ${action}`,
          availableActions: ['morning', 'noon', 'evening', 'all', 'monthly', 'break-streaks', 'quick-test']
        })
    }
    
    // 计算总发送和失败数
    results.totalSent = calculateTotalSent(results.details)
    results.totalFailed = calculateTotalFailed(results.details)
    
    console.log(`[public-test] 测试完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `普通测试 ${action} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[public-test] 测试失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// Admin测试模式
async function handleAdminTest(req, res, action, adminId) {
  try {
    if (!adminId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'adminId is required for admin tests'
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

    console.log(`[admin-test] Admin ${adminId} 开始测试推送，动作：${action}`)
    
    const now = new Date()
    const isFirstDayOfMonth = now.getDate() === 1
    
    let results = {
      action,
      type: 'admin',
      adminId,
      testTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      totalSent: 0,
      totalFailed: 0,
      details: {}
    }
    
    // 根据动作执行相应的测试
    switch (action) {
      case 'quick-test':
        results.details = await quickTest(now, adminId)
        break
        
      case 'morning':
        results.details = await testMorningTasks(now, isFirstDayOfMonth)
        break
        
      case 'noon':
        results.details = await testNoonTasks(now)
        break
        
      case 'evening':
        results.details = await testEveningTasks(now)
        break
        
      case 'monthly':
        results.details = await testMonthlyAutoPost(now)
        break
        
      case 'break-streaks':
        results.details = await testBreakStreaks(now)
        break
        
      case 'all':
        results.details = await testAllTasks(now, isFirstDayOfMonth)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown action: ${action}`,
          availableActions: ['morning', 'noon', 'evening', 'all', 'monthly', 'break-streaks', 'quick-test']
        })
    }
    
    // 计算总发送和失败数
    results.totalSent = calculateTotalSent(results.details)
    results.totalFailed = calculateTotalFailed(results.details)
    
    // 发送测试结果到 Admin
    await sendAdminTestReport(results, now, adminId)
    
    console.log(`[admin-test] 测试完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `Admin测试推送 ${action} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[admin-test] 测试失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 快速测试
async function quickTest(now, adminId = null) {
  console.log('[quick-test] 快速测试...')
  
  if (adminId) {
    // Admin快速测试：只向管理员发送一条测试消息
    const testMessage = `🧪 Admin 快速测试\n\n📅 测试时间：${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 16)}\n🎯 测试动作：快速测试\n\n✅ 推送系统正常工作！\n\n💡 您可以继续测试其他功能：\n• morning - 早晨任务\n• noon - 中午任务\n• evening - 晚间任务\n• all - 所有任务`
    
    try {
      const result = await sendBatchMessages([{
        chat_id: adminId,
        text: testMessage
      }])
      
      return { 
        success: true, 
        result,
        message: '快速测试消息已发送到管理员'
      }
    } catch (e) {
      return { 
        success: false, 
        error: e.message 
      }
    }
  } else {
    // 普通快速测试：返回系统状态
    return { 
      success: true, 
      message: '系统测试完成，功能正常',
      systemStatus: 'OK'
    }
  }
}

// 测试早晨任务
async function testMorningTasks(now, isFirstDayOfMonth) {
  console.log('[test] 测试早晨任务...')
  
  const results = {}
  
  // 测试断签清零
  try {
    const breakStreaksResult = await breakStreaksOneShot()
    results.breakStreaks = { success: true, result: breakStreaksResult }
  } catch (e) {
    results.breakStreaks = { success: false, error: e.message }
  }
  
  // 测试月度自动入账
  if (isFirstDayOfMonth) {
    try {
      const autoPostResult = await testMonthlyAutoPost(now)
      results.monthlyAutoPost = { success: true, result: autoPostResult }
    } catch (e) {
      results.monthlyAutoPost = { success: false, error: e.message }
    }
  } else {
    results.monthlyAutoPost = { skipped: true, reason: 'Not first day of month' }
  }
  
  // 测试排行榜计算
  try {
    await computeLeaderboards(now)
    results.leaderboards = { success: true }
  } catch (e) {
    results.leaderboards = { success: false, error: e.message }
  }
  
  // 测试分行排行榜推送
  try {
    const branchResults = await pushBranchLeaderboards(now, (code, stat) => 
      formatTemplate(zh.cron.branch_lead, { 
        code, 
        rate: stat.rate||0, 
        done: stat.done||0, 
        total: stat.total||0 
      })
    )
    results.branchLeaderboards = { success: true, result: branchResults }
  } catch (e) {
    results.branchLeaderboards = { success: false, error: e.message }
  }
  
  // 测试个人排名推送
  try {
    const personalResults = await personalMorningReports(now, (myRank, topText) => 
      formatTemplate(zh.cron.morning_rank, { rank: myRank, top: topText })
    )
    results.personalReports = { success: true, result: personalResults }
  } catch (e) {
    results.personalReports = { success: false, error: e.message }
  }
  
  return results
}

// 测试中午任务
async function testNoonTasks(now) {
  console.log('[test] 测试中午任务...')
  
  const results = {}
  
  // 测试用户提醒
  try {
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    const reminderMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateTestReminder(chatId, now)
    }))
    
    const reminderResults = await sendBatchMessages(reminderMessages)
    results.reminder = { success: true, result: reminderResults, userCount: usersWithoutRecord.length }
  } catch (e) {
    results.reminder = { success: false, error: e.message }
  }
  
  // 测试日报推送
  try {
    const dailyResults = await dailyReports(now, ({a,b,c, ra, rb, rc, travel}) =>
      formatTemplate(zh.cron.daily_report, { 
        a: a.toFixed?.(2) || a, 
        b: b.toFixed?.(2) || b, 
        c: c.toFixed?.(2) || c, 
        ra, rb, rc, travel 
      })
    )
    results.dailyReports = { success: true, result: dailyResults }
  } catch (e) {
    results.dailyReports = { success: false, error: e.message }
  }
  
  return results
}

// 测试晚间任务
async function testEveningTasks(now) {
  console.log('[test] 测试晚上任务...')
  
  const results = {}
  
  // 测试晚间提醒
  try {
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    const eveningMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateTestEveningReminder(chatId, now)
    }))
    
    const eveningResults = await sendBatchMessages(eveningMessages)
    results.eveningReminder = { success: true, result: eveningResults, userCount: usersWithoutRecord.length }
  } catch (e) {
    results.eveningReminder = { success: false, error: e.message }
  }
  
  return results
}

// 测试月度自动入账
async function testMonthlyAutoPost(now) {
  console.log('[test] 测试月度自动入账...')
  
  const yyyymm = now.toISOString().slice(0,7)
  const ymd = `${yyyymm}-01`
  
  const { data: profs } = await supabase
    .from('user_profile')
    .select('user_id,travel_budget_annual,annual_medical_insurance,annual_car_insurance')
  
  let insertedCount = 0
  let skippedCount = 0
  
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
          note: 'Auto-post (TEST)', 
          ymd 
        }])
        insertedCount++
      } else {
        skippedCount++
      }
    }
  }
  
  return { insertedCount, skippedCount, totalUsers: profs?.length || 0 }
}

// 测试断签清零
async function testBreakStreaks(now) {
  console.log('[test] 测试断签清零...')
  
  try {
    const result = await breakStreaksOneShot()
    return { success: true, result }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// 测试所有任务
async function testAllTasks(now, isFirstDayOfMonth) {
  console.log('[test] 测试所有任务...')
  
  const results = {}
  
  // 测试所有任务
  results.morning = await testMorningTasks(now, isFirstDayOfMonth)
  results.noon = await testNoonTasks(now)
  results.evening = await testEveningTasks(now)
  
  return results
}

// 生成测试提醒
function generateTestReminder(chatId, now) {
  return `🧪 测试提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n💡 这是一条测试提醒消息！\n\n💰 今日进度：\n• 开销：RM 0.00\n• 学习：RM 0.00\n• 储蓄：RM 0.00\n\n📊 本月占比：\n• 开销：0%\n• 学习：0%\n• 储蓄：0%\n\n🎯 这是一条测试消息，请忽略！`
}

// 生成测试晚间提醒
function generateTestEveningReminder(chatId, now) {
  return `🧪 测试晚间提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n⏰ 现在是晚上 10:00\n💡 这是一条测试晚间提醒！\n\n🌃 这是一条测试消息，请忽略！\n💰 保持记录，管理财务！\n\n💪 记得记账哦！`
}

// 计算总发送数
function calculateTotalSent(details) {
  let total = 0
  
  if (details.branchLeaderboards?.result?.sent) total += details.branchLeaderboards.result.sent
  if (details.personalReports?.result?.sent) total += details.personalReports.result.sent
  if (details.reminder?.result?.sent) total += details.reminder.result.sent
  if (details.dailyReports?.result?.sent) total += details.dailyReports.result.sent
  if (details.eveningReminder?.result?.sent) total += details.eveningReminder.result.sent
  
  return total
}

// 计算总失败数
function calculateTotalFailed(details) {
  let total = 0
  
  if (details.branchLeaderboards?.result?.failed) total += details.branchLeaderboards.result.failed
  if (details.personalReports?.result?.failed) total += details.personalReports.result.failed
  if (details.reminder?.result?.failed) total += details.reminder.result.failed
  if (details.dailyReports?.result?.failed) total += details.dailyReports.result.failed
  if (details.eveningReminder?.result?.failed) total += details.eveningReminder.result.failed
  
  return total
}

// 发送Admin测试报告
async function sendAdminTestReport(results, now, adminId) {
  try {
    const report = generateAdminTestReport(results, now)
    
    const adminMessage = {
      chat_id: adminId,
      text: report
    }
    
    const adminResults = await sendBatchMessages([adminMessage])
    console.log(`[admin-test] Admin测试报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[admin-test] 发送Admin测试报告失败:', e)
  }
}

// 生成Admin测试报告
function generateAdminTestReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `🧪 Admin 推送功能测试报告\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n🎯 测试动作：${results.action}\n👨‍💼 测试者：${results.adminId}\n\n`
  
  // 根据动作生成相应的报告
  if (results.action === 'morning' || results.action === 'all') {
    report += `🌅 早晨任务测试结果：\n`
    if (results.details.breakStreaks) {
      report += `   • 断签清零：${results.details.breakStreaks.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    if (results.details.monthlyAutoPost) {
      if (results.details.monthlyAutoPost.skipped) {
        report += `   • 月度入账：⏭️ 跳过 (${results.details.monthlyAutoPost.reason})\n`
      } else {
        report += `   • 月度入账：${results.details.monthlyAutoPost.success ? '✅ 成功' : '❌ 失败'}\n`
      }
    }
    if (results.details.leaderboards) {
      report += `   • 排行榜计算：${results.details.leaderboards.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    if (results.details.branchLeaderboards) {
      report += `   • 分行排行：${results.details.branchLeaderboards.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    if (results.details.personalReports) {
      report += `   • 个人排名：${results.details.personalReports.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.action === 'noon' || results.action === 'all') {
    report += `🌞 中午任务测试结果：\n`
    if (results.details.reminder) {
      report += `   • 用户提醒：${results.details.reminder.success ? '✅ 成功' : '❌ 失败'} (${results.details.reminder.userCount || 0} 用户)\n`
    }
    if (results.details.dailyReports) {
      report += `   • 每日报告：${results.details.dailyReports.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.action === 'evening' || results.action === 'all') {
    report += `🌙 晚上任务测试结果：\n`
    if (results.details.eveningReminder) {
      report += `   • 晚间提醒：${results.details.eveningReminder.success ? '✅ 成功' : '❌ 失败'} (${results.details.eveningReminder.userCount || 0} 用户)\n`
    }
    report += '\n'
  }
  
  if (results.action === 'monthly') {
    report += `📅 月度任务测试结果：\n`
    if (results.details.insertedCount !== undefined) {
      report += `   • 新增记录：${results.details.insertedCount} 条\n`
      report += `   • 跳过记录：${results.details.skippedCount} 条\n`
      report += `   • 总用户数：${results.details.totalUsers} 人\n`
    }
    report += '\n'
  }
  
  if (results.action === 'break-streaks') {
    report += `⏰ 断签清零测试结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
    }
    report += '\n'
  }
  
  if (results.action === 'quick-test') {
    report += `⚡ 快速测试结果：\n`
    if (results.details.success !== undefined) {
      report += `   • 执行结果：${results.details.success ? '✅ 成功' : '❌ 失败'}\n`
      if (results.details.message) {
        report += `   • 消息：${results.details.message}\n`
      }
    }
    report += '\n'
  }
  
  // 总体统计
  report += `📈 测试统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `🧪 Admin测试完成！请检查实际效果。`
  
  return report
} 