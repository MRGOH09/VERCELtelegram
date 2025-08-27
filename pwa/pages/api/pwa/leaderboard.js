import { createClient } from '@supabase/supabase-js'
import { validateJWTToken } from '../../../lib/auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// 计算时间范围
function calculateDateRange(timeframe) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  
  switch (timeframe) {
    case 'today':
      return {
        startDate: today,
        endDate: today,
        isMultiDay: false,
        label: '今日排行'
      }
      
    case 'week':
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 6) // 过去7天
      return {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: today,
        isMultiDay: true,
        label: '7日排行'
      }
      
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        startDate: monthStart.toISOString().split('T')[0],
        endDate: today,
        isMultiDay: true,
        label: '本月排行'
      }
      
    default:
      return {
        startDate: today,
        endDate: today,
        isMultiDay: false,
        label: '今日排行'
      }
  }
}

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
    
    // 获取查询参数
    const { timeframe = 'today' } = req.query
    
    // 根据时间范围计算日期
    const dateRange = calculateDateRange(timeframe)
    const { startDate, endDate, isMultiDay, label } = dateRange
    
    console.log(`[leaderboard] 查询时间范围: ${timeframe}, ${startDate} 到 ${endDate}`)

    // 2. 根据是否多日期调整用户积分查询
    let allUsersScores, allError
    
    if (isMultiDay) {
      // 多日期查询：汇总用户在时间范围内的积分
      const { data: multiDayScores, error: multiError } = await supabase
        .from('user_daily_scores')
        .select(`
          user_id,
          total_score,
          current_streak,
          ymd
        `)
        .gte('ymd', startDate)
        .lte('ymd', endDate)
        .order('user_id')
        .order('ymd')
      
      allError = multiError
      
      if (!multiError && multiDayScores) {
        // 按用户汇总积分
        const userScoreMap = new Map()
        multiDayScores.forEach(score => {
          if (!userScoreMap.has(score.user_id)) {
            userScoreMap.set(score.user_id, {
              user_id: score.user_id,
              total_score: 0,
              max_streak: 0,
              days_active: 0
            })
          }
          const userScore = userScoreMap.get(score.user_id)
          userScore.total_score += score.total_score
          userScore.max_streak = Math.max(userScore.max_streak, score.current_streak)
          userScore.days_active += 1
        })
        
        // 转换为数组并排序
        allUsersScores = Array.from(userScoreMap.values())
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 20)
          
        // 获取用户信息
        if (allUsersScores.length > 0) {
          const userIds = allUsersScores.map(u => u.user_id)
          const { data: users } = await supabase
            .from('users')
            .select('id, name, branch_code')
            .in('id', userIds)
            
          const { data: profiles } = await supabase
            .from('user_profile')
            .select('user_id, display_name')
            .in('user_id', userIds)
            
          // 合并用户信息
          const userMap = new Map(users?.map(u => [u.id, u]) || [])
          const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
          
          allUsersScores = allUsersScores.map(score => ({
            ...score,
            users: userMap.get(score.user_id),
            user_profile: profileMap.get(score.user_id),
            current_streak: score.max_streak // 使用最大连续天数
          }))
        }
      }
    } else {
      // 单日查询：保持原有逻辑
      const result = await supabase
        .from('user_daily_scores')
        .select(`
          user_id,
          total_score,
          current_streak,
          users!inner(id, name, branch_code),
          user_profile(display_name)
        `)
        .eq('ymd', startDate)
        .order('total_score', { ascending: false })
        .limit(20)
        
      allUsersScores = result.data
      allError = result.error
    }

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
        let branchScores, branchError
        
        if (isMultiDay) {
          // 多日期查询分院用户
          const { data: multiBranchScores, error: multiBranchError } = await supabase
            .from('user_daily_scores')
            .select(`
              user_id,
              total_score,
              current_streak,
              ymd,
              users!inner(id, name, branch_code)
            `)
            .gte('ymd', startDate)
            .lte('ymd', endDate)
            .eq('users.branch_code', userBranch)
            
          branchError = multiBranchError
          
          if (!multiBranchError && multiBranchScores) {
            // 按分院用户汇总积分
            const branchUserMap = new Map()
            multiBranchScores.forEach(score => {
              if (!branchUserMap.has(score.user_id)) {
                branchUserMap.set(score.user_id, {
                  user_id: score.user_id,
                  total_score: 0,
                  max_streak: 0,
                  users: score.users
                })
              }
              const userScore = branchUserMap.get(score.user_id)
              userScore.total_score += score.total_score
              userScore.max_streak = Math.max(userScore.max_streak, score.current_streak)
            })
            
            branchScores = Array.from(branchUserMap.values())
              .sort((a, b) => b.total_score - a.total_score)
              .slice(0, 10)
              .map(score => ({
                ...score,
                current_streak: score.max_streak
              }))
              
            // 获取用户profile信息
            if (branchScores.length > 0) {
              const userIds = branchScores.map(u => u.user_id)
              const { data: profiles } = await supabase
                .from('user_profile')
                .select('user_id, display_name')
                .in('user_id', userIds)
                
              const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
              branchScores = branchScores.map(score => ({
                ...score,
                user_profile: profileMap.get(score.user_id)
              }))
            }
          }
        } else {
          // 单日查询分院用户：保持原有逻辑
          const result = await supabase
            .from('user_daily_scores')
            .select(`
              user_id,
              total_score,
              current_streak,
              users!inner(id, name, branch_code),
              user_profile(display_name)
            `)
            .eq('ymd', startDate)
            .eq('users.branch_code', userBranch)
            .order('total_score', { ascending: false })
            .limit(10)
            
          branchScores = result.data
          branchError = result.error
        }

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

    // 7. 获取全国分院排行榜（使用平均分数）
    let branchRankings, branchRankError
    
    if (isMultiDay) {
      // 多日期查询：汇总分院积分
      const { data: multiBranchRankings, error: multiBranchError } = await supabase
        .from('branch_scores_daily')
        .select('*')
        .gte('ymd', startDate)
        .lte('ymd', endDate)
        .order('branch_code')
        .order('ymd')
        
      branchRankError = multiBranchError
      
      if (!multiBranchError && multiBranchRankings) {
        // 按分院汇总数据
        const branchMap = new Map()
        multiBranchRankings.forEach(branch => {
          if (!branchMap.has(branch.branch_code)) {
            branchMap.set(branch.branch_code, {
              branch_code: branch.branch_code,
              total_score: 0,
              total_members: branch.total_members, // 使用最新的成员数
              active_days: 0,
              total_active_members: 0,
              days_count: 0
            })
          }
          const branchData = branchMap.get(branch.branch_code)
          branchData.total_score += branch.total_score
          branchData.total_active_members += branch.active_members
          branchData.days_count += 1
        })
        
        // 计算平均分并排序
        branchRankings = Array.from(branchMap.values()).map(branch => ({
          ...branch,
          avg_score: branch.days_count > 0 ? 
            Math.round((branch.total_score / branch.days_count / branch.total_members) * 100) / 100 : 0,
          active_members: Math.round(branch.total_active_members / branch.days_count) || 0
        })).sort((a, b) => b.avg_score - a.avg_score).slice(0, 20)
      }
    } else {
      // 单日查询：保持原有逻辑
      const result = await supabase
        .from('branch_scores_daily')
        .select('*')
        .eq('ymd', startDate)
        .order('avg_score', { ascending: false })
        .limit(20)
        
      branchRankings = result.data
      branchRankError = result.error
    }

    if (branchRankError) {
      console.error('获取分院排行失败:', branchRankError)
    }

    if (branchError) {
      console.error('获取分院排行失败:', branchError)
    }

    console.log(`[leaderboard] 分院排行数据: ${branchRankings?.length || 0} 条记录`)

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
        userBranch: userBranch,
        timeframe: {
          type: timeframe,
          label: label,
          startDate: startDate,
          endDate: endDate,
          isMultiDay: isMultiDay
        }
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