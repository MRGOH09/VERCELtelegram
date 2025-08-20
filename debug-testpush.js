#!/usr/bin/env node

// 调试 testpush 功能的脚本
const https = require('https');

// 配置
const config = {
  domain: 'your-domain.vercel.app', // 替换为您的实际域名
  endpoint: '/api/test-system',
  adminUserId: '123456789', // 替换为您的admin用户ID
  nonAdminUserId: '987654321', // 替换为非admin用户ID
  testType: 'reminder'
};

// 发送HTTP请求
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: config.domain,
      port: 443,
      path: config.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// 测试Admin用户
async function testAdminUser() {
  console.log('\n🔐 测试 Admin 用户...');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest({
      action: 'test-push',
      userId: config.adminUserId,
      testType: config.testType
    });
    
    console.log(`状态码: ${response.statusCode}`);
    console.log('响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.statusCode === 200) {
      console.log('✅ Admin用户测试成功！');
    } else {
      console.log('❌ Admin用户测试失败！');
    }
    
  } catch (error) {
    console.error('❌ Admin用户测试出错:', error.message);
  }
}

// 测试非Admin用户
async function testNonAdminUser() {
  console.log('\n🚫 测试非 Admin 用户...');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest({
      action: 'test-push',
      userId: config.nonAdminUserId,
      testType: config.testType
    });
    
    console.log(`状态码: ${response.statusCode}`);
    console.log('响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.statusCode === 403) {
      console.log('✅ 非Admin用户权限检查正常！');
    } else {
      console.log('❌ 非Admin用户权限检查异常！');
    }
    
  } catch (error) {
    console.error('❌ 非Admin用户测试出错:', error.message);
  }
}

// 测试环境变量
async function testEnvironmentVariables() {
  console.log('\n🔍 测试环境变量...');
  console.log('='.repeat(50));
  
  try {
    const response = await makeRequest({
      action: 'test-push',
      userId: '999999999', // 使用一个不存在的用户ID
      testType: config.testType
    });
    
    console.log(`状态码: ${response.statusCode}`);
    console.log('响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 检查调试信息
    if (response.data && response.data.details && response.data.details.debug) {
      console.log('\n🔍 调试信息:');
      console.log('环境变量 ADMIN_TG_IDS:', response.data.details.debug.envVar);
      console.log('解析后的admin列表:', response.data.details.debug.adminIds);
    }
    
  } catch (error) {
    console.error('❌ 环境变量测试出错:', error.message);
  }
}

// 主函数
async function main() {
  console.log('🧪 TestPush 功能调试脚本');
  console.log('='.repeat(50));
  console.log(`域名: ${config.domain}`);
  console.log(`Admin用户ID: ${config.adminUserId}`);
  console.log(`非Admin用户ID: ${config.nonAdminUserId}`);
  console.log(`测试类型: ${config.testType}`);
  
  // 测试Admin用户
  await testAdminUser();
  
  // 测试非Admin用户
  await testNonAdminUser();
  
  // 测试环境变量
  await testEnvironmentVariables();
  
  console.log('\n🎯 调试完成！');
  console.log('\n💡 使用说明:');
  console.log('1. 修改 config 对象中的域名和用户ID');
  console.log('2. 运行: node debug-testpush.js');
  console.log('3. 检查响应中的调试信息');
  console.log('4. 查看Vercel日志获取更多信息');
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { makeRequest, testAdminUser, testNonAdminUser, testEnvironmentVariables }; 