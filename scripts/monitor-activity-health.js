#!/usr/bin/env node

/**
 * 活动期间健康监控脚本
 * 检查300人记账活动的系统健康状态
 */

import supabase from '../lib/supabase.js'

async function monitorActivityHealth() {
  console.log('📊 Activity Health Monitor - September Challenge')
  console.log('=' .repeat(60))
  
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = '2025-09'
  
  try {
    // 1. 用户预算记录覆盖率
    console.log('\n1. 📋 Budget Record Coverage:')
    
    const { data: activeUsers } = await supabase
      .from('user_profile')
      .select('user_id')
      .not('chat_id', 'is', null)
    
    const { data: budgetRecords } = await supabase
      .from('user_month_budget') 
      .select('user_id')
      .eq('yyyymm', currentMonth)
    
    const totalUsers = activeUsers?.length || 0
    const usersWithBudget = budgetRecords?.length || 0
    const coverage = totalUsers > 0 ? ((usersWithBudget / totalUsers) * 100).toFixed(1) : 0
    
    console.log(`   Total active users: ${totalUsers}`)
    console.log(`   Users with Sept budget: ${usersWithBudget}`)
    console.log(`   Coverage: ${coverage}% ${coverage < 100 ? '⚠️' : '✅'}`)
    
    // 2. 今日记录活跃度
    console.log('\n2. 📈 Daily Activity:')
    
    const { data: todayRecords } = await supabase
      .from('records')
      .select('user_id')
      .eq('ymd', today)
      .eq('is_voided', false)
    
    const activeToday = new Set(todayRecords?.map(r => r.user_id) || []).size
    const participationRate = totalUsers > 0 ? ((activeToday / totalUsers) * 100).toFixed(1) : 0
    
    console.log(`   Users active today: ${activeToday}`)
    console.log(`   Participation rate: ${participationRate}%`)
    
    // 3. 连续记录情况
    console.log('\n3. 🔥 Streak Status:')
    
    const { data: streaks } = await supabase
      .from('user_profile')
      .select('current_streak')
      .not('chat_id', 'is', null)
      .not('current_streak', 'is', null)
    
    const streakData = streaks?.map(s => s.current_streak) || []
    const avgStreak = streakData.length > 0 ? 
      (streakData.reduce((a, b) => a + b, 0) / streakData.length).toFixed(1) : 0
    const maxStreak = Math.max(...streakData, 0)
    
    console.log(`   Average streak: ${avgStreak} days`)
    console.log(`   Longest streak: ${maxStreak} days`)
    console.log(`   Users with 7+ days: ${streakData.filter(s => s >= 7).length}`)
    
    // 4. 系统健康检查
    console.log('\n4. 🏥 System Health:')
    
    // 检查是否有孤立的预算记录
    const { data: orphanBudgets } = await supabase
      .from('user_month_budget')
      .select('user_id')
      .eq('yyyymm', currentMonth)
      .not('user_id', 'in', `(${activeUsers?.map(u => `'${u.user_id}'`).join(',') || "''"})`)
    
    console.log(`   Orphan budget records: ${orphanBudgets?.length || 0}`)
    console.log(`   System status: ${coverage >= 95 ? '✅ Healthy' : '⚠️ Needs attention'}`)
    
    // 5. 活动进度总结
    const septemberDay = new Date().getDate()
    const progressPercent = ((septemberDay / 30) * 100).toFixed(1)
    
    console.log('\n5. 🎯 Challenge Progress:')
    console.log(`   Day ${septemberDay}/30 (${progressPercent}%)`)
    console.log(`   Target: 300 users developing daily habits`)
    console.log(`   Current active users: ${totalUsers}`)
    
    console.log('\n' + '=' .repeat(60))
    console.log('✅ Health check completed!')
    
  } catch (error) {
    console.error('❌ Health check failed:', error)
  }
}

monitorActivityHealth()