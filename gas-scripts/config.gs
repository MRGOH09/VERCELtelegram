/**
 * API配置文件
 * 注意：此文件包含敏感信息，已在.gitignore中排除
 * 
 * 配置说明：
 * 1. 从你的Vercel环境变量中复制相应的值
 * 2. SUPABASE_URL 对应 NEXT_PUBLIC_SUPABASE_URL
 * 3. SUPABASE_SERVICE_KEY 对应 SUPABASE_SERVICE_ROLE
 */

// Supabase 配置 - 使用PropertiesService存储敏感信息
function getSUPABASE_CONFIG() {
  const properties = PropertiesService.getScriptProperties();
  
  return {
    // 从脚本属性中获取，如果没有则使用默认值
    url: properties.getProperty('SUPABASE_URL') || 'https://your-project-id.supabase.co',
    serviceKey: properties.getProperty('SUPABASE_SERVICE_KEY') || 'your-supabase-service-role-key-here'
  };
}

// 向后兼容的配置获取
const SUPABASE_CONFIG = getSUPABASE_CONFIG();

// Google Sheets 配置
function getSHEETS_CONFIG() {
  const properties = PropertiesService.getScriptProperties();
  
  return {
    // 主记录表
    recordsSheetId: properties.getProperty('RECORDS_SHEET_ID') || 'your-google-sheet-id-here',
    recordsSheetName: '支出记录',
    
    // 用户统计表
    statsSheetId: properties.getProperty('STATS_SHEET_ID') || 'your-stats-sheet-id-here',
    statsSheetName: '用户统计',
    
    // 分支统计表
    branchSheetId: properties.getProperty('BRANCH_SHEET_ID') || 'your-branch-sheet-id-here', 
    branchSheetName: '分支统计'
  };
}

// 向后兼容的配置获取
const SHEETS_CONFIG = getSHEETS_CONFIG();

// 同步配置
const SYNC_CONFIG = {
  // 同步间隔（分钟）
  intervalMinutes: 60,
  
  // 每次同步的最大记录数 (对应环境变量 MAX_SEND_PER_RUN)
  maxRecords: 1000,
  
  // 是否启用增量同步（只同步新增/修改的记录）
  incrementalSync: true,
  
  // 时区设置 (对应环境变量 APP_TZ_OFFSET_MINUTES，马来西亚UTC+8)
  timezone: 'Asia/Kuala_Lumpur',
  
  // 默认分支 (对应环境变量 DEFAULT_BRANCH)
  defaultBranch: 'KL',
  
  // 默认货币 (对应环境变量 DEFAULT_CURRENCY)
  defaultCurrency: 'RM'
};

// API端点配置
const API_ENDPOINTS = {
  records: '/rest/v1/records',
  users: '/rest/v1/users',
  userProfile: '/rest/v1/user_profile',
  dailySummary: '/rest/v1/daily_summary',
  branchDaily: '/rest/v1/branch_daily',
  userMonthBudget: '/rest/v1/user_month_budget'
};

// 获取完整的API URL
function getApiUrl(endpoint, params = '') {
  return `${SUPABASE_CONFIG.url}${API_ENDPOINTS[endpoint]}${params}`;
}


// 获取完整配置
function getConfig() {
  const supabaseConfig = getSUPABASE_CONFIG();
  const sheetsConfig = getSHEETS_CONFIG();
  
  return {
    supabase: supabaseConfig,
    sheets: sheetsConfig,
    sync: SYNC_CONFIG,
    api: API_ENDPOINTS,
    // 便捷访问
    sheetsId: sheetsConfig.recordsSheetId
  };
}

// 获取API请求头
function getApiHeaders() {
  const supabaseConfig = getSUPABASE_CONFIG();
  return {
    'apikey': supabaseConfig.serviceKey,
    'Authorization': `Bearer ${supabaseConfig.serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

/**
 * 一次性设置所有敏感配置
 * 运行此函数来设置所有必需的敏感信息
 * @param {Object} config - 配置对象
 */
function setupSensitiveConfig(config) {
  const properties = PropertiesService.getScriptProperties();
  
  // 必需配置项
  const requiredConfig = {
    'SUPABASE_URL': config.supabaseUrl,
    'SUPABASE_SERVICE_KEY': config.supabaseServiceKey,
    'RECORDS_SHEET_ID': config.recordsSheetId
  };
  
  // 可选配置项
  if (config.statsSheetId) {
    requiredConfig['STATS_SHEET_ID'] = config.statsSheetId;
  }
  if (config.branchSheetId) {
    requiredConfig['BRANCH_SHEET_ID'] = config.branchSheetId;
  }
  
  // 验证必需字段
  const missing = [];
  Object.keys(requiredConfig).forEach(key => {
    if (!requiredConfig[key] || requiredConfig[key].includes('your-')) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`缺少必需配置: ${missing.join(', ')}`);
  }
  
  // 保存配置
  properties.setProperties(requiredConfig);
  
  console.log('✅ 敏感配置已成功保存到 PropertiesService');
  console.log('📋 已保存的配置项:', Object.keys(requiredConfig));
  
  return {
    success: true,
    message: '配置保存成功',
    savedKeys: Object.keys(requiredConfig)
  };
}

/**
 * 验证当前配置完整性
 * @returns {Object} 验证结果
 */
function validateConfig() {
  const properties = PropertiesService.getScriptProperties();
  
  const requiredKeys = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'RECORDS_SHEET_ID'
  ];
  
  const missing = [];
  const invalid = [];
  
  requiredKeys.forEach(key => {
    const value = properties.getProperty(key);
    if (!value) {
      missing.push(key);
    } else if (value.includes('your-') || value.includes('example')) {
      invalid.push(key);
    }
  });
  
  const issues = [];
  if (missing.length > 0) {
    issues.push(`缺少配置: ${missing.join(', ')}`);
  }
  if (invalid.length > 0) {
    issues.push(`配置无效: ${invalid.join(', ')}`);
  }
  
  const isValid = issues.length === 0;
  
  console.log(isValid ? '✅ 配置验证通过' : `❌ 配置验证失败: ${issues.join('; ')}`);
  
  return {
    isValid: isValid,
    issues: issues,
    status: isValid ? 'valid' : 'invalid'
  };
}

/**
 * 显示当前配置状态（隐藏敏感信息）
 * @returns {Object} 配置状态
 */
function showConfigStatus() {
  const properties = PropertiesService.getScriptProperties();
  const allKeys = properties.getKeys();
  
  const configKeys = allKeys.filter(key => 
    key.includes('SUPABASE_') || 
    key.includes('_SHEET_ID')
  );
  
  const status = {};
  configKeys.forEach(key => {
    const value = properties.getProperty(key);
    if (value) {
      // 隐藏敏感信息，只显示前后几个字符
      if (key.includes('KEY') || key.includes('TOKEN')) {
        status[key] = value.length > 10 ? 
          `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : 
          '配置已设置';
      } else {
        status[key] = value;
      }
    } else {
      status[key] = '未配置';
    }
  });
  
  console.log('📋 当前配置状态:', status);
  return status;
}

/**
 * 清除所有敏感配置（谨慎使用）
 */
function clearSensitiveConfig() {
  const properties = PropertiesService.getScriptProperties();
  const allKeys = properties.getKeys();
  
  const sensitiveKeys = allKeys.filter(key => 
    key.includes('SUPABASE_') || 
    key.includes('_SHEET_ID')
  );
  
  sensitiveKeys.forEach(key => {
    properties.deleteProperty(key);
  });
  
  console.log('🗑️ 已清除敏感配置:', sensitiveKeys);
  return {
    success: true,
    clearedKeys: sensitiveKeys
  };
}