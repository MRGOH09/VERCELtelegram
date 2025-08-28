import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

import { validateJWTToken } from '../../../lib/auth.js'

// 管理员Telegram ID - 只有你能访问
const ADMIN_TELEGRAM_IDS = [
  '1790847152' // 你的Telegram ID
]

// 验证管理员权限
async function verifyAdminAccess(req) {
  try {
    // 使用JWT验证获取用户信息
    const user = await validateJWTToken(req)
    if (!user) {
      console.log('[admin-user-management] JWT验证失败')
      return false
    }

    // 检查是否为管理员Telegram ID
    const isAdmin = ADMIN_TELEGRAM_IDS.includes(user.telegram_id?.toString())
    if (!isAdmin) {
      console.log(`[admin-user-management] 非管理员用户尝试访问: ${user.telegram_id}`)
      return false
    }

    console.log(`[admin-user-management] 管理员权限验证通过: ${user.name} (${user.telegram_id})`)
    return { isValid: true, adminUser: user }
    
  } catch (error) {
    console.error('[admin-user-management] 权限验证错误:', error)
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // 验证管理员访问权限
    const adminAuth = await verifyAdminAccess(req)
    if (!adminAuth || !adminAuth.isValid) {
      return res.status(403).json({ ok: false, error: 'Access denied - Admin authentication required' })
    }

    const { action, userId } = req.body

    switch (action) {
      case 'list_users':
        return await listUsers(res)
      
      case 'get_user_details':
        return await getUserDetails(res, userId)
      
      case 'delete_user':
        return await deleteUser(res, userId)
      
      default:
        return res.status(400).json({ ok: false, error: 'Invalid action' })
    }

  } catch (error) {
    console.error('[admin-user-management] 错误:', error)
    return res.status(500).json({
      ok: false,
      error: error.message || '操作失败'
    })
  }
}

// 获取所有用户列表
async function listUsers(res) {
  console.log('[admin-user-management] 获取用户列表')

  // 获取用户基本信息
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, branch_code, telegram_id, created_at')
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('获取用户列表失败:', usersError)
    return res.status(500).json({ ok: false, error: '获取用户列表失败' })
  }

  // 获取用户资料
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profile')
    .select('user_id, display_name')

  // 合并数据
  const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
  
  const usersWithProfiles = users.map(user => ({
    ...user,
    display_name: profilesMap.get(user.id)?.display_name
  }))

  console.log(`[admin-user-management] 返回 ${usersWithProfiles.length} 个用户`)

  return res.status(200).json({
    ok: true,
    data: {
      users: usersWithProfiles
    }
  })
}

// 获取用户详细信息
async function getUserDetails(res, userId) {
  if (!userId) {
    return res.status(400).json({ ok: false, error: '缺少用户ID' })
  }

  console.log(`[admin-user-management] 获取用户详情: ${userId}`)

  // 1. 获取用户基本信息
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return res.status(404).json({ ok: false, error: '用户不存在' })
  }

  // 2. 获取用户资料
  const { data: profile } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single()

  // 3. 统计各种数据
  const [
    { count: recordsCount },
    { count: scoresCount },
    { count: budgetsCount },
    { count: subscriptionsCount }
  ] = await Promise.all([
    // 消费记录数量
    supabase
      .from('records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    
    // 积分记录数量
    supabase
      .from('user_daily_scores')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    
    // 预算记录数量
    supabase
      .from('user_month_budget')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    
    // 推送订阅数量
    supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
  ])

  // 4. 计算总积分
  const { data: totalScoreData } = await supabase
    .from('user_daily_scores')
    .select('total_score')
    .eq('user_id', userId)

  const totalScore = totalScoreData?.reduce((sum, record) => sum + (record.total_score || 0), 0) || 0

  const userDetails = {
    user: {
      ...user,
      display_name: profile?.display_name
    },
    profile: profile,
    stats: {
      records_count: recordsCount || 0,
      scores_count: scoresCount || 0,
      budgets_count: budgetsCount || 0,
      subscriptions_count: subscriptionsCount || 0,
      total_score: totalScore
    }
  }

  return res.status(200).json({
    ok: true,
    data: userDetails
  })
}

// 删除用户及其所有数据
async function deleteUser(res, userId) {
  if (!userId) {
    return res.status(400).json({ ok: false, error: '缺少用户ID' })
  }

  console.log(`[admin-user-management] 开始删除用户: ${userId}`)

  // 验证用户存在
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .single()

  if (!user) {
    return res.status(404).json({ ok: false, error: '用户不存在' })
  }

  const deleteStats = {}

  try {
    // 开始删除操作 - 按依赖关系顺序删除
    
    // 1. 删除推送订阅
    const { count: subscriptionsDeleted } = await supabase
      .from('push_subscriptions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.push_subscriptions = subscriptionsDeleted || 0

    // 2. 删除积分记录
    const { count: scoresDeleted } = await supabase
      .from('user_daily_scores')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.user_daily_scores = scoresDeleted || 0

    // 3. 删除消费记录
    const { count: recordsDeleted } = await supabase
      .from('records')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.records = recordsDeleted || 0

    // 4. 删除月度预算
    const { count: budgetsDeleted } = await supabase
      .from('user_month_budget')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.user_month_budget = budgetsDeleted || 0

    // 5. 删除提醒队列
    const { count: remindersDeleted } = await supabase
      .from('daily_reminder_queue')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.daily_reminder_queue = remindersDeleted || 0

    // 6. 删除用户资料
    const { count: profileDeleted } = await supabase
      .from('user_profile')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    deleteStats.user_profile = profileDeleted || 0

    // 7. 最后删除用户主记录
    const { count: userDeleted, error: userDeleteError } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .eq('id', userId)

    if (userDeleteError) {
      throw new Error(`删除用户主记录失败: ${userDeleteError.message}`)
    }
    
    deleteStats.users = userDeleted || 0

    console.log(`[admin-user-management] 用户删除完成: ${userId}`, deleteStats)

    return res.status(200).json({
      ok: true,
      message: '用户删除成功',
      data: {
        deletedUserId: userId,
        deleteStats: deleteStats
      }
    })

  } catch (error) {
    console.error(`[admin-user-management] 删除用户失败:`, error)
    return res.status(500).json({
      ok: false,
      error: `删除失败: ${error.message}`,
      partialStats: deleteStats
    })
  }
}