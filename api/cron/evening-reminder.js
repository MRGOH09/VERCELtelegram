import { usersWithoutRecordToday } from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'
import { isInSeptemberChallenge, addChallengeMessageToEveningReminder } from '../../lib/september-challenge-messages.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    console.info(`[evening-reminder] 晚上10点：执行晚间提醒，时间：${now.toISOString()}`)
    
    const results = {
      action: 'evening-reminder',
      timestamp: now.toISOString(),
      hour: now.getHours(),
      remindersSent: 0,
      remindersFailed: 0
    }
    
    // 获取今天还没有记录的用户
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    console.log(`[evening-reminder] 发现 ${usersWithoutRecord.length} 个用户今天还没有记录`)
    
    if (usersWithoutRecord.length === 0) {
      console.log('[evening-reminder] 所有用户今天都已记录，无需发送提醒')
      results.message = '所有用户今天都已记录'
      return res.status(200).json({ ok: true, results })
    }
    
    // 生成晚间提醒消息
    const reminderMessages = usersWithoutRecord.map(chatId => {
      let message = '🌙 晚间提醒\n\n你还没有记录任何开销哦，行动才会改变！\n\n💡 记录支出很简单：\n• 点击 /record 开始记录\n• 选择类别，输入金额即可\n\n🎯 坚持记录，管理财务！'
      
      // 如果在9月挑战期间，添加挑战消息
      if (isInSeptemberChallenge(now)) {
        message = addChallengeMessageToEveningReminder(message, now)
      }
      
      return {
        chat_id: chatId,
        text: message
      }
    })
    
    // 发送晚间提醒
    const sendResults = await sendBatchMessages(reminderMessages)
    results.remindersSent = sendResults.sent || 0
    results.remindersFailed = sendResults.failed || 0
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log(`[evening-reminder] 晚间提醒完成，发送：${results.remindersSent}，失败：${results.remindersFailed}`)
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[evening-reminder] 执行失败:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}

// 发送管理员报告
async function sendAdminReport(results, now) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    
    if (adminIds.length === 0) {
      console.log('[admin-report] 没有配置管理员ID，跳过报告')
      return
    }
    
    const date = now.toISOString().slice(0, 10)
    const time = now.toISOString().slice(11, 16)
    
    let report = `🌙 晚间提醒报告 (10:00 PM)\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
    report += `📊 提醒统计：\n`
    report += `✅ 成功发送：${results.remindersSent} 人\n`
    report += `❌ 发送失败：${results.remindersFailed} 人\n`
    report += `📈 总计：${results.remindersSent + results.remindersFailed} 人\n\n`
    
    if (results.remindersSent === 0) {
      report += `🎉 所有用户今天都已记录！`
    } else {
      report += `💪 ${results.remindersSent} 人收到记录提醒`
    }
    
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