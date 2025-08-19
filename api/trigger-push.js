import { todayYMD } from '../lib/time.js'
import { 
  usersWithoutRecordToday,
  dailyReports
} from '../lib/cron-utils.js'
import { zh } from '../lib/i18n.js'
import { formatTemplate } from '../lib/helpers.js'
import { sendBatchMessages } from '../lib/telegram.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { action, adminId } = req.body
    
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

    console.log(`[trigger-push] Admin ${adminId} 触发推送，动作：${action}`)
    
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
    
    console.log(`[trigger-push] 推送完成，结果：`, results)
    
    return res.status(200).json({ 
      ok: true, 
      message: `手动触发推送 ${action} 完成`,
      results 
    })
    
  } catch (e) {
    console.error('[trigger-push] 推送失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

async function executeNoonPush(now) {
  console.log('[trigger-push] 执行中午推送...')
  
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

async function executeEveningPush(now) {
  console.log('[trigger-push] 执行晚间推送...')
  
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

function generateEveningReminder(chatId, now) {
  return `🌙 晚间提醒\n\n📅 今天是 ${now.toISOString().slice(0, 10)}\n⏰ 现在是晚上 10:00\n💡 今天还没有记录支出哦！\n\n🌃 趁着晚上时间，记录一下今天的支出吧！\n💰 保持记录，管理财务！\n\n💪 记得记账哦！`
}

async function sendTriggerReport(results, now, adminId) {
  try {
    const report = generateTriggerReport(results, now)
    
    const adminMessage = {
      chat_id: adminId,
      text: report
    }
    
    const adminResults = await sendBatchMessages([adminMessage])
    console.log(`[trigger-push] 触发报告发送完成，成功: ${adminResults.sent}, 失败: ${adminResults.failed}`)
    
  } catch (e) {
    console.error('[trigger-push] 发送触发报告失败:', e)
  }
}

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