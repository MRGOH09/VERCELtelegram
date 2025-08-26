import webpush from 'web-push'
import supabase from './supabase.js'

// 配置VAPID
webpush.setVapidDetails(
  'mailto:support@learnerclub.com',
  process.env.NEXT_PUBLIC_FCM_VAPID_KEY || 'BHn7QgZMASGfPzs_t1h604Z5ku_HlpZufjZZgDO1qiPopryzLII_GaInmuHqiNMhypVkz99dy2ES8tknl8n-ncE',
  process.env.VAPID_PRIVATE_KEY || 'ipeX28Aw-OH1EVubf6M4P2azz3ijx5n6wp0Us7V6zEU'
)

// Web推送管理器
export class WebPushManager {
  constructor() {
    this.defaultOptions = {
      TTL: 24 * 60 * 60, // 24小时
      urgency: 'normal'
    }
  }

  // 发送单个推送通知
  async sendNotification(subscription, payload, options = {}) {
    try {
      const pushOptions = {
        ...this.defaultOptions,
        ...options
      }

      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        pushOptions
      )

      console.log('✅ Web推送发送成功')
      return { success: true, result }

    } catch (error) {
      console.error('❌ Web推送发送失败:', error)
      
      // 处理订阅失效的情况
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log('🗑️ 订阅已失效，准备清理')
        await this.cleanupInvalidSubscription(subscription.endpoint)
      }
      
      return { success: false, error: error.message }
    }
  }

  // 批量发送推送通知
  async sendBulkNotifications(subscriptions, payload, options = {}) {
    console.log(`📨 开始批量发送Web推送，目标用户: ${subscriptions.length}个`)
    
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    }

    // 并发发送（限制并发数避免超出API限制）
    const chunkSize = 10
    for (let i = 0; i < subscriptions.length; i += chunkSize) {
      const chunk = subscriptions.slice(i, i + chunkSize)
      
      const promises = chunk.map(async (sub) => {
        const result = await this.sendNotification(sub, payload, options)
        if (result.success) {
          results.sent++
        } else {
          results.failed++
          results.errors.push({
            endpoint: sub.endpoint,
            error: result.error
          })
        }
        return result
      })

      await Promise.all(promises)
    }

    console.log(`📊 Web推送批量发送完成: 成功${results.sent}, 失败${results.failed}`)
    return results
  }

  // 获取所有活跃的推送订阅
  async getActiveSubscriptions(userIds = null) {
    try {
      let query = supabase
        .from('push_subscriptions')
        .select('*')

      if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds)
      }

      const { data: subscriptions, error } = await query

      if (error) {
        console.error('❌ 获取推送订阅失败:', error)
        return []
      }

      console.log(`📋 获取到 ${subscriptions?.length || 0} 个活跃推送订阅`)
      
      // 转换为webpush格式
      return subscriptions?.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        },
        user_id: sub.user_id
      })) || []

    } catch (error) {
      console.error('❌ 获取推送订阅异常:', error)
      return []
    }
  }

  // 清理无效订阅
  async cleanupInvalidSubscription(endpoint) {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)

      if (error) {
        console.error('❌ 清理无效订阅失败:', error)
      } else {
        console.log('🧹 无效订阅清理成功')
      }
    } catch (error) {
      console.error('❌ 清理无效订阅异常:', error)
    }
  }

  // 为特定用户发送推送
  async sendToUsers(userIds, payload, options = {}) {
    const subscriptions = await this.getActiveSubscriptions(userIds)
    
    if (subscriptions.length === 0) {
      console.log('📭 没有找到活跃的推送订阅')
      return { sent: 0, failed: 0, errors: [] }
    }

    return await this.sendBulkNotifications(subscriptions, payload, options)
  }

  // 发送给所有订阅用户
  async sendToAll(payload, options = {}) {
    const subscriptions = await this.getActiveSubscriptions()
    
    if (subscriptions.length === 0) {
      console.log('📭 没有找到任何活跃的推送订阅')
      return { sent: 0, failed: 0, errors: [] }
    }

    return await this.sendBulkNotifications(subscriptions, payload, options)
  }
}

// 导出单例
export const webPushManager = new WebPushManager()

// 便捷函数
export async function sendWebPushNotification(userIds, title, body, options = {}) {
  const payload = {
    title,
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: options.tag || 'default',
    data: options.data || {},
    actions: options.actions || []
  }

  if (Array.isArray(userIds)) {
    return await webPushManager.sendToUsers(userIds, payload, options)
  } else if (userIds === 'all') {
    return await webPushManager.sendToAll(payload, options)
  } else {
    return await webPushManager.sendToUsers([userIds], payload, options)
  }
}

// 推送模板
export const pushTemplates = {
  morningReport: (userName, rank, amount) => ({
    title: '🌅 早安理财报告',
    body: `${userName}，昨日消费￥${amount}，排名第${rank}位！`,
    tag: 'morning-report',
    data: { type: 'morning-report' }
  }),

  dailyReminder: (userName, daysSinceStart) => ({
    title: '⏰ 记账提醒',
    body: `${userName}，今天还没记录支出，第${daysSinceStart}天挑战不能断！`,
    tag: 'daily-reminder',
    data: { type: 'daily-reminder' }
  }),

  rankUpdate: (userName, newRank, oldRank) => ({
    title: '🏆 排名更新',
    body: `${userName}，你的排名从第${oldRank}位上升到第${newRank}位！`,
    tag: 'rank-update',
    data: { type: 'rank-update' }
  })
}

export default webPushManager