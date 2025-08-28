import { createClient } from '@supabase/supabase-js'
import { validateJWTToken } from '../../../lib/auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // JWT Token验证
    const user = await validateJWTToken(req)
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const userId = user.id
    const userBranch = user.branch_code

    console.log(`[test-branch-debug] 用户 ${userId} 分院: ${userBranch}`)

    // 1. 获取所有用户的历史积分记录
    const { data: allScores, error: allError } = await supabase
      .from('user_daily_scores')
      .select(`
        user_id,
        total_score,
        current_streak,
        ymd,
        users!inner(id, name, branch_code),
        user_profile(display_name)
      `)

    console.log(`[test-branch-debug] 原始积分记录: ${allScores?.length || 0} 条`)

    // 2. 按用户汇总历史总积分
    const userTotalScores = new Map()
    
    if (allScores) {
      allScores.forEach(score => {
        const scoreUserId = score.user_id
        if (!userTotalScores.has(scoreUserId)) {
          userTotalScores.set(scoreUserId, {
            user_id: scoreUserId,
            total_score: 0,
            max_streak: 0,
            users: score.users,
            user_profile: score.user_profile
          })
        }
        const userTotal = userTotalScores.get(scoreUserId)
        userTotal.total_score += score.total_score || 0
        userTotal.max_streak = Math.max(userTotal.max_streak, score.current_streak || 0)
      })
    }

    const allUsersScores = Array.from(userTotalScores.values())
      .sort((a, b) => b.total_score - a.total_score)

    console.log(`[test-branch-debug] 用户总积分汇总: ${allUsersScores.length} 个用户`)

    // 3. 获取所有有分行的用户
    const { data: allBranchUsers, error: branchError } = await supabase
      .from('users')
      .select('id, branch_code')
      .not('branch_code', 'is', null)

    console.log(`[test-branch-debug] 分院用户: ${allBranchUsers?.length || 0} 人`)

    // 4. 按分行统计积分
    const branchStatsMap = new Map()
    
    // 初始化分行统计
    if (allBranchUsers) {
      allBranchUsers.forEach(branchUser => {
        if (!branchStatsMap.has(branchUser.branch_code)) {
          branchStatsMap.set(branchUser.branch_code, {
            branch_code: branchUser.branch_code,
            total_members: 0,
            active_members: 0,
            total_score: 0,
            avg_score: 0,
            user_details: [] // 调试用：记录用户详情
          })
        }
        branchStatsMap.get(branchUser.branch_code).total_members++
      })
    }

    // 统计历史总积分
    const userTotalScoreMap = new Map(allUsersScores.map(user => [user.user_id, user.total_score]))
    
    if (allBranchUsers) {
      allBranchUsers.forEach(branchUser => {
        const totalScore = userTotalScoreMap.get(branchUser.id) || 0
        const stats = branchStatsMap.get(branchUser.branch_code)
        if (stats) {
          if (totalScore > 0) {
            stats.active_members++
          }
          stats.total_score += totalScore
          
          // 调试用：记录用户详情
          stats.user_details.push({
            user_id: branchUser.id,
            total_score: totalScore
          })
        }
      })
    }

    // 计算平均分
    branchStatsMap.forEach(stats => {
      stats.avg_score = stats.total_members > 0 
        ? Math.round((stats.total_score / stats.total_members) * 100) / 100 
        : 0
    })

    // 转换为对象便于调试显示
    const branchStatsObject = {}
    branchStatsMap.forEach((stats, branchCode) => {
      branchStatsObject[branchCode] = stats
    })

    console.log(`[test-branch-debug] 分院统计完成:`, branchStatsObject)

    // 5. 特别关注用户所在分院
    const userBranchStats = branchStatsMap.get(userBranch)
    console.log(`[test-branch-debug] 用户分院 ${userBranch} 统计:`, userBranchStats)

    return res.status(200).json({
      ok: true,
      message: '分院积分调试完成',
      debug: {
        userId,
        userBranch,
        allScores: allScores?.length || 0,
        userScores: allUsersScores.slice(0, 10), // 前10名用户
        allBranchUsers: allBranchUsers?.length || 0,
        branchStats: branchStatsObject,
        userBranchStats: userBranchStats,
        // 特别显示用户的积分计算
        currentUserScore: allUsersScores.find(u => u.user_id === userId)
      }
    })

  } catch (error) {
    console.error('[test-branch-debug] 错误:', error)
    return res.status(500).json({
      ok: false,
      error: error.message || '分院积分调试失败',
      debug: {
        errorDetails: error.stack
      }
    })
  }
}