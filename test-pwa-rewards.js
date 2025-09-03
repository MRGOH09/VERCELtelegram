#!/usr/bin/env node

// PWA奖励触发实际测试
const PWA_URL = 'http://localhost:3002'

async function testPWARewards() {
  console.log('🔍 测试PWA奖励触发机制\n')
  
  // 模拟一个具有连续记录的用户ID (从测试结果看，应该有连续4天的用户)
  const testUserId = 'test-user-001' // 这里需要真实的用户ID
  
  console.log('1️⃣ 模拟用户打卡（应该触发连续5天奖励）...')
  
  try {
    const response = await fetch(`${PWA_URL}/api/pwa/data`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-for-test'
      },
      body: JSON.stringify({
        action: 'checkin',
        // 这里需要真实的用户认证
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ 打卡响应:', JSON.stringify(result, null, 2))
      
      if (result.score && result.score.bonus_score > 0) {
        console.log('🎉 奖励触发成功!')
        console.log(`   获得奖励: ${result.score.bonus_score}分`)
        if (result.achievementMessage) {
          console.log(`   成就消息: ${result.achievementMessage}`)
        }
      } else {
        console.log('⚠️  未触发奖励')
      }
    } else {
      console.log('❌ API调用失败:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

// 简单测试：检查PWA服务器是否运行
async function checkPWAServer() {
  try {
    const response = await fetch(`${PWA_URL}/`, { method: 'HEAD' })
    console.log(response.ok ? '✅ PWA服务器运行中' : '❌ PWA服务器响应异常')
    return response.ok
  } catch (error) {
    console.log('❌ PWA服务器未运行或无法访问')
    return false
  }
}

// 运行测试
checkPWAServer().then(isRunning => {
  if (isRunning) {
    console.log('\n🎯 推荐的奖励验证方法：')
    console.log('1. 在PWA-Google界面上进行真实的打卡操作')
    console.log('2. 观察是否显示奖励消息和成就通知')
    console.log('3. 检查积分页面的连续天数是否正确增加')
    console.log('4. 下次应该获得"持续五天"成就(3分奖励)')
  } else {
    console.log('\n💡 启动PWA服务器以进行实际测试：')
    console.log('cd /Users/gohchengyee/versalsupabase/pwa-google && npm run dev')
  }
})