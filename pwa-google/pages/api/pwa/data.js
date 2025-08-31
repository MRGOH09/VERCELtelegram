import { createClient } from '@supabase/supabase-js'
import { formatYMD, getYYYYMM, getEndOfMonth } from '../../../lib/auth'

// KISS: 使用Vercel-Supabase集成环境变量
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    // CORS和缓存控制处理
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma')
    
    // 强制无缓存 - 特别针对Safari PWA
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Last-Modified', new Date().toUTCString())
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    // KISS: Supabase原生认证验证
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '请先登录'
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: '认证失败'
      })
    }
    
    console.log(`[PWA Data] 认证用户: ${user.id} (${user.email})`)
    
    // 获取用户在数据库中的信息
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profile')
      .select(`
        user_id,
        email,
        display_name,
        users!inner (
          id,
          name,
          branch_code,
          status
        )
      `)
      .eq('email', user.email)
      .single()
      
    if (profileError) {
      console.error('[PWA Data] 用户资料查询失败:', profileError)
      return res.status(404).json({ 
        error: 'User not found',
        message: '用户资料不存在'
      })
    }
    
    const dbUser = {
      id: userProfile.users.id,
      email: userProfile.email,
      name: userProfile.users.name,
      branch_code: userProfile.users.branch_code
    }
    
    const { action, ...params } = req.body
    console.log(`[PWA Data] 处理请求: action=${action}, user=${dbUser.id}`)
    
    switch (action) {
      case 'dashboard':
        return await getDashboardData(dbUser.id, res)
        
      case 'profile':
        return await getProfileData(dbUser.id, res)
        
      case 'history':
        return await getHistoryData(dbUser.id, params, res)
        
      case 'check-auth':
        return res.json({ authenticated: true, user: { id: dbUser.id, name: dbUser.name, branch: dbUser.branch_code } })
        
      case 'subscribe-push':
        return await subscribePushNotification(dbUser.id, params, res)
        
      case 'unsubscribe-push':
        return await unsubscribePushNotification(dbUser.id, res)
        
      case 'test-push-notification':
        return await sendTestPushNotification(dbUser.id, res)
        
      case 'verify-subscription':
        return await verifyPushSubscription(dbUser.id, res)
        
      case 'add-record':
        return await addRecord(dbUser.id, params, res)
        
      case 'batch-add-records':
        return await batchAddRecords(dbUser.id, params, res)
        
      case 'delete-record':
        return await deleteRecord(dbUser.id, params, res)
        
      case 'update-record':
        return await updateRecord(dbUser.id, params, res)
        
      case 'checkin':
        return await handleCheckIn(dbUser.id, res)
        
      case 'check-checkin-status':
        return await checkCheckInStatus(dbUser.id, res)
        
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
      .order('created_at', { ascending: false })

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
        travel_budget: profile?.travel_budget_annual || 0,
        annual_medical_insurance: profile?.annual_medical_insurance || 0,
        annual_car_insurance: profile?.annual_car_insurance || 0
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

    // 构建API请求 - 直接调用主系统部署的域名
    // PWA部署和主系统部署分离，需要跨域调用主系统
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://verceteleg.vercel.app' // 主系统域名，包含record-system API
      : 'http://localhost:3000' // 开发环境需要主系统在3000端口运行

    console.log(`[addRecord] API调用: ${baseURL}/api/records/record-system`)

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
    
    // 构建响应，包含积分信息
    const responseData = {
      success: true,
      message: '记录添加成功',
      record: result.record
    }
    
    // 如果主系统返回了积分信息，包含在响应中
    if (result.score) {
      responseData.score = result.score
      // 增强积分消息
      if (result.score.total_score > 0) {
        const scoreDetails = []
        if (result.score.base_score > 0) scoreDetails.push(`基础${result.score.base_score}分`)
        if (result.score.streak_score > 0) scoreDetails.push(`连续${result.score.streak_score}分`)
        if (result.score.bonus_score > 0) scoreDetails.push(`奖励${result.score.bonus_score}分`)
        
        responseData.scoreMessage = `🎉 获得 ${result.score.total_score} 分！(${scoreDetails.join(' + ')})`
        responseData.streakMessage = `连续记录 ${result.score.current_streak} 天`
        
        // 里程碑成就提示
        if (result.score.bonus_details && result.score.bonus_details.length > 0) {
          const achievements = result.score.bonus_details.map(bonus => bonus.name).join('、')
          responseData.achievementMessage = `🏆 达成成就：${achievements}！`
        }
      }
    }
    
    return res.json(responseData)

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

    // 使用与单条记录相同的API路径逻辑 - 直接调用主系统
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://verceteleg.vercel.app' // 主系统域名，包含record-system API
      : 'http://localhost:3000' // 开发环境需要主系统在3000端口运行

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

// 删除记录
async function deleteRecord(userId, params, res) {
  try {
    const { recordId } = params
    console.log(`[deleteRecord] 用户 ${userId} 删除记录: ${recordId}`)
    
    if (!recordId) {
      return res.status(400).json({ 
        error: 'Missing required field: recordId' 
      })
    }
    
    // 构建API请求 - 调用主系统的record-system API
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://verceteleg.vercel.app' // 主系统域名
      : 'http://localhost:3000'
    
    console.log(`[deleteRecord] API调用: ${baseURL}/api/records/record-system`)
    
    const response = await fetch(`${baseURL}/api/records/record-system`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'PWA-Delete-Client',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store', // 强制不使用任何缓存
      body: JSON.stringify({
        action: 'delete',
        userId: userId,
        recordId: recordId
      })
    })
    
    const responseText = await response.text()
    console.log(`[deleteRecord] 主系统响应:`, {
      status: response.status,
      ok: response.ok,
      text: responseText.substring(0, 200)
    })
    
    if (!response.ok) {
      console.error(`[deleteRecord] 主系统API调用失败:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseText
      })
      return res.status(response.status || 500).json({ 
        error: `删除记录失败: ${response.status} ${response.statusText}`,
        details: responseText
      })
    }
    
    // 尝试解析JSON响应
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      console.warn('[deleteRecord] 响应不是JSON格式:', responseText.substring(0, 100))
      responseData = { success: true, message: responseText }
    }
    
    console.log(`[deleteRecord] 删除成功:`, responseData)
    
    // 添加时间戳确保响应不被缓存
    const timestamp = new Date().toISOString()
    
    return res.json({
      success: true,
      message: '记录删除成功',
      data: responseData,
      timestamp: timestamp,
      debug: `Deleted at ${timestamp} by user ${userId}`
    })
    
  } catch (error) {
    console.error('[deleteRecord] 错误:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to delete record' 
    })
  }
}

// 修改记录
async function updateRecord(userId, params, res) {
  try {
    const { recordId, group, category, amount, date, note } = params
    console.log(`[updateRecord] 用户 ${userId} 修改记录 ${recordId}:`, { group, category, amount, date, note })
    
    if (!recordId) {
      return res.status(400).json({ 
        error: 'Missing required field: recordId' 
      })
    }
    
    if (!group || !category || !amount || !date) {
      return res.status(400).json({ 
        error: 'Missing required fields: group, category, amount, date' 
      })
    }
    
    // 构建API请求 - 调用主系统的record-system API
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://verceteleg.vercel.app' // 主系统域名
      : 'http://localhost:3000'
    
    console.log(`[updateRecord] API调用: ${baseURL}/api/records/record-system`)
    
    const response = await fetch(`${baseURL}/api/records/record-system`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'PWA-Update-Client',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store', // 强制不使用任何缓存
      body: JSON.stringify({
        action: 'update',
        userId: userId,
        recordId: recordId,
        data: {
          category_group: group,
          category_code: category,
          amount: parseFloat(amount),
          note: note || '',
          ymd: date
        }
      })
    })
    
    const responseText = await response.text()
    console.log(`[updateRecord] 主系统响应:`, {
      status: response.status,
      ok: response.ok,
      text: responseText.substring(0, 200)
    })
    
    if (!response.ok) {
      console.error(`[updateRecord] 主系统API调用失败:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseText
      })
      return res.status(response.status || 500).json({ 
        error: `修改记录失败: ${response.status} ${response.statusText}`,
        details: responseText
      })
    }
    
    // 尝试解析JSON响应
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      console.warn('[updateRecord] 响应不是JSON格式:', responseText.substring(0, 100))
      responseData = { success: true, message: responseText }
    }
    
    console.log(`[updateRecord] 修改成功:`, responseData)
    
    // 添加时间戳确保响应不被缓存
    const timestamp = new Date().toISOString()
    
    return res.json({
      success: true,
      message: '记录修改成功',
      data: responseData,
      timestamp: timestamp,
      debug: `Updated at ${timestamp} by user ${userId} - record ${recordId}`
    })
    
  } catch (error) {
    console.error('[updateRecord] 错误:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to update record' 
    })
  }
}

// 处理用户打卡 - 采用Telegram模式：先积分后记录
async function handleCheckIn(userId, res) {
  try {
    console.log(`[handleCheckIn] 用户 ${userId} 发起打卡 - 使用Telegram模式`)
    
    const today = formatYMD(new Date())
    
    // 1. 检查今日是否已打卡 (检查积分表)
    const { data: existingCheckIn } = await supabase
      .from('user_daily_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('ymd', today)
      .maybeSingle()
    
    if (existingCheckIn) {
      console.log(`[handleCheckIn] 用户 ${userId} 今日已打卡`)
      return res.status(200).json({
        success: false,
        error: '今日已经打卡过了！',
        hasCheckedIn: true,
        score: {
          total_score: existingCheckIn.total_score,
          base_score: existingCheckIn.base_score,
          streak_score: existingCheckIn.streak_score,
          bonus_score: existingCheckIn.bonus_score
        },
        scoreMessage: `今日积分：${existingCheckIn.total_score}分`
      })
    }
    
    // 2. 执行积分计算 - PWA内置简化版本
    const scoreResult = await calculateCheckInScore(userId, today)
    
    console.log(`[handleCheckIn] 积分计算结果:`, scoreResult)
    
    // 3. 创建records表记录
    const { data: checkinRecord, error: insertError } = await supabase
      .from('records')
      .insert([{
        user_id: userId,
        category_group: 'A',
        category_code: 'daily_checkin',
        amount: 0,
        note: '每日打卡 - PWA',
        ymd: today
      }])
      .select()
      .single()
      
    if (insertError) {
      console.error('[handleCheckIn] 插入打卡记录失败 (但积分已计算):', insertError)
      // 即使records插入失败，积分已经记录，仍然返回成功
    }
    
    console.log(`[handleCheckIn] 用户 ${userId} 打卡成功，获得 ${scoreResult.total_score} 分`)
    
    return res.status(200).json({
      success: true,
      message: '打卡成功！',
      hasCheckedIn: true,
      score: {
        total_score: scoreResult.total_score,
        base_score: scoreResult.base_score,
        streak_score: scoreResult.streak_score,
        bonus_score: scoreResult.bonus_score
      },
      scoreMessage: `🎯 获得积分：${scoreResult.total_score}分\n• 基础分：${scoreResult.base_score}分\n• 连续分：${scoreResult.streak_score}分\n• 奖励分：${scoreResult.bonus_score}分`,
      record: checkinRecord
    })
      
  } catch (error) {
    console.error('[handleCheckIn] 处理失败:', error)
    return res.status(500).json({
      success: false,
      error: '打卡失败，请重试',
      debug: {
        message: error.message,
        stack: error.stack
      }
    })
  }
}

// PWA内置积分计算 - 完全模仿Telegram逻辑
async function calculateCheckInScore(userId, ymd) {
  try {
    console.log(`[calculateCheckInScore] 计算用户 ${userId} 在 ${ymd} 的打卡积分`)
    
    // 1. 计算基础分
    const baseScore = 1
    
    // 2. 计算连续天数
    const currentStreak = await calculateCurrentStreakPWA(userId, ymd)
    
    // 3. 连续分计算 - 连续记录获得1分 (固定1分，不累加)
    const streakScore = currentStreak > 1 ? 1 : 0
    
    // 4. 里程碑奖励计算
    const bonusDetails = []
    let bonusScore = 0
    
    // 使用正确的里程碑配置 (与数据库一致)
    const milestones = [
      { streak_days: 3, bonus_score: 2, milestone_name: '坚持三天' },
      { streak_days: 5, bonus_score: 3, milestone_name: '持续五天' },
      { streak_days: 10, bonus_score: 5, milestone_name: '稳定十天' },
      { streak_days: 15, bonus_score: 8, milestone_name: '半月坚持' },
      { streak_days: 21, bonus_score: 12, milestone_name: '三周习惯' },
      { streak_days: 31, bonus_score: 20, milestone_name: '月度冠军' }
    ]
    
    for (const milestone of milestones) {
      if (currentStreak === milestone.streak_days) {
        bonusDetails.push({
          score: milestone.bonus_score,
          name: milestone.milestone_name
        })
        bonusScore += milestone.bonus_score
        console.log(`[PWA积分] 达成${milestone.streak_days}天里程碑，获得${milestone.bonus_score}分奖励`)
      }
    }
    
    const scoreData = {
      user_id: userId,
      ymd: ymd,
      base_score: baseScore,
      streak_score: streakScore,
      bonus_score: bonusScore,
      current_streak: currentStreak,
      record_type: 'checkin',
      bonus_details: bonusDetails
    }
    
    // 保存积分记录到user_daily_scores表
    const { data: savedScore, error } = await supabase
      .from('user_daily_scores')
      .insert(scoreData)
      .select()
      .single()
    
    if (error) {
      console.error('[calculateCheckInScore] 保存积分失败:', error)
      throw error
    }
    
    console.log(`[calculateCheckInScore] 积分计算完成: ${totalScore}分`)
    return savedScore
    
  } catch (error) {
    console.error('[calculateCheckInScore] 积分计算失败:', error)
    throw error
  }
}

// PWA内置连续天数计算 - 模仿主系统逻辑
async function calculateCurrentStreakPWA(userId, todayYmd) {
  try {
    const today = new Date(todayYmd)
    const yesterday = new Date(today.getTime() - 86400000)
    const yesterdayYmd = yesterday.toISOString().slice(0, 10)
    
    console.log(`[PWA连续计算] 用户${userId} 今天${todayYmd} 昨天${yesterdayYmd}`)
    
    // 查询用户最近的积分记录(按日期降序)
    const { data: recentScores } = await supabase
      .from('user_daily_scores')
      .select('ymd, current_streak')
      .eq('user_id', userId)
      .lt('ymd', todayYmd)  // 小于今天的记录
      .order('ymd', { ascending: false })
      .limit(1)
    
    // 如果没有历史记录，今天是第1天
    if (!recentScores || recentScores.length === 0) {
      console.log('[PWA连续计算] 无历史记录，今天是第1天')
      return 1
    }
    
    const lastRecord = recentScores[0]
    console.log(`[PWA连续计算] 最近记录: ${lastRecord.ymd}, 连续${lastRecord.current_streak}天`)
    
    // 如果昨天有记录，连续天数+1
    if (lastRecord.ymd === yesterdayYmd) {
      const newStreak = lastRecord.current_streak + 1
      console.log(`[PWA连续计算] 昨天有记录，连续天数: ${lastRecord.current_streak} + 1 = ${newStreak}`)
      return newStreak
    } else {
      // 如果昨天没记录，重新开始，今天是第1天
      console.log('[PWA连续计算] 昨天无记录，重新开始，今天是第1天')
      return 1
    }
  } catch (error) {
    console.error('[PWA连续计算] 失败:', error)
    return 1  // 出错时返回1天
  }
}

async function checkCheckInStatus(userId, res) {
  try {
    console.log(`[checkCheckInStatus] 检查用户 ${userId} 今日打卡状态`)
    
    const today = formatYMD(new Date())
    
    // 检查今日是否已打卡 (通过user_daily_scores表)
    const { data: checkinRecord } = await supabase
      .from('user_daily_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('ymd', today)
      .maybeSingle()
      
    const hasCheckedIn = !!checkinRecord
    const checkinTime = checkinRecord?.created_at 
      ? new Date(checkinRecord.created_at).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) 
      : null
    
    console.log(`[checkCheckInStatus] 今日打卡状态: ${hasCheckedIn}`)
    
    return res.status(200).json({
      success: true,
      hasCheckedIn,
      checkinTime,
      today
    })
    
  } catch (error) {
    console.error('[checkCheckInStatus] 失败:', error)
    return res.status(500).json({
      success: false,
      error: '检查打卡状态失败'
    })
  }
}
