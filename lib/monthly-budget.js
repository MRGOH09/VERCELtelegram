import supabase from './supabase.js'

/**
 * 确保用户在指定月份有预算记录，如果没有则自动创建
 * 这解决了月份切换时缺失预算快照的问题
 * @param {string} userId - 用户ID
 * @param {string} yyyymm - 月份格式 YYYY-MM
 * @returns {Promise<boolean>} 是否创建了新记录
 */
export async function ensureMonthlyBudget(userId, yyyymm) {
  try {
    console.log(`[monthly-budget] Checking budget for user ${userId} in ${yyyymm}`)
    
    // 检查是否已存在该月预算记录
    const { data: existing, error: checkError } = await supabase
      .from('user_month_budget')
      .select('user_id')
      .eq('user_id', userId)
      .eq('yyyymm', yyyymm)
      .maybeSingle()
      
    if (checkError) {
      console.error(`[monthly-budget] Error checking existing budget:`, checkError)
      throw checkError
    }
    
    if (existing) {
      console.log(`[monthly-budget] Budget already exists for ${userId} in ${yyyymm}`)
      return false // 已存在，无需创建
    }
    
    // 获取用户当前profile作为基础数据
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('monthly_income, a_pct, b_pct')
      .eq('user_id', userId)
      .single()
      
    if (profileError) {
      console.error(`[monthly-budget] Error fetching user profile:`, profileError)
      throw profileError
    }
    
    if (!profile) {
      console.warn(`[monthly-budget] No profile found for user ${userId}`)
      return false
    }
    
    // 创建新的月度预算记录
    const newBudget = {
      user_id: userId,
      yyyymm: yyyymm,
      income: profile.monthly_income || 0,
      a_pct: profile.a_pct || 0,
      b_pct: profile.b_pct || 0
    }
    
    const { error: upsertError } = await supabase
      .from('user_month_budget')
      .upsert([newBudget], {
        onConflict: 'user_id,yyyymm',
        ignoreDuplicates: false
      })
      
    if (upsertError) {
      console.error(`[monthly-budget] Error creating budget record:`, upsertError)
      throw upsertError
    }
    
    console.log(`[monthly-budget] ✅ Created budget for user ${userId} in ${yyyymm}:`, {
      income: newBudget.income,
      a_pct: newBudget.a_pct,
      b_pct: newBudget.b_pct
    })
    
    return true // 成功创建新记录
    
  } catch (error) {
    console.error(`[monthly-budget] Failed to ensure budget for ${userId} in ${yyyymm}:`, error)
    throw error
  }
}

/**
 * 批量确保多个用户的月度预算记录
 * @param {Array<{userId: string, yyyymm: string}>} budgetRequests - 预算请求列表
 * @returns {Promise<{created: number, existed: number, failed: number}>}
 */
export async function batchEnsureMonthlyBudgets(budgetRequests) {
  console.log(`[monthly-budget] Batch ensuring ${budgetRequests.length} budget records`)
  
  const results = await Promise.allSettled(
    budgetRequests.map(({ userId, yyyymm }) => ensureMonthlyBudget(userId, yyyymm))
  )
  
  const stats = {
    created: 0,
    existed: 0, 
    failed: 0
  }
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value === true) {
        stats.created++
      } else {
        stats.existed++
      }
    } else {
      stats.failed++
      console.error(`[monthly-budget] Batch item ${index} failed:`, result.reason)
    }
  })
  
  console.log(`[monthly-budget] Batch complete:`, stats)
  return stats
}

/**
 * 获取当前月份字符串 YYYY-MM
 * @returns {string}
 */
export function getCurrentYYYYMM() {
  return new Date().toISOString().slice(0, 7)
}

/**
 * 为用户确保当前月份的预算记录（便利函数）
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>}
 */
export async function ensureCurrentMonthBudget(userId) {
  const currentMonth = getCurrentYYYYMM()
  return await ensureMonthlyBudget(userId, currentMonth)
}