#!/usr/bin/env node

// 奖励触发测试脚本 - 使用直接配置
const supabaseUrl = 'https://ezrpmrnfdvtfxwnyekzi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnBtcm5mZHZ0Znh3bnlla3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NDcyODEsImV4cCI6MjA3MDQyMzI4MX0.KOSIhXIWASj0olOOzKHxgwk7hk4-nmlsnQcktOWNAXk'

// 简化的Supabase客户端 - 使用fetch API
async function supabaseQuery(table, options = {}) {
  const { select = '*', order, limit, filter } = options
  
  let url = `${supabaseUrl}/rest/v1/${table}?select=${select}`
  
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      url += `&${key}=${encodeURIComponent(value)}`
    })
  }
  
  if (order) {
    url += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`
  }
  
  if (limit) {
    url += `&limit=${limit}`
  }
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.statusText}`)
  }
  
  return await response.json()
}


async function testScoringRewards() {
  console.log('🔍 测试积分奖励触发机制\n')
  
  // 1. 检查里程碑配置
  console.log('1️⃣ 检查里程碑配置:')
  const milestones = await supabaseQuery('score_milestones', {
    order: { column: 'streak_days', ascending: true }
  })
  
  if (milestones && milestones.length > 0) {
    console.log('✅ 里程碑配置:')
    milestones.forEach(m => {
      console.log(`   • ${m.streak_days}天 → ${m.bonus_score}分 (${m.milestone_name})`)
    })
  } else {
    console.log('❌ 没有找到里程碑配置')
    return
  }
  
  // 2. 检查用户积分历史
  console.log('\n2️⃣ 检查最近的积分记录:')
  const recentScores = await supabaseQuery('user_daily_scores', {
    select: 'user_id,ymd,current_streak,base_score,streak_score,bonus_score,total_score,bonus_details',
    order: { column: 'ymd', ascending: false },
    limit: 10
  })
  
  if (recentScores && recentScores.length > 0) {
    console.log('✅ 最近10条积分记录:')
    recentScores.forEach(s => {
      const bonusInfo = s.bonus_score > 0 ? ` 🏆${s.bonus_score}奖励分` : ''
      const achievementInfo = s.bonus_details && s.bonus_details.length > 0 ? 
        ` (成就: ${s.bonus_details.map(b => b.name).join(',')})` : ''
      console.log(`   • ${s.ymd} 连续${s.current_streak}天 = ${s.total_score}分 (${s.base_score}基础+${s.streak_score}连续${bonusInfo})${achievementInfo}`)
    })
  } else {
    console.log('❌ 没有找到积分记录')
  }
  
  // 3. 检查具体奖励触发情况
  console.log('\n3️⃣ 分析奖励触发情况:')
  const rewardsTriggered = recentScores?.filter(s => s.bonus_score > 0) || []
  
  if (rewardsTriggered.length > 0) {
    console.log(`✅ 发现 ${rewardsTriggered.length} 次奖励触发:`)
    rewardsTriggered.forEach(r => {
      console.log(`   • ${r.ymd}: 连续${r.current_streak}天 → 获得${r.bonus_score}分奖励`)
      if (r.bonus_details) {
        r.bonus_details.forEach(bonus => {
          console.log(`     - ${bonus.name}: ${bonus.score}分`)
        })
      }
    })
  } else {
    console.log('⚠️  没有发现奖励触发记录')
    
    // 分析可能的原因
    const maxStreak = Math.max(...(recentScores?.map(s => s.current_streak) || [0]))
    const minMilestone = Math.min(...milestones.map(m => m.streak_days))
    
    console.log(`\n🔍 分析原因:`)
    console.log(`   • 当前最大连续天数: ${maxStreak}`)
    console.log(`   • 最低里程碑要求: ${minMilestone}天`)
    
    if (maxStreak < minMilestone) {
      console.log(`   ❌ 连续天数不足，需要达到${minMilestone}天才能获得首次奖励`)
    } else {
      console.log(`   ⚠️  连续天数已达标，但未触发奖励，可能是逻辑问题`)
    }
  }
  
  // 4. 检查今日可能的奖励
  console.log('\n4️⃣ 检查今日潜在奖励:')
  if (recentScores && recentScores.length > 0) {
    const latest = recentScores[0]
    const nextStreak = latest.current_streak + 1
    const nextReward = milestones.find(m => m.streak_days === nextStreak)
    
    if (nextReward) {
      console.log(`🎯 下次打卡/记录将触发奖励:`)
      console.log(`   • 连续${nextReward.streak_days}天 → ${nextReward.bonus_score}分 (${nextReward.milestone_name})`)
    } else {
      console.log(`📈 下次打卡/记录将是连续第${nextStreak}天 (暂无奖励)`)
    }
  }
  
  console.log('\n✅ 奖励触发机制检查完成')
}

// 运行测试
testScoringRewards().catch(console.error)