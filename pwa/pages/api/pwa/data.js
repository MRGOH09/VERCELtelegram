import { createClient } from '@supabase/supabase-js'
import { validateJWTToken, formatYMD, getYYYYMM, getEndOfMonth } from '../../../lib/auth'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  try {
    // CORS处理
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    // JWT Token验证
    const user = await validateJWTToken(req)
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '请先通过Telegram登录',
        redirect: '/login'
      })
    }
    
    const { action, ...params } = req.body
    console.log(`[PWA Data] 处理请求: action=${action}, user=${user.id}`)
    
    switch (action) {
      case 'dashboard':
        return await getDashboardData(user.id, res)
        
      case 'profile':
        return await getProfileData(user.id, res)
        
      case 'history':
        return await getHistoryData(user.id, params, res)
        
      case 'check-auth':
        return res.json({ authenticated: true, user: { id: user.id, name: user.name, branch: user.branch_code } })
        
      case 'subscribe-push':
        return await subscribePushNotification(user.id, params, res)
        
      case 'unsubscribe-push':
        return await unsubscribePushNotification(user.id, res)
        
      case 'test-push-notification':
        return await sendTestPushNotification(user.id, res)
        
      case 'verify-subscription':
        return await verifyPushSubscription(user.id, res)
        
      case 'add-record':
        return await addRecord(user.id, params, res)
        
      case 'batch-add-records':
        return await batchAddRecords(user.id, params, res)
        
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('[PWA Data] API错误:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// 获取仪表板数据
async function getDashboardData(userId, res) {
  try {
    console.log(`[getDashboardData] 获取用户 ${userId} 的仪表板数据`)
    
    // 获取用户资料
    const { data: profile } = await supabase
      .from('user_profile')
      .select('display_name, monthly_income, a_pct, travel_budget_annual, current_streak, total_records')
      .eq('user_id', userId)
      .single()
      
    // 获取用户分行
    const { data: user } = await supabase
      .from('users')
      .select('branch_code')
      .eq('id', userId)
      .single()
      
    console.log(`[getDashboardData] 用户资料:`, { profile, user })
      
    // 获取当月预算
    const yyyymm = getYYYYMM()
    const { data: budget } = await supabase
      .from('user_month_budget')
      .select('*')
      .eq('user_id', userId)
      .eq('yyyymm', yyyymm)
      .maybeSingle()
      
    console.log(`[getDashboardData] 当月预算:`, budget)
      
    // 获取当月支出统计（包含详细分类）
    const startOfMonth = `${yyyymm}-01`
    const endOfMonth = getEndOfMonth(yyyymm)
    
    const { data: records } = await supabase
      .from('records')
      .select('category_group, category_code, amount, ymd')
      .eq('user_id', userId)
      .gte('ymd', startOfMonth)
      .lte('ymd', endOfMonth)
      .eq('is_voided', false)
      
    console.log(`[getDashboardData] 当月记录数: ${records?.length || 0}`)
      
    // 使用与 /my 命令完全相同的计算逻辑
    const groupStats = {
      A: { total: 0, count: 0 }, // 开销
      B: { total: 0, count: 0 }, // 学习  
      C: { total: 0, count: 0 }  // 储蓄
    }
    const categoryDetails = {}
    const recordDays = new Set()
    
    records?.forEach(record => {
      const amount = Number(record.amount || 0)  // 使用原始值，不取绝对值
      const group = record.category_group
      const code = record.category_code
      
      // 汇总分组支出（与/my命令一致）
      if (groupStats[group]) {
        groupStats[group].total += amount
        groupStats[group].count += 1
      }
      
      // 详细分类统计（使用绝对值用于显示）
      if (!categoryDetails[group]) {
        categoryDetails[group] = {}
      }
      categoryDetails[group][code] = (categoryDetails[group][code] || 0) + Math.abs(amount)
      
      // 记录天数统计
      recordDays.add(record.ymd)
    })
    
    // 按 /my 命令逻辑计算最终金额
    const income = budget?.income || profile?.monthly_income || 0
    
    // A类：开销（直接使用统计值）
    const aTotal = groupStats.A.total
    
    // B类：学习 = B类记录 + 旅游基金
    const travelMonthly = Math.round((profile?.travel_budget_annual || 0) / 12 * 100) / 100
    const bTotal = Math.round((groupStats.B.total + travelMonthly) * 100) / 100
    
    // C类：储蓄 = 收入 - 开销 - 学习（计算得出）
    const cTotal = Math.round((income - aTotal - bTotal) * 100) / 100
    
    // 最终支出结构
    const expenses = {
      A: aTotal,
      B: bTotal, 
      C: cTotal
    }
    
    // 计算占比（与/my命令一致）
    const percentages = {
      A: income > 0 ? Math.round((aTotal / income) * 100) : 0,
      B: income > 0 ? Math.round((bTotal / income) * 100) : 0,
      C: income > 0 ? Math.round((cTotal / income) * 100) : 0
    }
    
    const totalExpenses = aTotal + bTotal + cTotal
    
    // 记录统计
    const recordStats = {
      total_records: records?.length || 0,
      record_days: recordDays.size,
      avg_per_day: recordDays.size > 0 ? Math.round((records?.length || 0) / recordDays.size * 10) / 10 : 0
    }
    
    // 获取最近记录
    const { data: recentRecords } = await supabase
      .from('records')
      .select('id, category_group, category_code, amount, note, ymd, created_at')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log(`[getDashboardData] 最近记录数: ${recentRecords?.length || 0}`)
    
    // 计算本月剩余天数
    const now = new Date()
    const endOfMonthDate = new Date(endOfMonth)
    const daysLeft = Math.max(0, Math.ceil((endOfMonthDate - now) / (1000 * 60 * 60 * 24)))
    
    const response = {
      user: {
        name: profile?.display_name || 'User',
        branch: user?.branch_code || '未设置'
      },
      monthly: {
        income: income,
        spent_a: expenses.A,
        spent_b: expenses.B,
        spent_c: expenses.C,
        percentage_a: percentages.A,
        percentage_b: percentages.B,
        percentage_c: percentages.C,
        days_left: daysLeft,
        budget_a: budget?.cap_a_amount || ((profile?.monthly_income || 0) * (profile?.a_pct || 0) / 100),
        budget_b: budget?.cap_b_amount || ((profile?.monthly_income || 0) * (profile?.b_pct || 0) / 100),
        budget_c: budget?.cap_c_amount || ((profile?.monthly_income || 0) * (profile?.c_pct || 0) / 100),
        remaining_a: Math.max(0, (budget?.cap_a_amount || ((profile?.monthly_income || 0) * (profile?.a_pct || 0) / 100)) - expenses.A),
        total_expenses: totalExpenses
      },
      stats: {
        current_streak: profile?.current_streak || 0,
        total_records: profile?.total_records || 0,
        monthly_records: recordStats.total_records,
        record_days: recordStats.record_days,
        avg_per_day: recordStats.avg_per_day
      },
      categoryDetails: categoryDetails,
      budget_details: {
        epf: budget?.epf_amount || (income * 0.24),
        travel_annual: profile?.travel_budget_annual || 0,
        travel_monthly: (profile?.travel_budget_annual || 0) / 12
      },
      recent: recentRecords?.map(record => ({
        id: record.id,
        category: record.category_code,
        group: record.category_group,
        amount: record.amount,
        note: record.note,
        date: record.created_at
      })) || []
    }
    
    console.log(`[getDashboardData] 返回数据:`, JSON.stringify(response, null, 2))
    
    return res.json(response)
    
  } catch (error) {
    console.error('[getDashboardData] 错误:', error)
    return res.status(500).json({ error: 'Failed to get dashboard data' })
  }
}

// 获取历史记录数据 - 完全模仿Telegram逻辑
async function getHistoryData(userId, params, res) {
  try {
    const { month, limit = 20, offset = 0 } = params
    console.log(`[getHistoryData] 查询历史记录: userId=${userId}, month=${month}, limit=${limit}, offset=${offset}`)
    
    let query = supabase
      .from('records')
      .select('id,ymd,category_group,category_code,amount,note,created_at')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('ymd', { ascending: false })

    // 如果指定了月份，添加月份过滤 (模仿Telegram逻辑)
    if (month) {
      const today = new Date()
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      
      const startDate = `${month}-01`
      let endDate
      
      if (month === currentMonth) {
        // 如果是当前月份，查询到今天 (模仿Telegram逻辑)
        endDate = today.toISOString().slice(0, 10)
      } else {
        // 如果是历史月份，查询整个月
        const year = parseInt(month.split('-')[0])
        const monthNum = parseInt(month.split('-')[1])
        const lastDay = new Date(year, monthNum, 0).getDate()
        endDate = `${month}-${lastDay.toString().padStart(2, '0')}`
      }
      
      console.log(`[getHistoryData] 日期过滤: ${startDate} 至 ${endDate}`)
      query = query.gte('ymd', startDate).lte('ymd', endDate)
    }
    
    // 分页处理
    const { data: records, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('[getHistoryData] 查询失败:', error)
      return res.status(500).json({ error: 'Failed to fetch history' })
    }

    // 计算统计数据
    const stats = {
      totalRecords: records.length,
      totalSpent: records.reduce((sum, record) => sum + Math.abs(record.amount), 0)
    }

    console.log(`[getHistoryData] 查询成功: 返回 ${records?.length || 0} 条记录`)
    
    return res.json({ 
      records: records || [],
      stats,
      debug: {
        userId,
        month,
        totalRecords: records?.length || 0,
        queryRange: month ? `${month} month` : 'all'
      }
    })

  } catch (error) {
    console.error('[getHistoryData] 错误:', error)
    return res.status(500).json({ error: error.message })
  }
}

// 获取个人资料数据
async function getProfileData(userId, res) {
  try {
    console.log(`[getProfileData] 获取用户 ${userId} 的个人资料`)
    
    // 获取用户资料
    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()
      
    // 获取用户基本信息
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, name, branch_code, created_at')
      .eq('id', userId)
      .single()
      
    // 获取统计数据
    const { data: recordStats } = await supabase
      .from('records')
      .select('ymd')
      .eq('user_id', userId)
      .eq('is_voided', false)
      
    const uniqueDays = new Set(recordStats?.map(r => r.ymd) || []).size
    
    const response = {
      user: {
        telegram_id: user?.telegram_id,
        name: user?.name || profile?.display_name,
        branch: user?.branch_code || '未设置',
        joined_date: user?.created_at
      },
      profile: {
        display_name: profile?.display_name,
        phone: profile?.phone_e164,
        email: profile?.email,
        income: profile?.monthly_income || 0,
        a_pct: profile?.a_pct || 0,
        travel_budget: profile?.travel_budget_annual || 0
      },
      stats: {
        record_days: uniqueDays,
        total_records: profile?.total_records || 0,
        current_streak: profile?.current_streak || 0,
        max_streak: profile?.max_streak || 0
      }
    }
    
    console.log(`[getProfileData] 返回个人资料数据`)
    
    return res.json(response)
    
  } catch (error) {
    console.error('[getProfileData] 错误:', error)
    return res.status(500).json({ error: 'Failed to get profile data' })
  }
}

// 订阅推送通知
async function subscribePushNotification(userId, params, res) {
  try {
    const { subscription, deviceInfo } = params
    console.log(`[subscribePushNotification] 用户 ${userId} 订阅推送`)
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' })
    }

    // 先检查用户是否存在
    const { data: userExists } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (!userExists) {
      console.error('[subscribePushNotification] 用户不存在:', userId)
      return res.status(400).json({ error: 'User not found' })
    }

    // 保存推送订阅到数据库 - 先删除现有的，再插入新的
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)

    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: deviceInfo?.userAgent || '',
        device_info: deviceInfo || {},
        last_used: new Date().toISOString()
      })

    if (error) {
      console.error('[subscribePushNotification] 数据库错误:', error)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }

    console.log(`[subscribePushNotification] 订阅保存成功`)
    return res.json({ success: true, message: '推送订阅成功' })

  } catch (error) {
    console.error('[subscribePushNotification] 错误:', error)
    return res.status(500).json({ error: 'Failed to subscribe push notifications' })
  }
}

// 取消推送订阅
async function unsubscribePushNotification(userId, res) {
  try {
    console.log(`[unsubscribePushNotification] 用户 ${userId} 取消订阅`)

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('[unsubscribePushNotification] 数据库错误:', error)
      return res.status(500).json({ error: 'Failed to unsubscribe' })
    }

    console.log(`[unsubscribePushNotification] 取消订阅成功`)
    return res.json({ success: true, message: '取消推送订阅成功' })

  } catch (error) {
    console.error('[unsubscribePushNotification] 错误:', error)
    return res.status(500).json({ error: 'Failed to unsubscribe push notifications' })
  }
}

// 发送测试推送通知
async function sendTestPushNotification(userId, res) {
  try {
    console.log(`[sendTestPushNotification] 向用户 ${userId} 发送测试推送`)

    // 获取用户的推送订阅
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('[sendTestPushNotification] 查询订阅失败:', error)
      return res.status(500).json({ error: 'Failed to get subscriptions' })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: '没有找到推送订阅，请先订阅推送通知' })
    }

    // 动态导入 web-push
    const webpush = require('web-push')
    
    // 设置 VAPID 密钥
    webpush.setVapidDetails(
      'mailto:support@learnerclub.app',
      process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const pushPayload = {
      title: '🧪 测试推送通知',
      body: '这是一个测试推送通知，点击查看更多信息',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: {
        type: 'test',
        url: '/settings',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: '查看',
          icon: '/icons/icon-72.png'
        },
        {
          action: 'close',
          title: '关闭'
        }
      ]
    }

    // 向所有订阅发送推送
    const pushPromises = subscriptions.map(async (subscription) => {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(pushPayload)
        )

        console.log(`[sendTestPushNotification] 推送发送成功: ${subscription.endpoint.slice(-20)}`)
        return { success: true, endpoint: subscription.endpoint }
      } catch (error) {
        console.error(`[sendTestPushNotification] 推送发送失败:`, error)
        return { success: false, endpoint: subscription.endpoint, error: error.message }
      }
    })

    const results = await Promise.all(pushPromises)
    const successCount = results.filter(r => r.success).length

    console.log(`[sendTestPushNotification] 测试推送完成: ${successCount}/${results.length} 成功`)

    // 记录推送日志
    await supabase
      .from('push_logs')
      .insert({
        user_id: userId,
        push_type: 'test',
        title: pushPayload.title,
        body: pushPayload.body,
        success: successCount > 0,
        error_message: successCount === 0 ? '所有推送都失败了' : null
      })

    if (successCount > 0) {
      return res.json({ 
        success: true, 
        message: `测试推送发送成功 (${successCount}/${results.length})`,
        results 
      })
    } else {
      return res.status(500).json({ 
        error: '测试推送发送失败', 
        results 
      })
    }

  } catch (error) {
    console.error('[sendTestPushNotification] 错误:', error)
    return res.status(500).json({ error: 'Failed to send test push notification' })
  }
}

// 验证推送订阅状态
async function verifyPushSubscription(userId, res) {
  try {
    console.log(`[verifyPushSubscription] 验证用户 ${userId} 的推送订阅`)

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, last_used')
      .eq('user_id', userId)

    if (error) {
      console.error('[verifyPushSubscription] 查询失败:', error)
      return res.status(500).json({ error: 'Failed to verify subscription' })
    }

    const hasSubscription = subscriptions && subscriptions.length > 0
    
    console.log(`[verifyPushSubscription] 用户订阅状态: ${hasSubscription ? '存在' : '不存在'} (${subscriptions?.length || 0}个)`)

    return res.json({ 
      hasSubscription,
      subscriptionCount: subscriptions?.length || 0,
      subscriptions: subscriptions?.map(s => ({
        id: s.id,
        endpoint: s.endpoint.slice(-20), // 只返回端点的最后20个字符用于调试
        lastUsed: s.last_used
      }))
    })

  } catch (error) {
    console.error('[verifyPushSubscription] 错误:', error)
    return res.status(500).json({ error: 'Failed to verify push subscription' })
  }
}

// 添加单条记录
async function addRecord(userId, recordData, res) {
  try {
    console.log(`[addRecord] 用户 ${userId} 添加记录:`, recordData)

    if (!recordData.group || !recordData.category || !recordData.amount || !recordData.date) {
      return res.status(400).json({ 
        error: 'Missing required fields: group, category, amount, date' 
      })
    }

    // 构建API请求 - 调用主系统的 record-system
    // PWA运行在3001端口，主系统在3000端口
    const baseURL = process.env.NODE_ENV === 'production' 
      ? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://versalsupabase.vercel.app'
      : 'http://localhost:3000'

    const response = await fetch(`${baseURL}/api/records/record-system`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'PWA-Client'
      },
      body: JSON.stringify({
        action: 'create',
        userId: userId,
        data: {
          category_group: recordData.group,
          category_code: recordData.category,
          amount: parseFloat(recordData.amount),
          note: recordData.note || '',
          ymd: recordData.date
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unknown error')
      console.error(`[addRecord] 主系统API调用失败:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      throw new Error(`记录保存失败: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    return res.json({
      success: true,
      message: '记录添加成功',
      record: result.record
    })

  } catch (error) {
    console.error('[addRecord] 错误:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to add record' 
    })
  }
}

// 批量添加记录
async function batchAddRecords(userId, params, res) {
  try {
    console.log(`[batchAddRecords] 用户 ${userId} 批量添加记录:`, params.records?.length || 0, '条')

    if (!params.records || !Array.isArray(params.records) || params.records.length === 0) {
      return res.status(400).json({ 
        error: 'No valid records provided' 
      })
    }

    // PWA运行在3001端口，主系统在3000端口
    const baseURL = process.env.NODE_ENV === 'production' 
      ? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://versalsupabase.vercel.app'
      : 'http://localhost:3000'

    const results = []
    const errors = []

    // 逐个处理记录（确保数据一致性）
    for (let i = 0; i < params.records.length; i++) {
      const record = params.records[i]
      
      try {
        const response = await fetch(`${baseURL}/api/records/record-system`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'PWA-Batch-Client'
          },
          body: JSON.stringify({
            action: 'create',
            userId: userId,
            data: {
              category_group: record.group,
              category_code: record.category,
              amount: parseFloat(record.amount),
              note: record.note || '',
              ymd: record.date
            }
          })
        })

        if (response.ok) {
          const result = await response.json()
          results.push({ 
            index: i, 
            success: true, 
            record: result.record 
          })
        } else {
          const errorData = await response.text().catch(() => 'Unknown error')
          errors.push({ 
            index: i, 
            error: `${response.status}: ${errorData}` 
          })
        }
      } catch (recordError) {
        errors.push({ 
          index: i, 
          error: recordError.message 
        })
      }
    }

    console.log(`[batchAddRecords] 完成: ${results.length} 成功, ${errors.length} 失败`)

    // 如果有任何成功的记录，返回成功
    if (results.length > 0) {
      return res.json({
        success: true,
        message: `批量记录完成: ${results.length} 条成功${errors.length > 0 ? `, ${errors.length} 条失败` : ''}`,
        results: {
          successful: results.length,
          failed: errors.length,
          details: results,
          errors: errors
        }
      })
    } else {
      // 全部失败
      return res.status(400).json({
        error: '批量记录失败',
        details: errors
      })
    }

  } catch (error) {
    console.error('[batchAddRecords] 错误:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to process batch records' 
    })
  }
}