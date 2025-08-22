import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports 
} from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'
import supabase from '../../lib/supabase.js'
import { format } from 'date-fns'

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
    
    // 2. 推送个人理财报告 + 分行排行榜（合并发送）
    console.log('[morning-push] 推送个人理财报告 + 分行排行榜...')
    results.personal = await personalMorningReportsWithBranch(now)
    
    // 汇总统计（现在personal包含了分行排行榜）
    results.totalSent = results.personal?.sent || 0
    results.totalFailed = results.personal?.failed || 0
    results.branch = { sent: 0, failed: 0, note: '已合并到个人报告中' }
    
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

// 个人理财报告 + 分行排行榜合并发送
async function personalMorningReportsWithBranch(forDate) {
  // 1. 获取个人理财报告数据
  const personalResults = await personalMorningReports(forDate, (income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a) => 
    formatTemplate(zh.cron.morning_rank, { income, a, b, c, ra, rb, rc, completion, progress, streak, budget_a, budget_status_a })
  )
  
  // 2. 获取分行排行榜数据
  const branchRankings = await getBranchRankingsData(forDate)
  
  // 3. 获取用户分行信息
  const { data: userBranches } = await supabase
    .from('user_profile')
    .select('user_id,chat_id,branch_code')
    .not('branch_code', 'is', null)
  
  const userBranchMap = new Map()
  userBranches?.forEach(u => {
    userBranchMap.set(u.chat_id, u.branch_code)
  })
  
  // 4. 为每个用户的个人报告添加分行排行榜
  const enhancedMessages = personalResults.messages?.map(msg => {
    const userBranch = userBranchMap.get(msg.chat_id)
    const branchRanking = branchRankings.get(userBranch)
    
    if (branchRanking) {
      // 合并个人报告 + 分行排行榜
      msg.text = msg.text + '\n\n' + branchRanking
    }
    
    return msg
  }) || []
  
  // 5. 发送合并后的消息
  const sendResults = await sendBatchMessages(enhancedMessages)
  
  return {
    sent: sendResults.sent || 0,
    failed: sendResults.failed || 0,
    totalTime: sendResults.totalTime || 0,
    rate: sendResults.rate || 0
  }
}

// 获取分行排行榜数据
async function getBranchRankingsData(forDate) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  
  // 获取排行榜数据
  const { data: lb } = await supabase
    .from('leaderboard_daily')
    .select('branch_top_json')
    .eq('ymd', ymd)
    .maybeSingle()
  
  const branchTop = lb?.branch_top_json || []
  const map = new Map()
  
  for (const b of branchTop) {
    map.set(b.branch_code || b.branch || b.code, b)
  }
  
  // 近7天均值
  const since = new Date(forDate)
  since.setDate(since.getDate() - 6)
  
  const { data: seven } = await supabase
    .from('branch_daily')
    .select('branch_code,rate,ymd')
    .gte('ymd', format(since, 'yyyy-MM-dd'))
    .lte('ymd', ymd)
  
  const avgMap = new Map()
  for (const r of seven || []) {
    const k = r.branch_code
    const arr = avgMap.get(k) || []
    arr.push(Number(r.rate || 0))
    avgMap.set(k, arr)
  }
  
  // 生成分行排行榜消息
  const branchMessages = new Map()
  
  for (const [branchCode, stat] of map.entries()) {
    const arr = avgMap.get(branchCode) || []
    const avg7 = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : 0
    
    const branchText = formatTemplate(zh.cron.branch_lead, {
      code: branchCode,
      rate: stat.rate || 0,
      done: stat.done || 0,
      total: stat.total || 0,
      avg7: avg7
    })
    
    branchMessages.set(branchCode, branchText)
  }
  
  return branchMessages
}