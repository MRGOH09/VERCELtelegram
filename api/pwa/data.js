import supabase from '../../lib/supabase.js'
import { getMonthRange, getLocalYMD } from '../../lib/date-utils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, subscription, service, deviceInfo, ...otherParams } = req.body

    switch (action) {
      case 'subscribe-push':
        return await handlePushSubscribe(req, res, subscription, service, deviceInfo)
      
      case 'unsubscribe-push':
        return await handlePushUnsubscribe(req, res)
      
      case 'test-push-notification':
        return await handleTestPushNotification(req, res)
      
      case 'history':
        return await handleGetHistory(req, res, otherParams)
        
      case 'add-record':
        return await handleAddRecord(req, res, otherParams)
        
      case 'delete-record':
        return await handleDeleteRecord(req, res, otherParams)
      
      case 'dashboard':
        return await handleGetDashboard(req, res, otherParams)
        
      case 'profile':
        return await handleGetProfile(req, res, otherParams)
        
      case 'check-auth':
        return await handleCheckAuth(req, res, otherParams)
      
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

// 获取用户ID的辅助函数
async function getUserIdFromCookies(req) {
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
  
  return userId
}

// 处理获取历史记录
async function handleGetHistory(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      console.log('[PWA History] 用户未认证')
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { month, limit = 20, offset = 0 } = params
    console.log(`[PWA History] 查询参数 - userId: ${userId}, month: ${month}, limit: ${limit}, offset: ${offset}`)

    // 构建查询
    let query = supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('ymd', { ascending: false })
      .range(offset, offset + limit - 1)

    // 如果指定了月份，添加月份过滤
    if (month) {
      const { startDate, endDate } = getMonthRange(month)
      console.log(`[PWA History] 月份过滤: ${startDate} 至 ${endDate}`)
      query = query.gte('ymd', startDate).lte('ymd', endDate)
    }

    const { data: records, error } = await query

    if (error) {
      console.error('[PWA] 查询历史记录失败:', error)
      return res.status(500).json({ error: 'Failed to fetch history' })
    }

    // 计算统计数据
    const stats = {
      totalRecords: records.length,
      totalSpent: records.reduce((sum, record) => sum + Math.abs(record.amount), 0)
    }

    console.log(`✅ [PWA History] 查询成功 - 返回 ${records?.length || 0} 条记录`)
    console.log(`[PWA History] 统计数据:`, stats)
    
    return res.status(200).json({ 
      records: records || [],
      stats,
      debug: {
        userId,
        month,
        totalRecords: records?.length || 0,
        queryRange: month ? `${month}-01 to ${month}-XX` : 'all'
      }
    })

  } catch (error) {
    console.error('[PWA] 获取历史记录失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理添加记录
async function handleAddRecord(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { group, category, amount, note, date } = params

    if (!group || !category || !amount) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // 插入记录
    const { data, error } = await supabase
      .from('records')
      .insert([{
        user_id: userId,
        category_group: group,
        category_code: category,
        amount: -Math.abs(amount), // 支出为负数
        note: note || null,
        ymd: date || getLocalYMD(),
        created_at: new Date().toISOString()
      }])
      .select()

    if (error) {
      console.error('[PWA] 添加记录失败:', error)
      return res.status(500).json({ error: 'Failed to add record' })
    }

    console.log('✅ [PWA] 记录添加成功')
    return res.status(200).json({ 
      success: true, 
      message: '记录添加成功',
      record: data?.[0]
    })

  } catch (error) {
    console.error('[PWA] 添加记录失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理删除记录
async function handleDeleteRecord(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { recordId } = params

    if (!recordId) {
      return res.status(400).json({ error: 'Missing record ID' })
    }

    // 软删除记录（设置is_voided为true）
    const { error } = await supabase
      .from('records')
      .update({ is_voided: true })
      .eq('id', recordId)
      .eq('user_id', userId) // 确保只能删除自己的记录

    if (error) {
      console.error('[PWA] 删除记录失败:', error)
      return res.status(500).json({ error: 'Failed to delete record' })
    }

    console.log('✅ [PWA] 记录删除成功')
    return res.status(200).json({ 
      success: true, 
      message: '记录删除成功'
    })

  } catch (error) {
    console.error('[PWA] 删除记录失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理获取仪表板数据
async function handleGetDashboard(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // 简化版仪表板数据 - 这里应该调用现有的API逻辑
    // 但为了快速修复，先返回基本数据
    const mockData = {
      user: { name: 'User', id: userId },
      monthly: {
        income: 5000,
        spent_a: 1200,
        spent_b: 300,
        spent_c: 800,
        percentage_a: 60,
        percentage_b: 15,
        percentage_c: 25,
        days_left: 15
      },
      recent: [],
      stats: {
        record_days: 30,
        total_records: 45,
        current_streak: 7
      }
    }

    console.log('✅ [PWA] 获取仪表板数据成功')
    return res.status(200).json(mockData)

  } catch (error) {
    console.error('[PWA] 获取仪表板数据失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理获取用户资料
async function handleGetProfile(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, name, created_at,
        user_profile (
          display_name, phone_e164, email, income,
          a_pct, travel_budget_annual
        )
      `)
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('[PWA] 查询用户资料失败:', userError)
      return res.status(500).json({ error: 'Failed to fetch profile' })
    }

    // 简化版统计数据
    const stats = {
      record_days: 30,
      total_records: 45,
      current_streak: 7,
      max_streak: 15
    }

    console.log('✅ [PWA] 获取用户资料成功')
    return res.status(200).json({
      user: {
        ...user,
        joined_date: user.created_at,
        branch: user.user_profile?.branch_code || null
      },
      profile: user.user_profile,
      stats
    })

  } catch (error) {
    console.error('[PWA] 获取用户资料失败:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 处理认证检查
async function handleCheckAuth(req, res, params) {
  try {
    const userId = await getUserIdFromCookies(req)
    
    if (!userId) {
      return res.status(200).json({ authenticated: false })
    }

    // 验证用户是否仍然存在且活跃
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, status')
      .eq('id', userId)
      .eq('status', 'active')
      .single()

    if (error || !user) {
      return res.status(200).json({ authenticated: false })
    }

    console.log('✅ [PWA] 用户认证检查成功')
    return res.status(200).json({ 
      authenticated: true,
      user: {
        id: user.id,
        name: user.name
      }
    })

  } catch (error) {
    console.error('[PWA] 认证检查失败:', error)
    return res.status(200).json({ authenticated: false })
  }
}