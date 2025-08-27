/**
 * 积分系统功能测试
 */

import { 
  calculateCurrentStreak, 
  calculateBonusScore, 
  getMilestoneConfig 
} from './lib/scoring-system.js'

async function testScoringSystem() {
  console.log('🧪 开始测试积分系统...\n')
  
  try {
    // 1. 测试里程碑配置
    console.log('1️⃣ 测试里程碑配置')
    const milestones = await getMilestoneConfig()
    console.log('里程碑配置:', milestones)
    
    if (milestones.length === 0) {
      console.log('❌ 里程碑配置为空，需要先运行数据库迁移')
      return
    }
    
    // 2. 测试奖励分计算
    console.log('\n2️⃣ 测试奖励分计算')
    const testCases = [1, 3, 5, 10, 15, 21, 31]
    
    for (const days of testCases) {
      const result = calculateBonusScore(days, milestones)
      console.log(`${days}天连续 → 奖励${result.bonusScore}分, 成就: ${result.bonusDetails.map(d => d.name).join(', ') || '无'}`)
    }
    
    // 3. 测试防漏洞逻辑
    console.log('\n3️⃣ 测试防漏洞逻辑')
    const result6 = calculateBonusScore(6, milestones)  // 6天不应该有奖励
    const result10_again = calculateBonusScore(10, milestones)  // 10天应该有奖励
    
    console.log(`6天连续 → 奖励${result6.bonusScore}分 (应该为0)`)
    console.log(`10天连续 → 奖励${result10_again.bonusScore}分 (应该为5)`)
    
    console.log('\n✅ 积分系统核心逻辑测试完成')
    
    // 4. 测试积分规则
    console.log('\n4️⃣ 测试积分规则设计')
    console.log('基础分: 1分/天 (记录或打卡)')
    console.log('连续分: 1分/天 (连续记录)')
    console.log('奖励分: 里程碑奖励')
    console.log('示例: 连续10天第10天可获得 1(基础) + 1(连续) + 5(奖励) = 7分')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    console.log('\n提示: 请确保已经运行数据库迁移: ')
    console.log('psql -d your_database -f sql/migrations/2025-08-27-scoring-system.sql')
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testScoringSystem()
}