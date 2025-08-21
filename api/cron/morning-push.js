import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports 
} from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    console.info(`[morning-push] 早上8点：执行晨间推送，时间：${now.toISOString()}`)
    
    const results = {
      action: 'morning-push',
      timestamp: now.toISOString(),
      hour: now.getHours(),
      personal: null,
      branch: null,
      totalSent: 0,
      totalFailed: 0
    }
    
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
    
    let report = `🌅 晨间推送报告 (8:00 AM)\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
    report += `📊 个人报告：成功 ${results.personal?.sent || 0}，失败 ${results.personal?.failed || 0}\n`
    report += `🏢 分行排名：成功 ${results.branch?.sent || 0}，失败 ${results.branch?.failed || 0}\n`
    report += `📈 总计：成功 ${results.totalSent}，失败 ${results.totalFailed}\n\n`
    report += `✅ 晨间推送完成！`
    
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