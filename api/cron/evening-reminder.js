import { usersWithoutRecordToday } from '../../lib/cron-utils.js'
import { sendBatchMessages } from '../../lib/telegram.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    console.info(`[evening-reminder] 晚上10点：执行晚间提醒，时间：${now.toISOString()}`)
    
    const results = {
      action: 'evening-reminder',
      timestamp: now.toISOString(),
      hour: now.getHours(),
      userCount: 0,
      sent: 0,
      failed: 0
    }
    
    // 获取今日未记录用户
    const usersWithoutRecord = await usersWithoutRecordToday(now)
    results.userCount = usersWithoutRecord.length
    
    if (usersWithoutRecord.length === 0) {
      console.log('[evening-reminder] 所有用户都已记录，无需提醒')
      return res.status(200).json({ ok: true, message: 'All users recorded today', results })
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
    
    // 发送管理员报告
    await sendAdminReport(results, now)
    
    console.log(`[evening-reminder] 晚间提醒完成，提醒${results.userCount}用户，发送：${results.sent}，失败：${results.failed}`)
    return res.status(200).json({ ok: true, results })
    
  } catch (error) {
    console.error('[evening-reminder] 执行失败:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
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
      console.log('[admin-report] 没有配置管理员ID，跳过报告')
      return
    }
    
    const date = now.toISOString().slice(0, 10)
    const time = now.toISOString().slice(11, 16)
    
    let report = `🌙 晚间提醒报告 (10:00 PM)\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
    report += `👥 未记录用户：${results.userCount} 人\n`
    report += `✅ 发送成功：${results.sent}\n`
    report += `❌ 发送失败：${results.failed}\n\n`
    
    if (results.userCount === 0) {
      report += `🎉 今天所有用户都完成了记录！`
    } else {
      report += `💪 已提醒用户及时记录支出`
    }
    
    report += `\n\n✅ 晚间提醒完成！`
    
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