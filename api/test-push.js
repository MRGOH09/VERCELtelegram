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
    const { action, testTime } = req.body
    
    if (!action) {
      return res.status(400).json({ 
        ok: false, 
        error: 'action is required',
        availableActions: ['morning', 'noon', 'evening', 'all', 'monthly', 'break-streaks']
      })
    }

    console.log(`[test-push] 开始测试推送，动作：${action}，测试时间：${testTime || 'now'}`)
    
    const now = testTime ? new Date(testTime) : new Date()
    const isFirstDayOfMonth = now.getDate() === 1
    
    let results = {
      action,
      testTime: now.toISOString(),
      timestamp: new Date().toISOString(),
      totalSent: 0,
      totalFailed: 0,
      details: {}
    }
    
    // 根据动作执行相应的测试
    switch (action) {
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
          availableActions: ['morning', 'noon', 'evening', 'all', 'monthly', 'break-streaks']
        })
    }
    
    // 计算总发送和失败数
    results.totalSent = calculateTotalSent(results.details)
    results.totalFailed = calculateTotalFailed(results.details)
    
    // 发送测试结果到 admin
    await sendTestReport(results, now)
    
    console.log(`[test-push] 测试完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `测试推送 ${action} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[test-push] 测试失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

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

async function testBreakStreaks(now) {
  console.log('[test] 测试断签清零...')
  
  try {
    const result = await breakStreaksOneShot()
    return { success: true, result }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function testAllTasks(now, isFirstDayOfMonth) {
  console.log('[test] 测试所有任务...')
  
  const results = {}
  
  // 测试所有任务
  results.morning = await testMorningTasks(now, isFirstDayOfMonth)
  results.noon = await testNoonTasks(now)
  results.evening = await testEveningTasks(now)
  
  return results
}

function generateTestReminder(chatId, now) {
  return `🧪 测试提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n💡 这是一条测试提醒消息！\n\n💰 今日进度：\n• 开销：RM 0.00\n• 学习：RM 0.00\n• 储蓄：RM 0.00\n\n📊 本月占比：\n• 开销：0%\n• 学习：0%\n• 储蓄：0%\n\n🎯 这是一条测试消息，请忽略！`
}

function generateTestEveningReminder(chatId, now) {
  return `🧪 测试晚间提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n⏰ 现在是晚上 10:00\n💡 这是一条测试晚间提醒！\n\n🌃 这是一条测试消息，请忽略！\n💰 保持记录，管理财务！\n\n💪 记得记账哦！`
}

function calculateTotalSent(details) {
  let total = 0
  
  if (details.branchLeaderboards?.result?.sent) total += details.branchLeaderboards.result.sent
  if (details.personalReports?.result?.sent) total += details.personalReports.result.sent
  if (details.reminder?.result?.sent) total += details.reminder.result.sent
  if (details.dailyReports?.result?.sent) total += details.dailyReports.result.sent
  if (details.eveningReminder?.result?.sent) total += details.eveningReminder.result.sent
  
  return total
}

function calculateTotalFailed(details) {
  let total = 0
  
  if (details.branchLeaderboards?.result?.failed) total += details.branchLeaderboards.result.failed
  if (details.personalReports?.result?.failed) total += details.personalReports.result.failed
  if (details.reminder?.result?.failed) total += details.reminder.result.failed
  if (details.dailyReports?.result?.failed) total += details.dailyReports.result.failed
  if (details.eveningReminder?.result?.failed) total += details.eveningReminder.result.failed
  
  return total
}

async function sendTestReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[test-admin] 没有配置管理员ID，跳过测试报告')
      return
    }
    
    const report = generateTestReport(results, now)
    
    const adminMessages = adminIds.map(chatId => ({
      chat_id: chatId,
      text: report
    }))
    
    const adminResults = await sendBatchMessages(adminMessages)
    console.log(`[test-admin] 测试报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[test-admin] 发送测试报告失败:', e)
  }
}

function generateTestReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `🧪 推送功能测试报告\n\n📅 测试日期：${date}\n⏰ 测试时间：${time}\n🎯 测试动作：${results.action}\n\n`
  
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
  
  // 总体统计
  report += `📈 测试统计：\n`
  report += `   • 总发送：${results.totalSent}\n`
  report += `   • 总失败：${results.totalFailed}\n`
  report += `   • 成功率：${results.totalSent + results.totalFailed > 0 ? ((results.totalSent / (results.totalSent + results.totalFailed)) * 100).toFixed(1) : 0}%\n\n`
  
  report += `🧪 测试完成！请检查实际效果。`
  
  return report
} 