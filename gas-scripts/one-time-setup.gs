/**
 * 一次性配置函数
 * 复制此文件到 GAS 并运行 mySetup() 函数来配置系统
 */

function mySetup() {
  setupSensitiveConfig({
    supabaseUrl: 'https://ezrpmrnfdvtfxwnyekzi.supabase.co',
    supabaseServiceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnBtcm5mZHZ0Znh3bnlla3ppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDg0NzI4MSwiZXhwIjoyMDcwNDIzMjgxfQ.YgnWEUsdjdtopyRlvJ_2KHNEWV1ONIIdtHlk97XiBuk',
    recordsSheetId: '12DNFsCX-Man717AhAZVxPRqn2g8j1tdvmLuzfci-N3c',
    statsSheetId: '12DNFsCX-Man717AhAZVxPRqn2g8j1tdvmLuzfci-N3c',
    branchSheetId: '12DNFsCX-Man717AhAZVxPRqn2g8j1tdvmLuzfci-N3c'
  });
  
  console.log('✅ 配置已保存到 PropertiesService');
  console.log('现在可以运行 validateConfig() 来验证配置');
}

/**
 * 验证配置是否正确设置
 */
function testMyConfig() {
  console.log('🔍 验证配置...');
  
  // 1. 验证配置完整性
  const validation = validateConfig();
  console.log('配置验证结果:', validation);
  
  if (!validation.isValid) {
    console.error('❌ 配置验证失败:', validation.issues);
    return false;
  }
  
  // 2. 显示配置状态
  const status = showConfigStatus();
  console.log('📋 配置状态:', status);
  
  // 3. 测试 API 连接
  console.log('🔗 测试 Supabase 连接...');
  const testResult = testSync();
  
  if (testResult) {
    console.log('✅ 所有配置正确！可以开始使用同步功能');
    return true;
  } else {
    console.error('❌ API 连接测试失败');
    return false;
  }
}

/**
 * 设置完整系统（配置 + 触发器）
 */
function setupComplete() {
  console.log('🚀 开始完整系统设置...');
  
  // 1. 设置配置
  mySetup();
  
  // 2. 验证配置
  const configOk = testMyConfig();
  
  if (!configOk) {
    console.error('❌ 配置验证失败，请检查配置');
    return;
  }
  
  // 3. 设置触发器
  console.log('⏰ 设置定时触发器...');
  setupAllTriggers();
  
  console.log('🎉 完整系统设置完成！');
  console.log('📊 系统将自动执行：');
  console.log('  • 每小时同步数据');
  console.log('  • 每天凌晨2点生成日汇总');
  console.log('  • 每周一早上8点生成周报');
}