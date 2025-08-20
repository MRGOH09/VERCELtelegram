#!/usr/bin/env node

// 环境变量检查脚本
console.log('🔍 环境变量检查');
console.log('='.repeat(50));

// 检查 ADMIN_TG_IDS
const adminTgIds = process.env.ADMIN_TG_IDS;
console.log(`ADMIN_TG_IDS: "${adminTgIds}"`);
console.log(`类型: ${typeof adminTgIds}`);
console.log(`长度: ${adminTgIds ? adminTgIds.length : 0}`);

if (adminTgIds) {
  // 解析admin列表
  const adminIds = adminTgIds.split(',').map(s => s.trim()).filter(Boolean);
  console.log(`\n解析后的admin列表:`);
  console.log(`• 原始值: [${adminTgIds.split(',').map(s => `"${s}"`).join(', ')}]`);
  console.log(`• 清理后: [${adminIds.map(s => `"${s}"`).join(', ')}]`);
  console.log(`• 数量: ${adminIds.length}`);
  
  // 检查每个ID
  adminIds.forEach((id, index) => {
    console.log(`• ID ${index + 1}: "${id}" (类型: ${typeof id}, 长度: ${id.length})`);
  });
  
  // 测试权限检查逻辑
  console.log(`\n权限检查逻辑测试:`);
  const testUserIds = ['123456789', '987654321', '555666777', '111222333'];
  
  testUserIds.forEach(testId => {
    const isAdmin = adminIds.includes(testId.toString());
    console.log(`• 用户 ${testId}: ${isAdmin ? '✅ 是admin' : '❌ 不是admin'}`);
  });
  
} else {
  console.log('\n❌ ADMIN_TG_IDS 环境变量未设置！');
  console.log('请在Vercel项目设置中添加此环境变量');
}

// 检查其他相关环境变量
console.log('\n其他相关环境变量:');
const relatedVars = [
  'BOT_TOKEN',
  'SUPABASE_URL', 
  'SUPABASE_ANON_KEY',
  'NODE_ENV'
];

relatedVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`• ${varName}: ✅ 已设置 (长度: ${value.length})`);
  } else {
    console.log(`• ${varName}: ❌ 未设置`);
  }
});

// 环境变量设置建议
console.log('\n💡 环境变量设置建议:');
console.log('1. 在Vercel项目设置中添加 ADMIN_TG_IDS');
console.log('2. 格式: 123456789,987654321,555666777');
console.log('3. 确保没有多余的空格或特殊字符');
console.log('4. 重新部署项目以应用环境变量');

console.log('\n🔍 检查完成！'); 