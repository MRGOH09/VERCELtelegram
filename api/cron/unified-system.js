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
    
    console.info(`[unified-system] 执行时间：${now.toISOString()}，小时：${hour}`)
    
    let results = {
      timestamp: now.toISOString(),
      hour: hour,
      action: null,
      totalSent: 0,
      totalFailed: 0
    }
    
    // 根据小时判断执行哪个任务
    switch (hour) {
      case 2:
        // 凌晨2点：每日结算
        results.action = 'daily-settlement'
        results.details = await executeDailySettlement(now)
        break
        
      case 8:
        // 早上8点：晨间推送 + 分行排名
        results.action = 'morning-push'
        results.details = await executeMorningPush(now)
        break
        
      case 22:
        // 晚上10点：晚间提醒
        results.action = 'evening-reminder'
        results.details = await executeEveningReminder(now)
        break
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unexpected execution hour: ${hour}`,
          expectedHours: [2, 8, 22]
        })
    }
    
    // 计算总发送和失败数
    if (results.details) {
      results.totalSent = (results.details.sent || 0) + (results.details.personal?.sent || 0) + (results.details.branch?.sent || 0)
      results.totalFailed = (results.details.failed || 0) + (results.details.personal?.failed || 0) + (results.details.branch?.failed || 0)
    }
    
    // 发送执行报告到管理员
    await sendAdminReport(results, now)
    
    console.info(`[unified-system] ${results.action} 执行完成，发送：${results.totalSent}，失败：${results.totalFailed}`)
    
    return res.status(200).json({ ok: true, results })
    
  } catch (e) {
    console.error('[unified-system] 执行失败:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

// 凌晨2点：每日结算
async function executeDailySettlement(now) {
  console.log('[daily-settlement] 开始执行每日结算...')
  
  const results = {
    type: 'daily-settlement',
    breakStreaks: null,
    monthlyAutoPost: null,
    missedDayNotification: null,
    timestamp: now.toISOString()
  }
  
  try {
    // 1. 给昨天未记录的用户发送通知
    console.log('[daily-settlement] 发送昨日未记录通知...')
    results.missedDayNotification = await sendMissedDayNotification(now)
    
    // 2. 断签清零（基于凌晨2点逻辑）
    console.log('[daily-settlement] 执行断签清零...')
    results.breakStreaks = await breakStreaksOneShot()
    
    // 3. 每月1号自动入账（如果是月初）
    const isFirstDayOfMonth = now.getDate() === 1
    if (isFirstDayOfMonth) {
      console.log('[daily-settlement] 执行月度自动入账...')
      results.monthlyAutoPost = await handleMonthlyAutoPost(now)
    }
    
    console.log('[daily-settlement] 每日结算完成')
    return results
    
  } catch (error) {
    console.error('[daily-settlement] 执行失败:', error)
    results.error = error.message
    return results
  }
}

// 早上8点：晨间推送 + 分行排名
async function executeMorningPush(now) {
  console.log('[morning-push] 开始执行晨间推送...')
  
  const results = {
    type: 'morning-push',
    personal: null,
    branch: null,
    sent: 0,
    failed: 0
  }
  
  try {
    // 1. 计算排行榜
    await computeLeaderboards(now)
    
    // 2. 推送个人理财报告
    console.log('[morning-push] 推送个人理财报告...')
    results.personal = await personalMorningReports(now, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a) => 
      formatTemplate(zh.cron.morning_rank, { income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a })
    )
    
    // 3. 推送分行排行榜（每天都推送）
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
    results.sent = (results.personal?.sent || 0) + (results.branch?.sent || 0)
    results.failed = (results.personal?.failed || 0) + (results.branch?.failed || 0)
    
    console.log(`[morning-push] 晨间推送完成，发送：${results.sent}，失败：${results.failed}`)
    return results
    
  } catch (error) {
    console.error('[morning-push] 执行失败:', error)
    results.error = error.message
    return results
  }
}

// 晚上10点：晚间提醒
async function executeEveningReminder(now) {
  console.log('[evening-reminder] 开始执行晚间提醒...')
  
  const results = {
    type: 'evening-reminder',
    userCount: 0,
    sent: 0,
    failed: 0
  }
  
  try {
    // 获取今日未记录用户
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    results.userCount = usersWithoutRecord.length
    
    if (usersWithoutRecord.length === 0) {
      console.log('[evening-reminder] 所有用户都已记录，无需提醒')
      return results
    }
    
    // 生成提醒消息
    const reminderMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateEveningReminder(now)
    }))
    
    // 批量发送提醒
    const sendResults = await sendBatchMessages(reminderMessages)
    results.sent = sendResults.sent || 0
    results.failed = sendResults.failed || 0
    
    console.log(`[evening-reminder] 晚间提醒完成，提醒${results.userCount}用户，发送：${results.sent}，失败：${results.failed}`)
    return results
    
  } catch (error) {
    console.error('[evening-reminder] 执行失败:', error)
    results.error = error.message
    return results
  }
}

// 月度自动入账
async function handleMonthlyAutoPost(now) {
  console.log('[monthly-auto-post] 开始执行月度自动入账...')
  
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
  
  console.log(`[monthly-auto-post] 月度自动入账完成，新增 ${insertedCount} 条记录`)
  return { insertedCount }
}

// 发送昨日未记录通知
async function sendMissedDayNotification(now) {
  console.log('[missed-day-notification] 开始发送昨日未记录通知...')
  
  // 计算昨天的日期（凌晨2点前都算前一天）
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const results = {
    type: 'missed-day-notification',
    userCount: 0,
    sent: 0,
    failed: 0
  }
  
  try {
    // 获取昨天未记录用户
    const usersWithoutRecord = await usersWithoutRecordToday(yesterday)
    results.userCount = usersWithoutRecord.length
    
    if (usersWithoutRecord.length === 0) {
      console.log('[missed-day-notification] 昨天所有用户都已记录，无需通知')
      return results
    }
    
    // 生成通知消息
    const notificationMessages = usersWithoutRecord.map(chatId => ({
      chat_id: chatId,
      text: generateMissedDayNotification(yesterday)
    }))
    
    // 批量发送通知
    const sendResults = await sendBatchMessages(notificationMessages)
    results.sent = sendResults.sent || 0
    results.failed = sendResults.failed || 0
    
    console.log(`[missed-day-notification] 昨日未记录通知完成，通知${results.userCount}用户，发送：${results.sent}，失败：${results.failed}`)
    return results
    
  } catch (error) {
    console.error('[missed-day-notification] 执行失败:', error)
    results.error = error.message
    return results
  }
}

// 生成昨日未记录通知消息
function generateMissedDayNotification(yesterday) {
  const date = yesterday.toISOString().slice(0, 10)
  
  return `💔 错过一天记录

📅 昨天（${date}）您没有记录任何开销

🔥 连续记录天数已重置为 0
😔 坚持了很久的打卡习惯断掉了...

💡 但是没关系！今天重新开始：
• 从今天开始重新计数
• 养成每日记账的好习惯
• 不要再让一天悄悄溜走

🚀 新的开始，从现在记录今天的第一笔开销！
💪 重新建立连续记录，加油！`
}

// 生成晚间提醒消息
function generateEveningReminder(now) {
  const date = now.toISOString().slice(0, 10)
  
  return `🌙 晚间提醒 (10:00 PM)

📅 今天是 ${date}
⏰ 一天即将结束

💡 您今天还没有记录任何开销哦！

🔥 不要让坚持多久的打卡习惯断掉！
💪 现在记录今天的支出，保持连续记录！

🚀 行动才会改变，马上记账吧！`
}

// 发送管理员报告
async function sendAdminReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[admin-report] 没有配置管理员ID，跳过admin报告')
      return
    }
    
    const report = generateAdminReport(results, now)
    
    const adminMessages = adminIds.map(chatId => ({
      chat_id: chatId,
      text: report
    }))
    
    const adminResults = await sendBatchMessages(adminMessages)
    console.log(`[admin-report] 报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[admin-report] 发送报告失败:', e)
  }
}

// 生成管理员报告
function generateAdminReport(results, now) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16)
  
  let report = `📊 统一系统执行报告\n\n📅 日期：${date}\n⏰ 时间：${time}\n🎯 任务：${results.action}\n\n`
  
  switch (results.action) {
    case 'daily-settlement':
      report += `🕐 每日结算 (2:00 AM)：\n`
      if (results.details.missedDayNotification) {
        report += `   • 昨日未记录通知：${results.details.missedDayNotification.userCount}人，发送${results.details.missedDayNotification.sent}，失败${results.details.missedDayNotification.failed}\n`
      }
      report += `   • 断签清零：${results.details.breakStreaks ? '已执行' : '执行失败'}\n`
      report += `   • 月度入账：${results.details.monthlyAutoPost ? `新增${results.details.monthlyAutoPost.insertedCount}条` : '跳过'}\n`
      break
      
    case 'morning-push':
      report += `🌅 晨间推送 (8:00 AM)：\n`
      report += `   • 个人报告：成功 ${results.details.personal?.sent || 0}，失败 ${results.details.personal?.failed || 0}\n`
      report += `   • 分行排名：成功 ${results.details.branch?.sent || 0}，失败 ${results.details.branch?.failed || 0}\n`
      report += `   • 总计：成功 ${results.totalSent}，失败 ${results.totalFailed}\n`
      break
      
    case 'evening-reminder':
      report += `🌙 晚间提醒 (10:00 PM)：\n`
      report += `   • 未记录用户：${results.details.userCount} 人\n`
      report += `   • 发送成功：${results.details.sent}\n`
      report += `   • 发送失败：${results.details.failed}\n`
      break
  }
  
  if (results.details?.error) {
    report += `\n❌ 错误信息：${results.details.error}`
  }
  
  report += `\n\n✅ 任务执行完成！`
  
  return report
}