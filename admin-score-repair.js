#!/usr/bin/env node

// 🛠️ 积分修复管理工具 - 立即可用版本
const supabaseUrl = 'https://ezrpmrnfdvtfxwnyekzi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnBtcm5mZHZ0Znh3bnlla3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NDcyODEsImV4cCI6MjA3MDQyMzI4MX0.KOSIhXIWASj0olOOzKHxgwk7hk4-nmlsnQcktOWNAXk'

// 简化的Supabase客户端
async function supabaseQuery(table, options = {}) {
  const { select = '*', order, limit, filter, insert, update, delete: del } = options
  
  let url = `${supabaseUrl}/rest/v1/${table}`
  let method = 'GET'
  let body = null
  
  if (insert) {
    method = 'POST'
    body = JSON.stringify(insert)
    url += `?select=${select}`
  } else if (update) {
    method = 'PATCH'  
    body = JSON.stringify(update.data)
    Object.entries(update.filter || {}).forEach(([key, value]) => {
      url += url.includes('?') ? '&' : '?'
      url += `${key}=eq.${encodeURIComponent(value)}`
    })
  } else if (del) {
    method = 'DELETE'
    Object.entries(del).forEach(([key, value]) => {
      url += url.includes('?') ? '&' : '?'
      url += `${key}=eq.${encodeURIComponent(value)}`
    })
  } else {
    url += `?select=${select}`
    
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
  }
  
  const response = await fetch(url, {
    method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': insert ? 'return=representation' : undefined
    },
    body
  })
  
  if (!response.ok) {
    throw new Error(`Supabase ${method} failed: ${response.status} ${response.statusText}`)
  }
  
  return method === 'DELETE' ? true : await response.json()
}

class ScoreRepairTool {
  constructor() {
    this.logOperations = []
  }

  log(operation, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      details
    }
    this.logOperations.push(logEntry)
    console.log(`[${logEntry.timestamp}] ${operation}: ${JSON.stringify(details)}`)
  }

  // 🔍 检测积分问题
  async detectIssues() {
    console.log('🔍 检测积分系统问题...\n')
    
    const issues = []
    
    // 1. 检测有records但无积分的记录
    console.log('1️⃣ 检查缺失的积分记录...')
    const recordsWithoutScores = await this.findRecordsWithoutScores()
    if (recordsWithoutScores.length > 0) {
      issues.push({
        type: 'missing_scores',
        count: recordsWithoutScores.length,
        description: '有记录但缺少积分的条目',
        data: recordsWithoutScores
      })
    }
    
    // 2. 检测重复积分记录
    console.log('2️⃣ 检查重复的积分记录...')
    const duplicateScores = await this.findDuplicateScores()
    if (duplicateScores.length > 0) {
      issues.push({
        type: 'duplicate_scores', 
        count: duplicateScores.length,
        description: '同一用户同一天有多条积分记录',
        data: duplicateScores
      })
    }
    
    // 3. 检测连续天数异常
    console.log('3️⃣ 检查连续天数计算异常...')
    const streakIssues = await this.findStreakIssues()
    if (streakIssues.length > 0) {
      issues.push({
        type: 'streak_issues',
        count: streakIssues.length,
        description: '连续天数计算可能有误',
        data: streakIssues
      })
    }
    
    // 4. 检测遗漏的里程碑奖励
    console.log('4️⃣ 检查遗漏的里程碑奖励...')
    const missingRewards = await this.findMissingRewards()
    if (missingRewards.length > 0) {
      issues.push({
        type: 'missing_rewards',
        count: missingRewards.length,
        description: '应获得但未获得的里程碑奖励',
        data: missingRewards
      })
    }
    
    return issues
  }
  
  async findRecordsWithoutScores() {
    // 获取最近30天的records
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10)
    
    const records = await supabaseQuery('records', {
      select: 'user_id,ymd',
      filter: { 'ymd': `gte.${startDate}` }
    })
    
    const recordsMap = new Map()
    records.forEach(r => {
      const key = `${r.user_id}-${r.ymd}`
      recordsMap.set(key, r)
    })
    
    const scores = await supabaseQuery('user_daily_scores', {
      select: 'user_id,ymd',
      filter: { 'ymd': `gte.${startDate}` }
    })
    
    const scoresSet = new Set()
    scores.forEach(s => {
      scoresSet.add(`${s.user_id}-${s.ymd}`)
    })
    
    const missing = []
    recordsMap.forEach((record, key) => {
      if (!scoresSet.has(key)) {
        missing.push(record)
      }
    })
    
    return missing.slice(0, 20) // 限制返回数量
  }
  
  async findDuplicateScores() {
    const scores = await supabaseQuery('user_daily_scores', {
      select: 'user_id,ymd',
      order: { column: 'ymd', ascending: false },
      limit: 1000
    })
    
    const seen = new Map()
    const duplicates = []
    
    scores.forEach(score => {
      const key = `${score.user_id}-${score.ymd}`
      if (seen.has(key)) {
        seen.get(key).push(score)
      } else {
        seen.set(key, [score])
      }
    })
    
    seen.forEach((scoreList, key) => {
      if (scoreList.length > 1) {
        duplicates.push({
          key,
          count: scoreList.length,
          records: scoreList
        })
      }
    })
    
    return duplicates
  }
  
  async findStreakIssues() {
    // 简化版：检查最近的积分记录中连续天数是否合理
    const scores = await supabaseQuery('user_daily_scores', {
      select: 'user_id,ymd,current_streak',
      order: { column: 'ymd', ascending: false },
      limit: 100
    })
    
    const userStreaks = new Map()
    scores.forEach(score => {
      if (!userStreaks.has(score.user_id)) {
        userStreaks.set(score.user_id, [])
      }
      userStreaks.get(score.user_id).push(score)
    })
    
    const issues = []
    userStreaks.forEach((userScores, userId) => {
      userScores.sort((a, b) => new Date(b.ymd) - new Date(a.ymd))
      
      for (let i = 0; i < userScores.length - 1; i++) {
        const current = userScores[i]
        const next = userScores[i + 1]
        
        const currentDate = new Date(current.ymd)
        const nextDate = new Date(next.ymd)
        const daysDiff = (currentDate - nextDate) / (1000 * 60 * 60 * 24)
        
        // 如果日期连续，连续天数应该递增
        if (daysDiff === 1 && current.current_streak <= next.current_streak) {
          issues.push({
            user_id: userId,
            date: current.ymd,
            issue: '连续天数未正确递增',
            current_streak: current.current_streak,
            previous_streak: next.current_streak
          })
        }
      }
    })
    
    return issues.slice(0, 10)
  }
  
  async findMissingRewards() {
    // 获取里程碑配置
    const milestones = await supabaseQuery('score_milestones')
    
    // 获取所有积分记录
    const scores = await supabaseQuery('user_daily_scores', {
      select: 'user_id,ymd,current_streak,bonus_score,bonus_details',
      order: { column: 'ymd', ascending: false },
      limit: 500
    })
    
    const missing = []
    
    scores.forEach(score => {
      const { current_streak, bonus_score, bonus_details } = score
      
      // 检查是否达到里程碑但没有奖励
      const applicableMilestones = milestones.filter(m => m.streak_days === current_streak)
      
      if (applicableMilestones.length > 0) {
        const expectedBonus = applicableMilestones.reduce((sum, m) => sum + m.bonus_score, 0)
        const actualBonus = bonus_score || 0
        
        if (actualBonus < expectedBonus) {
          missing.push({
            ...score,
            expected_bonus: expectedBonus,
            actual_bonus: actualBonus,
            missing_bonus: expectedBonus - actualBonus,
            applicable_milestones: applicableMilestones
          })
        }
      }
    })
    
    return missing.slice(0, 10)
  }

  // 🛠️ 修复功能
  async repairMissingScores(records) {
    console.log(`🛠️ 修复 ${records.length} 条缺失的积分记录...`)
    
    let repaired = 0
    for (const record of records) {
      try {
        // 重新计算积分
        const score = await this.calculateScoreForRecord(record)
        await supabaseQuery('user_daily_scores', {
          insert: score
        })
        
        this.log('repair_missing_score', {
          user_id: record.user_id,
          ymd: record.ymd,
          calculated_score: score.total_score
        })
        
        repaired++
      } catch (error) {
        console.error(`❌ 修复失败 ${record.user_id} ${record.ymd}:`, error.message)
      }
    }
    
    console.log(`✅ 成功修复 ${repaired} 条记录`)
    return repaired
  }

  async calculateScoreForRecord(record) {
    // 简化的积分计算逻辑
    const baseScore = 1
    const currentStreak = await this.calculateStreak(record.user_id, record.ymd)
    const streakScore = currentStreak > 1 ? 1 : 0
    
    // 获取里程碑配置并计算奖励
    const milestones = await supabaseQuery('score_milestones')
    let bonusScore = 0
    const bonusDetails = []
    
    milestones.forEach(milestone => {
      if (currentStreak === milestone.streak_days) {
        bonusScore += milestone.bonus_score
        bonusDetails.push({
          name: milestone.milestone_name,
          score: milestone.bonus_score
        })
      }
    })
    
    return {
      user_id: record.user_id,
      ymd: record.ymd,
      base_score: baseScore,
      streak_score: streakScore,
      bonus_score: bonusScore,
      current_streak: currentStreak,
      record_type: 'record',
      bonus_details: bonusDetails
    }
  }
  
  async calculateStreak(userId, ymd) {
    const targetDate = new Date(ymd)
    const yesterday = new Date(targetDate.getTime() - 86400000)
    const yesterdayYmd = yesterday.toISOString().slice(0, 10)
    
    // 查询用户最近的积分记录
    const recentScores = await supabaseQuery('user_daily_scores', {
      select: 'ymd,current_streak',
      filter: { 
        'user_id': `eq.${userId}`,
        'ymd': `lt.${ymd}`
      },
      order: { column: 'ymd', ascending: false },
      limit: 1
    })
    
    if (!recentScores || recentScores.length === 0) {
      return 1 // 第一天
    }
    
    const lastRecord = recentScores[0]
    if (lastRecord.ymd === yesterdayYmd) {
      return lastRecord.current_streak + 1
    } else {
      return 1 // 重新开始
    }
  }

  // 📊 生成修复报告
  generateReport() {
    console.log('\n📊 积分修复操作报告:')
    console.log('====================')
    
    if (this.logOperations.length === 0) {
      console.log('无修复操作')
      return
    }
    
    const operationGroups = {}
    this.logOperations.forEach(op => {
      if (!operationGroups[op.operation]) {
        operationGroups[op.operation] = []
      }
      operationGroups[op.operation].push(op)
    })
    
    Object.entries(operationGroups).forEach(([operation, ops]) => {
      console.log(`\n${operation}: ${ops.length} 次操作`)
      ops.forEach(op => {
        console.log(`  - ${op.timestamp}: ${JSON.stringify(op.details)}`)
      })
    })
    
    console.log(`\n总计操作数: ${this.logOperations.length}`)
    console.log('====================\n')
  }
}

// 🚀 主程序
async function main() {
  console.log('🛠️  积分修复管理工具启动\n')
  
  const tool = new ScoreRepairTool()
  
  try {
    // 检测问题
    const issues = await tool.detectIssues()
    
    console.log('\n📋 检测结果摘要:')
    console.log('==================')
    if (issues.length === 0) {
      console.log('✅ 未发现积分问题')
      return
    }
    
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.description}: ${issue.count} 个`)
    })
    
    console.log('\n🔧 自动修复建议:')
    console.log('==================')
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'missing_scores':
          console.log(`\n缺失积分修复 (${issue.count} 条):`)
          const repaired = await tool.repairMissingScores(issue.data.slice(0, 5)) // 先修复5条
          break
          
        case 'duplicate_scores':
          console.log(`\n重复积分检测 (${issue.count} 组):`)
          issue.data.slice(0, 3).forEach(dup => {
            console.log(`  - 用户 ${dup.key}: ${dup.count} 条重复记录`)
          })
          console.log('  💡 建议手动检查并删除重复记录')
          break
          
        case 'streak_issues':
          console.log(`\n连续天数异常 (${issue.count} 条):`)
          issue.data.slice(0, 3).forEach(streak => {
            console.log(`  - 用户 ${streak.user_id} ${streak.date}: ${streak.issue}`)
          })
          console.log('  💡 建议重新计算连续天数')
          break
          
        case 'missing_rewards':
          console.log(`\n遗漏奖励检测 (${issue.count} 条):`)
          issue.data.slice(0, 3).forEach(reward => {
            console.log(`  - 用户 ${reward.user_id} ${reward.ymd}: 应得${reward.expected_bonus}分，实得${reward.actual_bonus}分`)
          })
          console.log('  💡 建议补发遗漏奖励')
          break
      }
    }
    
    // 生成报告
    tool.generateReport()
    
    console.log('\n💡 完整修复指南:')
    console.log('================')
    console.log('1. 运行此脚本检测问题')
    console.log('2. 根据报告手动修复严重问题')
    console.log('3. 使用批量修复功能处理大量问题')
    console.log('4. 建议建设完整的Admin后台进行日常管理')
    
  } catch (error) {
    console.error('❌ 工具运行失败:', error)
  }
}

// 运行主程序
main().catch(console.error)