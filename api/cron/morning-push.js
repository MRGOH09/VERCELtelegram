import { 
  computeLeaderboards, 
  pushBranchLeaderboards, 
  personalMorningReports,
  personalMorningReportsWithBranch
} from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { sendBatchMessages } from '../../lib/telegram.js'
import supabase from '../../lib/supabase.js'
import { format } from 'date-fns'
import { addChallengeMessageToMorningRank, isInSeptemberChallenge } from '../../lib/september-challenge-messages.js'

export default async function handler(req, res) {
  try {
    const now = new Date()
    console.info(`[morning-push] 早上10点：执行晨间推送，时间：${now.toISOString()}`)
    
    const results = {
      action: 'morning-push',
      timestamp: now.toISOString(),
      hour: now.getHours(),
      personal: null,
      branch: null,
      webPush: null,
      totalSent: 0,
      totalFailed: 0
    }
    
    // 1. 计算排行榜
    await computeLeaderboards(now)
    
    // 2. 推送个人理财报告 + 分行排行榜（合并发送）
    console.log('[morning-push] 推送个人理财报告 + 分行排行榜...')
    results.personal = await personalMorningReportsWithBranch(now)
    
    // 3. 同步发送Web推送通知
    console.log('[morning-push] 发送Web推送通知...')
    results.webPush = await sendWebPushMorningReport(now)
    
    // 汇总统计（现在personal包含了分行排行榜）
    results.totalSent = (results.personal?.sent || 0) + (results.webPush?.sent || 0)
    results.totalFailed = (results.personal?.failed || 0) + (results.webPush?.failed || 0)
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
    
    let report = `🌅 晨间推送报告 (10:00 AM)\n\n📅 日期：${date}\n⏰ 时间：${time}\n\n`
    report += `📊 个人报告：成功 ${results.personal?.sent || 0}，失败 ${results.personal?.failed || 0}\n`
    report += `🏢 分行排名：成功 ${results.branch?.sent || 0}，失败 ${results.branch?.failed || 0}\n`
    report += `📱 Web推送：成功 ${results.webPush?.sent || 0}，失败 ${results.webPush?.failed || 0}\n`
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

// 发送Web推送晨间报告
async function sendWebPushMorningReport(now) {
  try {
    // 动态导入web-push模块
    const { sendWebPushNotification, pushTemplates } = await import('../../lib/web-push.js')
    
    console.log('[webPush] 开始发送晨间Web推送...')
    
    // 获取所有活跃用户的基本信息（包含个性化提醒需要的数据）
    const { data: activeUsers, error: userError } = await supabase
      .from('users')
      .select(`
        id, name, created_at,
        user_profile(last_record, display_name, current_streak),
        push_subscriptions!inner(id)
      `)
      .eq('status', 'active')
      .not('push_subscriptions.id', 'is', null)
    
    if (userError) {
      console.error('[webPush] 查询用户失败:', userError)
      return { sent: 0, failed: 1, error: userError.message }
    }
    
    if (!activeUsers || activeUsers.length === 0) {
      console.log('[webPush] 没有找到启用推送的活跃用户')
      return { sent: 0, failed: 0, note: '无推送订阅用户' }
    }
    
    console.log(`[webPush] 找到 ${activeUsers.length} 个启用推送的用户`)
    
    let totalSent = 0
    let totalFailed = 0
    
    // 动态导入个性化提醒模块
    const { 
      generatePersonalizedPushNotification, 
      calculateDaysSinceLastRecord 
    } = await import('../../lib/web-push-reminders.js')

    // 获取今日已记录用户列表
    const todayYmd = now.toISOString().slice(0, 10)
    const { data: todayRecords } = await supabase
      .from('records')
      .select('user_id')
      .eq('ymd', todayYmd)
      .eq('is_voided', false)
    
    const todayRecordedUsers = new Set((todayRecords || []).map(r => r.user_id))

    // 为每个用户发送个性化推送
    for (const user of activeUsers) {
      try {
        // 计算用户注册天数
        const createdAt = new Date(user.created_at || now)
        const daysSinceStart = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24))
        
        // 计算距离上次记录的天数
        const daysSinceLast = calculateDaysSinceLastRecord(
          user.user_profile?.last_record, 
          now
        )
        
        // 检查今天是否已记录
        const hasRecordToday = todayRecordedUsers.has(user.id)
        
        // 获取连续记录天数
        const streak = user.user_profile?.current_streak || 0
        
        // 生成个性化推送内容
        const pushData = generatePersonalizedPushNotification(
          {
            id: user.id,
            name: user.name,
            display_name: user.user_profile?.display_name
          },
          daysSinceStart,
          daysSinceLast,
          hasRecordToday,
          streak
        )
        
        console.log(`[webPush] 用户 ${user.name}: ${daysSinceStart}天注册, ${daysSinceLast}天未记录, 今日${hasRecordToday?'已':'未'}记录, 连续${streak}天`)
        
        // 发送个性化推送
        const result = await sendWebPushNotification(
          user.id,
          pushData.title,
          pushData.body,
          pushData.options
        )
        
        if (result.sent > 0) {
          totalSent++
        } else {
          totalFailed++
        }
        
      } catch (error) {
        console.error(`[webPush] 发送给用户 ${user.name} 失败:`, error)
        totalFailed++
      }
    }
    
    console.log(`[webPush] 晨间Web推送完成: 成功${totalSent}, 失败${totalFailed}`)
    return { sent: totalSent, failed: totalFailed }
    
  } catch (error) {
    console.error('[webPush] 晨间Web推送异常:', error)
    return { sent: 0, failed: 1, error: error.message }
  }
}

