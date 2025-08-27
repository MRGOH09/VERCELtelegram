import supabase from './supabase.js'
import { format } from 'date-fns'

/**
 * 积分系统核心逻辑
 */

// 获取里程碑配置
export async function getMilestoneConfig() {
  const { data: milestones } = await supabase
    .from('score_milestones')
    .select('streak_days, bonus_score, milestone_name')
    .order('streak_days')
  
  return milestones || []
}

/**
 * 计算用户当日积分
 * @param {string} userId - 用户ID
 * @param {Date} date - 日期
 * @param {string} recordType - 记录类型 'record' 或 'checkin'
 */
export async function calculateDailyScore(userId, date, recordType = 'record') {
  const ymd = format(date, 'yyyy-MM-dd')
  console.log(`[积分计算] 用户${userId} 日期${ymd} 类型${recordType}`)
  
  // 1. 检查今天是否已经有积分记录
  const { data: existingScore } = await supabase
    .from('user_daily_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('ymd', ymd)
    .maybeSingle()
  
  if (existingScore) {
    console.log(`[积分计算] 今日已有记录，跳过重复计算`)
    return existingScore
  }
  
  // 2. 计算连续天数
  const streakDays = await calculateCurrentStreak(userId, date)
  console.log(`[积分计算] 当前连续天数: ${streakDays}`)
  
  // 3. 计算积分
  const baseScore = 1  // 基础分固定1分
  const streakScore = streakDays > 0 ? 1 : 0  // 连续分（连续记录给1分）
  
  // 4. 计算奖励分和奖励明细
  const milestones = await getMilestoneConfig()
  const bonusResult = calculateBonusScore(streakDays, milestones)
  
  const scoreData = {
    user_id: userId,
    ymd: ymd,
    base_score: baseScore,
    streak_score: streakScore,
    bonus_score: bonusResult.bonusScore,
    current_streak: streakDays,
    record_type: recordType,
    bonus_details: bonusResult.bonusDetails
  }
  
  // 5. 保存积分记录
  const { data: savedScore, error } = await supabase
    .from('user_daily_scores')
    .insert(scoreData)
    .select()
    .single()
  
  if (error) {
    console.error('[积分计算] 保存失败:', error)
    throw error
  }
  
  console.log(`[积分计算] 积分保存成功:`, {
    total: savedScore.total_score,
    detail: `${baseScore}基础+${streakScore}连续+${bonusResult.bonusScore}奖励`,
    streak: streakDays,
    milestones: bonusResult.bonusDetails
  })
  
  return savedScore
}

/**
 * 计算当前连续天数
 * @param {string} userId - 用户ID  
 * @param {Date} currentDate - 当前日期
 */
export async function calculateCurrentStreak(userId, currentDate) {
  const today = format(currentDate, 'yyyy-MM-dd')
  const yesterday = format(new Date(currentDate.getTime() - 86400000), 'yyyy-MM-dd')
  
  // 查询用户最近的积分记录(按日期降序)
  const { data: recentScores } = await supabase
    .from('user_daily_scores')
    .select('ymd, current_streak')
    .eq('user_id', userId)
    .lt('ymd', today)  // 小于今天的记录
    .order('ymd', { ascending: false })
    .limit(1)
  
  // 如果没有历史记录，今天是第1天
  if (!recentScores || recentScores.length === 0) {
    console.log('[连续计算] 无历史记录，今天是第1天')
    return 1
  }
  
  const lastRecord = recentScores[0]
  console.log(`[连续计算] 最近记录: ${lastRecord.ymd}, 连续${lastRecord.current_streak}天`)
  
  // 如果昨天有记录，连续天数+1
  if (lastRecord.ymd === yesterday) {
    const newStreak = lastRecord.current_streak + 1
    console.log(`[连续计算] 昨天有记录，连续天数: ${lastRecord.current_streak} + 1 = ${newStreak}`)
    return newStreak
  } else {
    // 如果昨天没记录，重新开始，今天是第1天
    console.log('[连续计算] 昨天无记录，重新开始，今天是第1天')
    return 1
  }
}

/**
 * 计算奖励分数
 * @param {number} streakDays - 连续天数
 * @param {Array} milestones - 里程碑配置
 */
export function calculateBonusScore(streakDays, milestones) {
  const bonusDetails = []
  let bonusScore = 0
  
  for (const milestone of milestones) {
    if (streakDays === milestone.streak_days) {
      bonusScore += milestone.bonus_score
      bonusDetails.push({
        milestone: milestone.streak_days,
        score: milestone.bonus_score,
        name: milestone.milestone_name
      })
      console.log(`[奖励计算] 达成${milestone.streak_days}天里程碑，获得${milestone.bonus_score}分奖励`)
    }
  }
  
  return { bonusScore, bonusDetails }
}

/**
 * 记录开销时触发积分计算
 * @param {string} userId - 用户ID
 * @param {Date} date - 记录日期
 */
export async function onUserRecord(userId, date = new Date()) {
  try {
    const score = await calculateDailyScore(userId, date, 'record')
    console.log(`[记录积分] 用户${userId} 开销记录 获得${score.total_score}分`)
    return score
  } catch (error) {
    console.error('[记录积分] 失败:', error)
    throw error
  }
}

/**
 * 用户打卡时触发积分计算
 * @param {string} userId - 用户ID
 * @param {Date} date - 打卡日期
 */
export async function onUserCheckIn(userId, date = new Date()) {
  try {
    const score = await calculateDailyScore(userId, date, 'checkin')
    console.log(`[打卡积分] 用户${userId} 每日打卡 获得${score.total_score}分`)
    return score
  } catch (error) {
    console.error('[打卡积分] 失败:', error)
    throw error
  }
}

/**
 * 计算分行每日积分排名
 * @param {Date} date - 计算日期
 */
export async function calculateBranchScoresDaily(date = new Date()) {
  const ymd = format(date, 'yyyy-MM-dd')
  console.log(`[分行积分] 计算${ymd}分行排名`)
  
  // 1. 获取所有有分行的用户
  const { data: users } = await supabase
    .from('users')
    .select('id, branch_code')
    .not('branch_code', 'is', null)
  
  if (!users || users.length === 0) {
    console.log('[分行积分] 无分行用户')
    return []
  }
  
  // 2. 获取今日所有用户积分
  const userIds = users.map(u => u.id)
  const { data: dailyScores } = await supabase
    .from('user_daily_scores')
    .select('user_id, total_score')
    .eq('ymd', ymd)
    .in('user_id', userIds)
  
  // 3. 按分行统计积分
  const branchStats = new Map()
  
  // 初始化所有分行
  users.forEach(user => {
    const branch = user.branch_code
    if (!branchStats.has(branch)) {
      branchStats.set(branch, {
        branch_code: branch,
        total_members: 0,
        active_members: 0,
        total_score: 0,
        avg_score: 0
      })
    }
    branchStats.get(branch).total_members++
  })
  
  // 统计积分
  const scoreMap = new Map((dailyScores || []).map(s => [s.user_id, s.total_score]))
  
  users.forEach(user => {
    const branch = user.branch_code
    const score = scoreMap.get(user.id) || 0
    const stats = branchStats.get(branch)
    
    if (score > 0) {
      stats.active_members++
    }
    stats.total_score += score
  })
  
  // 计算平均分并排序
  const branchArray = Array.from(branchStats.values()).map(branch => ({
    ...branch,
    avg_score: branch.total_members > 0 ? 
      Math.round((branch.total_score / branch.total_members) * 100) / 100 : 0
  })).sort((a, b) => b.avg_score - a.avg_score)
  
  // 添加排名
  branchArray.forEach((branch, index) => {
    branch.branch_rank = index + 1
  })
  
  // 4. 保存到数据库
  const branchScoreRecords = branchArray.map(branch => ({
    branch_code: branch.branch_code,
    ymd: ymd,
    total_members: branch.total_members,
    active_members: branch.active_members,
    total_score: branch.total_score,
    avg_score: branch.avg_score,
    branch_rank: branch.branch_rank
  }))
  
  if (branchScoreRecords.length > 0) {
    await supabase
      .from('branch_scores_daily')
      .upsert(branchScoreRecords, { onConflict: 'branch_code,ymd' })
    
    console.log(`[分行积分] 已保存${branchScoreRecords.length}个分行排名`)
  }
  
  return branchArray
}

/**
 * 获取用户积分历史
 * @param {string} userId - 用户ID
 * @param {number} days - 查询天数(默认30天)
 */
export async function getUserScoreHistory(userId, days = 30) {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - (days - 1) * 86400000)
  
  const { data: scores } = await supabase
    .from('user_daily_scores')
    .select('*')
    .eq('user_id', userId)
    .gte('ymd', format(startDate, 'yyyy-MM-dd'))
    .lte('ymd', format(endDate, 'yyyy-MM-dd'))
    .order('ymd', { ascending: false })
  
  return scores || []
}