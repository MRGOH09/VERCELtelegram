import { createClient } from '@supabase/supabase-js'
import { validateJWTToken } from '../../../lib/auth.js'

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
    const userBranch = user.branch_code // 直接从认证用户获取分院信息

    console.log(`[leaderboard] 用户 ${userId} 分院: ${userBranch}`)

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

    // 3. 获取同分院用户排行（如果用户有分院）
    let branchUsers = []

    if (userBranch) {
      console.log(`[leaderboard] 查询 ${userBranch} 分院排行`)

      // 获取同分院用户排行
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
        console.log(`[leaderboard] ${userBranch} 分院有 ${branchUsers.length} 个用户参与积分`)
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

    // 7. 实时计算全国分院排行榜
    console.log(`[leaderboard] 开始实时计算分院排行榜`)
    
    // 获取所有有分行的用户
    const { data: allBranchUsers } = await supabase
      .from('users')
      .select('id, branch_code')
      .not('branch_code', 'is', null)
    
    // 获取今日所有用户积分
    const { data: todayScores } = await supabase
      .from('user_daily_scores')
      .select('user_id, total_score')
      .eq('ymd', today)
    
    // 按分行统计积分
    const branchStatsMap = new Map()
    
    // 初始化分行统计
    if (allBranchUsers) {
      allBranchUsers.forEach(user => {
        if (!branchStatsMap.has(user.branch_code)) {
          branchStatsMap.set(user.branch_code, {
            branch_code: user.branch_code,
            total_members: 0,
            active_members: 0,
            total_score: 0,
            avg_score: 0
          })
        }
        branchStatsMap.get(user.branch_code).total_members++
      })
    }
    
    // 统计今日积分
    const scoreMap = new Map((todayScores || []).map(s => [s.user_id, s.total_score]))
    
    if (allBranchUsers) {
      allBranchUsers.forEach(user => {
        const score = scoreMap.get(user.id) || 0
        const stats = branchStatsMap.get(user.branch_code)
        if (stats) {
          if (score > 0) {
            stats.active_members++
            stats.total_score += score
          }
        }
      })
    }
    
    // 计算平均分并排序
    const branchRankings = Array.from(branchStatsMap.values())
      .map(branch => ({
        ...branch,
        avg_score: branch.total_members > 0 
          ? Math.round((branch.total_score / branch.total_members) * 100) / 100 
          : 0
      }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 20)
    
    console.log(`[leaderboard] 实时分院排行数据: ${branchRankings.length} 条记录`)

    // 8. 格式化分院排行数据
    const formattedBranchRankings = (branchRankings || []).map((branch, index) => ({
      branch_code: branch.branch_code,
      branch_name: branch.branch_code, // 分院代码作为名称
      total_members: branch.total_members,
      active_members: branch.active_members,
      total_score: branch.total_score,
      avg_score: branch.avg_score,
      rank: index + 1
    }))

    return res.status(200).json({
      ok: true,
      data: {
        allUsers: formattedAllUsers,
        branchUsers: formattedBranchUsers,
        branchRankings: formattedBranchRankings,
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