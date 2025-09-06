import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { branch, authKey } = req.body

  // 简单的权限验证
  if (authKey !== 'PIC_Abcd1234') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log(`[branch-detail] 获取分院数据: ${branch}`)

    // 构建查询
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        telegram_id,
        branch_code,
        status,
        created_at,
        user_profile!left (
          user_id,
          display_name,
          email,
          phone_e164,
          current_streak,
          max_streak,
          total_records,
          last_record_date,
          monthly_income,
          a_pct,
          travel_budget_annual,
          annual_medical_insurance,
          annual_car_insurance
        )
      `)
      .neq('status', 'test') // 排除测试用户

    // 如果指定了分院，添加过滤
    if (branch && branch !== 'ALL') {
      query = query.eq('branch_code', branch)
    }

    const { data: users, error: userError } = await query

    if (userError) {
      console.error('[branch-detail] 查询用户失败:', userError)
      throw userError
    }

    // 获取所有用户的积分数据
    const userIds = users.map(u => u.id)
    
    // 获取积分统计
    const { data: scores, error: scoreError } = await supabase
      .from('user_daily_scores')
      .select('user_id, total_score, current_streak')
      .in('user_id', userIds)

    if (scoreError) {
      console.error('[branch-detail] 查询积分失败:', scoreError)
    }

    // 计算每个用户的总积分
    const userScoreMap = {}
    scores?.forEach(score => {
      if (!userScoreMap[score.user_id]) {
        userScoreMap[score.user_id] = {
          total_score: 0,
          max_streak: 0,
          latest_streak: score.current_streak || 0
        }
      }
      userScoreMap[score.user_id].total_score += score.total_score || 0
      if (score.current_streak > userScoreMap[score.user_id].max_streak) {
        userScoreMap[score.user_id].max_streak = score.current_streak
      }
    })

    // 获取每个用户的记录统计
    const { data: recordStats, error: recordError } = await supabase
      .from('records')
      .select('user_id, ymd')
      .in('user_id', userIds)

    if (recordError) {
      console.error('[branch-detail] 查询记录失败:', recordError)
    }

    // 统计记录数
    const userRecordMap = {}
    recordStats?.forEach(record => {
      if (!userRecordMap[record.user_id]) {
        userRecordMap[record.user_id] = {
          total_records: 0,
          last_record_date: null
        }
      }
      userRecordMap[record.user_id].total_records += 1
      if (!userRecordMap[record.user_id].last_record_date || 
          record.ymd > userRecordMap[record.user_id].last_record_date) {
        userRecordMap[record.user_id].last_record_date = record.ymd
      }
    })

    // 合并数据
    const processedUsers = users.map(user => {
      const scoreData = userScoreMap[user.id] || { total_score: 0, max_streak: 0 }
      const recordData = userRecordMap[user.id] || { total_records: 0, last_record_date: null }
      const profile = user.user_profile || {}

      return {
        user_id: user.id,
        name: user.name,
        display_name: profile.display_name || user.name,
        telegram_id: user.telegram_id,
        branch_code: user.branch_code,
        email: profile.email,
        phone: profile.phone_e164,
        
        // 积分数据
        total_score: scoreData.total_score,
        current_streak: profile.current_streak || scoreData.latest_streak || 0,
        max_streak: profile.max_streak || scoreData.max_streak || 0,
        
        // 记录数据
        total_records: profile.total_records || recordData.total_records,
        last_record_date: profile.last_record_date || recordData.last_record_date,
        
        // 财务数据
        monthly_income: profile.monthly_income || 0,
        a_pct: profile.a_pct || 0,
        travel_budget: profile.travel_budget_annual || 0,
        medical_insurance: profile.annual_medical_insurance || 0,
        car_insurance: profile.annual_car_insurance || 0,
        
        // 其他
        status: user.status,
        joined_date: user.created_at
      }
    })

    // 按积分排序
    processedUsers.sort((a, b) => b.total_score - a.total_score)

    console.log(`[branch-detail] 返回 ${processedUsers.length} 个用户数据`)

    return res.status(200).json({
      success: true,
      branch: branch || 'ALL',
      total: processedUsers.length,
      users: processedUsers
    })

  } catch (error) {
    console.error('[branch-detail] 错误:', error)
    return res.status(500).json({
      error: '获取数据失败',
      details: error.message
    })
  }
}