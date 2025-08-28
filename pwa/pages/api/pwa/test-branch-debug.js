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

    // 0. 先检查表是否存在和基本统计
    const { count: totalCount, error: countError } = await supabase
      .from('user_daily_scores')
      .select('*', { count: 'exact', head: true })
    
    console.log(`[test-branch-debug] user_daily_scores表总记录数: ${totalCount || 0}`, countError)

    // 1. 首先检查user_daily_scores表是否有任何数据
    const { data: rawScores, error: rawError } = await supabase
      .from('user_daily_scores')
      .select('*')
      .limit(10)
    
    console.log(`[test-branch-debug] 原始积分表数据: ${rawScores?.length || 0} 条`, rawError)
    if (rawScores?.length > 0) {
      console.log(`[test-branch-debug] 示例数据:`, rawScores[0])
    }

    // 2. 获取所有用户的历史积分记录 - 修复JOIN关系
    // 问题：user_daily_scores和user_profile之间没有直接关系
    // 解决：通过users表作为中介，或者分别查询后合并
    
    // 方法1：只从user_daily_scores获取数据，然后单独查询用户信息
    const { data: allScores, error: allError } = await supabase
      .from('user_daily_scores')
      .select('*')
    
    console.log(`[test-branch-debug] 原始积分数据查询成功: ${allScores?.length || 0} 条`)
    
    // 获取所有相关用户的信息
    const userIds = [...new Set(allScores?.map(s => s.user_id) || [])]
    console.log(`[test-branch-debug] 需要查询的用户ID: ${userIds.length} 个`)
    
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, branch_code')
      .in('id', userIds)
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profile')
      .select('user_id, display_name')
      .in('user_id', userIds)
    
    console.log(`[test-branch-debug] 用户数据: ${usersData?.length || 0} 个`)
    console.log(`[test-branch-debug] 用户资料: ${profilesData?.length || 0} 个`)
    
    // 合并数据
    const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])
    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || [])
    
    const mergedScores = allScores?.map(score => ({
      ...score,
      users: usersMap.get(score.user_id),
      user_profile: profilesMap.get(score.user_id)
    })) || []
    
    console.log(`[test-branch-debug] 合并后数据: ${mergedScores.length} 条`)

    console.log(`[test-branch-debug] 原始积分记录: ${allScores?.length || 0} 条`)

    // 3. 按用户汇总历史总积分 - 使用合并后的数据
    const userTotalScores = new Map()
    
    if (mergedScores) {
      mergedScores.forEach(score => {
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
        // 表统计信息
        totalRecordsCount: totalCount || 0,
        countError: countError?.message || null,
        // 原始数据检查
        rawScoresCount: rawScores?.length || 0,
        rawScoresSample: rawScores?.[0] || null,
        rawError: rawError?.message || null,
        // 分离查询结果
        allScoresCount: allScores?.length || 0,
        usersDataCount: usersData?.length || 0,
        profilesDataCount: profilesData?.length || 0,
        mergedScoresCount: mergedScores?.length || 0,
        queryErrors: {
          allScores: allError?.message || null,
          users: usersError?.message || null,
          profiles: profilesError?.message || null
        },
        // 计算结果
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