import supabase from './supabase.js'

/**
 * 安全更新用户的日常汇总 - 使用UPSERT避免竞态条件
 * @param {string} userId - 用户ID
 * @param {string} ymd - 日期 YYYY-MM-DD
 * @returns {Promise<void>}
 */
export async function updateDailySummary(userId, ymd) {
  try {
    // 重新计算当天所有有效记录的汇总
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('category_group, amount')
      .eq('user_id', userId)
      .eq('ymd', ymd)
      .eq('is_voided', false)

    if (recordsError) {
      console.error('Error fetching records for daily summary:', recordsError)
      throw recordsError
    }

    // 计算各类别汇总
    const summary = (records || []).reduce((acc, record) => {
      const group = record.category_group.toLowerCase()
      acc[`sum_${group}`] = (acc[`sum_${group}`] || 0) + parseFloat(record.amount || 0)
      acc.total_count += 1
      return acc
    }, { sum_a: 0, sum_b: 0, sum_c: 0, total_count: 0 })

    // 使用UPSERT原子性更新daily_summary
    const { error: upsertError } = await supabase
      .from('daily_summary')
      .upsert([{
        user_id: userId,
        ymd: ymd,
        sum_a: summary.sum_a,
        sum_b: summary.sum_b,
        sum_c: summary.sum_c,
        total_count: summary.total_count
      }], {
        onConflict: 'user_id,ymd',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('Error upserting daily summary:', upsertError)
      throw upsertError
    }

    console.log(`Daily summary updated for user ${userId} on ${ymd}:`, summary)
  } catch (error) {
    console.error('Failed to update daily summary:', error)
    throw error
  }
}

/**
 * 批量更新多个用户的日常汇总
 * @param {Array<{userId: string, ymd: string}>} updates - 更新列表
 * @returns {Promise<void>}
 */
export async function batchUpdateDailySummary(updates) {
  const results = await Promise.allSettled(
    updates.map(({ userId, ymd }) => updateDailySummary(userId, ymd))
  )
  
  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`${failures.length}/${updates.length} daily summary updates failed:`, 
      failures.map(f => f.reason))
  }
  
  return {
    success: results.length - failures.length,
    failed: failures.length,
    total: results.length
  }
}

/**
 * 触发daily summary更新的便利函数 - 在记录CRUD操作后调用
 * @param {string} userId - 用户ID
 * @param {string} ymd - 记录日期
 * @returns {Promise<void>}
 */
export async function triggerDailySummaryUpdate(userId, ymd) {
  // 异步执行，不阻塞主流程
  updateDailySummary(userId, ymd).catch(error => {
    console.error(`Failed to update daily summary for user ${userId} on ${ymd}:`, error)
  })
}