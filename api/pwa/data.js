import supabase from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, subscription, service, deviceInfo } = req.body

    switch (action) {
      case 'subscribe-push':
        return await handlePushSubscribe(req, res, subscription, service, deviceInfo)
      
      case 'unsubscribe-push':
        return await handlePushUnsubscribe(req, res)
      
      case 'test-push-notification':
        return await handleTestPushNotification(req, res)
      
      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
    
  } catch (error) {
    console.error('[PWA Data API] 错误:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理推送订阅
async function handlePushSubscribe(req, res, subscription, service, deviceInfo) {
  try {
    // 从cookies中获取用户ID
    const cookies = req.headers.cookie
    let userId = null
    
    if (cookies) {
      const cookieObj = {}
      cookies.split(';').forEach(cookie => {
        const [key, value] = cookie.trim().split('=')
        cookieObj[key] = value
      })
      
      // 假设auth token中包含用户ID或者通过user_name cookie获取
      if (cookieObj.user_name) {
        // 通过用户名查找用户ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('name', decodeURIComponent(cookieObj.user_name))
          .single()
        
        if (!userError && user) {
          userId = user.id
        }
      }
    }
    
    if (!userId) {
      console.log('[PWA] 用户未认证，cookies:', cookies)
      return res.status(401).json({ error: 'User not authenticated' })
    }

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    console.log(`[PWA] 用户 ${userId} 订阅推送通知`)
    
    // 保存推送订阅到数据库
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers['user-agent'],
        device_info: deviceInfo || null,
        last_used: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      })

    if (error) {
      console.error('[PWA] 保存推送订阅失败:', error)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }

    console.log('✅ [PWA] 推送订阅保存成功')
    return res.status(200).json({ 
      success: true, 
      message: '推送订阅设置成功' 
    })

  } catch (error) {
    console.error('[PWA] 订阅推送失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理取消推送订阅
async function handlePushUnsubscribe(req, res) {
  try {
    // 从cookies中获取用户ID（复用相同逻辑）
    const cookies = req.headers.cookie
    let userId = null
    
    if (cookies) {
      const cookieObj = {}
      cookies.split(';').forEach(cookie => {
        const [key, value] = cookie.trim().split('=')
        cookieObj[key] = value
      })
      
      if (cookieObj.user_name) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('name', decodeURIComponent(cookieObj.user_name))
          .single()
        
        if (!userError && user) {
          userId = user.id
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    console.log(`[PWA] 用户 ${userId} 取消推送订阅`)

    // 删除用户的所有推送订阅
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('[PWA] 取消推送订阅失败:', error)
      return res.status(500).json({ error: 'Failed to unsubscribe' })
    }

    console.log('✅ [PWA] 推送订阅取消成功')
    return res.status(200).json({ 
      success: true, 
      message: '推送订阅已取消' 
    })

  } catch (error) {
    console.error('[PWA] 取消推送订阅失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理测试推送通知
async function handleTestPushNotification(req, res) {
  try {
    // 从cookies中获取用户ID（复用相同逻辑）
    const cookies = req.headers.cookie
    let userId = null
    
    if (cookies) {
      const cookieObj = {}
      cookies.split(';').forEach(cookie => {
        const [key, value] = cookie.trim().split('=')
        cookieObj[key] = value
      })
      
      if (cookieObj.user_name) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('name', decodeURIComponent(cookieObj.user_name))
          .single()
        
        if (!userError && user) {
          userId = user.id
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // 动态导入web-push模块（避免构建时的问题）
    const { sendWebPushNotification } = await import('../../lib/web-push.js')

    console.log(`[PWA] 用户 ${userId} 请求测试推送`)

    // 发送测试推送通知
    const result = await sendWebPushNotification(
      userId,
      '🧪 测试通知',
      '恭喜！你的推送通知设置成功了！',
      {
        tag: 'test-notification',
        data: { type: 'test' }
      }
    )

    if (result.sent > 0) {
      console.log('✅ [PWA] 测试推送发送成功')
      return res.status(200).json({ 
        success: true, 
        message: '测试推送发送成功',
        result 
      })
    } else {
      console.log('❌ [PWA] 测试推送发送失败')
      return res.status(400).json({ 
        success: false, 
        message: '未找到活跃的推送订阅或发送失败',
        result 
      })
    }

  } catch (error) {
    console.error('[PWA] 发送测试推送失败:', error)
    return res.status(500).json({ error: error.message })
  }
}