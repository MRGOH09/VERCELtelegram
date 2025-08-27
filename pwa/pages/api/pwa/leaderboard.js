import { createClient } from '@supabase/supabase-js'
import { validateJWTToken } from '../../lib/auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // JWT Token验证 - 与现有PWA API保持一致
    const user = await validateJWTToken(req)
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const userId = user.id

    // 1. 获取今日日期
    const today = new Date().toISOString().split('T')[0]

    // 2. 获取全部用户今日积分排行（前20名）
    const { data: allUsersScores, error: allError } = await supabase
      .from('user_daily_scores')
      .select(`
        user_id,
        total_score,
        current_streak,
        users!inner(id, name, branch_code),
        user_profile(display_name)
      `)
      .eq('ymd', today)
      .order('total_score', { ascending: false })
      .limit(20)

    if (allError) {
      console.error('获取全部用户排行失败:', allError)
    }

    console.log(`[leaderboard] 今日积分数据: ${allUsersScores?.length || 0} 条记录`)

    // 3. 获取用户的分院信息
    let userBranch = null
    let branchUsers = []

    if (userId) {
      const { data: userInfo } = await supabase
        .from('users')
        .select('branch_code')
        .eq('id', userId)
        .single()

      if (userInfo?.branch_code) {
        userBranch = userInfo.branch_code

        // 4. 获取同分院用户排行
        const { data: branchScores, error: branchError } = await supabase
          .from('user_daily_scores')
          .select(`
            user_id,
            total_score,
            current_streak,
            users!inner(id, name, branch_code),
            user_profile(display_name)
          `)
          .eq('ymd', today)
          .eq('users.branch_code', userBranch)
          .order('total_score', { ascending: false })
          .limit(10)

        if (branchError) {
          console.error('获取分院排行失败:', branchError)
        } else {
          branchUsers = branchScores || []
        }
      }
    }

    // 5. 格式化全部用户数据
    const formattedAllUsers = (allUsersScores || []).map(score => ({
      user_id: score.user_id,
      name: score.users?.name,
      display_name: score.user_profile?.display_name,
      branch_name: score.users?.branch_code,  // 修复：从users获取分院
      total_score: score.total_score,
      current_streak: score.current_streak
    }))

    // 6. 格式化分院用户数据
    const formattedBranchUsers = branchUsers.map(score => ({
      user_id: score.user_id,
      name: score.users?.name,
      display_name: score.user_profile?.display_name,
      total_score: score.total_score,
      current_streak: score.current_streak
    }))

    return res.status(200).json({
      ok: true,
      data: {
        allUsers: formattedAllUsers,
        branchUsers: formattedBranchUsers,
        userBranch: userBranch
      }
    })

  } catch (error) {
    console.error('排行榜API错误:', error)
    return res.status(500).json({
      ok: false,
      error: error.message || '获取排行榜失败'
    })
  }
}