#!/usr/bin/env node

// 简单的 testpush 测试脚本
const https = require('https');

// 配置 - 请修改这些值
const config = {
  domain: 'your-domain.vercel.app', // 替换为您的实际域名
  adminUserId: '123456789', // 替换为您的admin用户ID
  nonAdminUserId: '987654321' // 替换为非admin用户ID
};

// 发送测试请求
function testPush(userId, description) {
  return new Promise((resolve, reject) => {
    const data = {
      action: 'test-push',
      userId: userId,
      testType: 'reminder'
    };
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: config.domain,
      port: 443,
      path: '/api/test-system',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n🧪 测试: ${description}`);
    console.log(`📤 发送数据:`, data);
    console.log(`🌐 请求地址: https://${config.domain}/api/test-system`);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`📥 响应状态: ${res.statusCode}`);
        console.log(`📥 响应头:`, res.headers);
        
        try {
          const parsed = JSON.parse(responseData);
          console.log(`📥 响应数据:`);
          console.log(JSON.stringify(parsed, null, 2));
          
          // 检查调试信息
          if (parsed.details && parsed.details.debug) {
            console.log(`\n🔍 调试信息:`);
            console.log(`• 环境变量 ADMIN_TG_IDS: "${parsed.details.debug.envVar}"`);
            console.log(`• 解析后的admin列表: [${parsed.details.debug.adminIds.join(', ')}]`);
            console.log(`• 用户ID类型: ${parsed.details.debug.userIdType}`);
            console.log(`• 权限比较:`, parsed.details.debug.comparison);
          }
          
          resolve(parsed);
        } catch (e) {
          console.log(`📥 原始响应:`, responseData);
          resolve({ raw: responseData });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ 请求错误:`, e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// 主测试函数
async function main() {
  console.log('🧪 TestPush 功能测试');
  console.log('='.repeat(50));
  console.log(`域名: ${config.domain}`);
  console.log(`Admin用户ID: ${config.adminUserId}`);
  console.log(`非Admin用户ID: ${config.nonAdminUserId}`);
  console.log('='.repeat(50));
  
  try {
    // 测试Admin用户
    console.log('\n🔐 测试 Admin 用户...');
    await testPush(config.adminUserId, 'Admin用户测试');
    
    // 测试非Admin用户
    console.log('\n🚫 测试非 Admin 用户...');
    await testPush(config.nonAdminUserId, '非Admin用户测试');
    
    console.log('\n🎯 测试完成！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  }
  
  console.log('\n💡 使用说明:');
  console.log('1. 修改 config 对象中的域名和用户ID');
  console.log('2. 运行: node simple-test.js');
  console.log('3. 检查响应中的调试信息');
  console.log('4. 确认 ADMIN_TG_IDS 环境变量是否正确设置');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPush }; 