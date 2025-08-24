#!/usr/bin/env node

/**
 * 主动为所有用户预创建9月预算记录
 * 在8月31日手动执行，避免9月1日的压力
 */

import { batchEnsureMonthlyBudgets } from '../lib/monthly-budget.js'
import supabase from '../lib/supabase.js'

async function preCreateSeptemberBudgets() {
  console.log('🎯 Pre-creating September budgets for all users...')
  
  try {
    // 获取所有注册用户
    const { data: users, error } = await supabase
      .from('user_profile')
      .select('user_id')
      .not('chat_id', 'is', null)  // 只处理有chat_id的活跃用户
    
    if (error) throw error
    
    console.log(`📊 Found ${users.length} active users`)
    
    // 批量创建9月预算
    const requests = users.map(user => ({
      userId: user.user_id,
      yyyymm: '2025-09'
    }))
    
    const stats = await batchEnsureMonthlyBudgets(requests)
    
    console.log('✅ September budget pre-creation completed!')
    console.log(`   Created: ${stats.created}`)
    console.log(`   Already existed: ${stats.existed}`) 
    console.log(`   Failed: ${stats.failed}`)
    
    if (stats.failed > 0) {
      console.warn('⚠️  Some budget creations failed, check logs')
    }
    
  } catch (error) {
    console.error('❌ Pre-creation failed:', error)
    process.exit(1)
  }
}

// 执行预创建
preCreateSeptemberBudgets()