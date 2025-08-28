import supabase from './supabase.js'
import { format } from 'date-fns'
import { calculateBranchScoresDaily } from './scoring-system.js'

/**
 * 基于积分的分行排行榜系统
 * 替换原有的完成率排名系统
 */

/**
 * 计算并更新分行积分排行榜
 * @param {Date} forDate - 计算日期
 */
export async function computeScoreLeaderboards(forDate = new Date()) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  console.log(`[积分排行榜] 计算日期: ${ymd}`)
  
  try {
    // 1. 计算分行每日积分
    const branchScores = await calculateBranchScoresDaily(forDate)
    
    if (branchScores.length === 0) {
      console.log('[积分排行榜] 无分行数据，跳过排行榜计算')
      return { ymd, branchTop: [], userTop: [] }
    }
    
    // 2. 计算个人积分排行榜(前15名)
    const userTop = await calculateUserScoreRanking(forDate)
    
    // 3. 格式化分行排行榜数据(与原系统兼容)
    const branchTop = branchScores.map(branch => ({
      branch_code: branch.branch_code,
      rank: branch.branch_rank,
      
      // 积分数据
      total_score: branch.total_score,
      avg_score: branch.avg_score,
      
      // 兼容原有字段(用于显示)
      done: branch.active_members,    // 今日活跃人数
      total: branch.total_members,    // 分行总人数
      rate: branch.avg_score,         // 用平均积分替代完成率
      
      // 新增积分相关指标
      participation_rate: branch.total_members > 0 ? 
        Math.round((branch.active_members / branch.total_members) * 100) : 0,
      
      // 计算7天平均积分(暂时使用当前值，后续可扩展)
      avg_7day_score: branch.avg_score
    }))
    
    // 4. 保存到原有的leaderboard_daily表(保持兼容性)
    await supabase
      .from('leaderboard_daily')
      .upsert({ 
        ymd, 
        top_json: userTop, 
        branch_top_json: branchTop 
      }, { onConflict: 'ymd' })
    
    console.log(`[积分排行榜] 已保存 ${branchTop.length} 个分行排名, ${userTop.length} 个用户排名`)
    
    return { ymd, branchTop, userTop }
    
  } catch (error) {
    console.error('[积分排行榜] 计算失败:', error)
    throw error
  }
}

/**
 * 计算用户积分排行榜
 * @param {Date} forDate - 计算日期  
 */
export async function calculateUserScoreRanking(forDate = new Date()) {
  const ymd = format(forDate, 'yyyy-MM-dd')
  
  // 获取当日所有用户积分，按总积分降序排列
  const { data: userScores } = await supabase
    .from('user_daily_scores')
    .select(`
      user_id, 
      total_score, 
      base_score, 
      streak_score, 
      bonus_score, 
      current_streak,
      record_type
    `)
    .eq('ymd', ymd)
    .order('total_score', { ascending: false })
    .order('current_streak', { ascending: false })
  
  if (!userScores || userScores.length === 0) {
    console.log('[用户积分排行榜] 当日无积分记录')
    return []
  }
  
  // 获取用户基本信息
  const userIds = userScores.map(u => u.user_id)
  const { data: userProfiles } = await supabase
    .from('user_profile')
    .select('user_id, display_name')
    .in('user_id', userIds)
  
  const { data: users } = await supabase
    .from('users')
    .select('id, name, branch_code')
    .in('id', userIds)
  
  // 构建用户信息映射
  const profileMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])
  const userMap = new Map(users?.map(u => [u.id, u]) || [])
  
  // 构建最终排行榜数据
  const userTop = userScores.map((score, index) => {
    const profile = profileMap.get(score.user_id)
    const user = userMap.get(score.user_id)
    
    return {
      rank: index + 1,
      user_id: score.user_id,
      name: profile?.display_name || user?.name || '未知用户',
      branch_code: user?.branch_code || null,
      
      // 积分明细
      total_score: score.total_score,
      base_score: score.base_score,
      streak_score: score.streak_score,
      bonus_score: score.bonus_score,
      current_streak: score.current_streak,
      record_type: score.record_type,
      
      // 兼容原有字段
      sum_a: 0,  // 原系统的A类支出，积分系统暂不使用
      sum_b: 0,
      sum_c: 0,
      total: score.total_score  // 总分作为排序依据
    }
  })
  
  console.log(`[用户积分排行榜] 生成${userTop.length}个用户排名`)
  
  return userTop
}

/**
 * 获取分行积分历史数据
 * @param {string} branchCode - 分行代码
 * @param {number} days - 查询天数 
 */
export async function getBranchScoreHistory(branchCode, days = 7) {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - (days - 1) * 86400000)
  
  const { data: history } = await supabase
    .from('branch_scores_daily')
    .select('*')
    .eq('branch_code', branchCode)
    .gte('ymd', format(startDate, 'yyyy-MM-dd'))
    .lte('ymd', format(endDate, 'yyyy-MM-dd'))
    .order('ymd')
  
  return history || []
}

/**
 * 获取积分排行榜数据(兼容原有API)
 * @param {string} ymd - 查询日期
 */
export async function getScoreLeaderboardData(ymd) {
  const { data: leaderboard } = await supabase
    .from('leaderboard_daily')
    .select('top_json, branch_top_json')
    .eq('ymd', ymd)
    .maybeSingle()
  
  if (!leaderboard) {
    return { userTop: [], branchTop: [] }
  }
  
  return {
    userTop: leaderboard.top_json || [],
    branchTop: leaderboard.branch_top_json || []
  }
}

/**
 * 生成积分排行榜消息模板
 * @param {Object} branchData - 分行数据
 */
export function formatScoreBranchMessage(branchData) {
  const {
    branch_code,
    rank,
    avg_score,
    total_score,
    active_members,
    total_members,
    participation_rate,
    avg_7day_score
  } = branchData
  
  return `🏢 分行积分排行榜 (每日更新)

🏆 ${branch_code} 分行 (第${rank}名)
• 平均积分：${avg_score}分
• 总积分：${total_score}分
• 参与率：${participation_rate}% (${active_members}/${total_members}人)
• 7日均分：${avg_7day_score}分

🎯 目标：提升分行平均积分！
💪 鼓励更多成员参与积分挑战！`
}

/**
 * 用户个人积分报告模板
 * @param {Object} userData - 用户积分数据
 */
export function formatUserScoreMessage(userData) {
  const {
    total_score,
    base_score,
    streak_score, 
    bonus_score,
    current_streak,
    record_type,
    rank
  } = userData
  
  const typeText = record_type === 'checkin' ? '每日打卡' : '开销记录'
  const milestoneText = bonus_score > 0 ? `\n🎉 里程碑奖励：+${bonus_score}分！` : ''
  
  return `📊 今日积分获得

🎯 总积分：${total_score}分 (排名第${rank || '?'}名)
• 基础分：${base_score}分 (${typeText})
• 连续分：${streak_score}分
• 奖励分：${bonus_score}分

🔥 连续记录：${current_streak}天${milestoneText}

💪 继续坚持，冲击排行榜！`
}