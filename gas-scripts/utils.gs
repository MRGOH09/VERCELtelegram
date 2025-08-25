/**
 * 工具函数库
 * 提供通用的辅助功能
 */

/**
 * 获取指定的Google Sheet
 * @param {string} sheetId - Google Sheets ID
 * @param {string} sheetName - 工作表名称
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetId, sheetName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // 如果工作表不存在，创建一个新的
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      console.log(`创建新工作表: ${sheetName}`);
    }
    
    return sheet;
  } catch (error) {
    console.error(`获取工作表失败 [${sheetId}][${sheetName}]:`, error);
    throw error;
  }
}

/**
 * 获取用户映射表（ID -> 用户信息）
 * @returns {Object} 用户映射对象
 */
function getUserMap() {
  try {
    const apiUrl = getApiUrl('users', '?select=id,name,branch_code');
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    const users = JSON.parse(response.getContentText());
    const userMap = {};
    
    users.forEach(user => {
      userMap[user.id] = {
        name: user.name,
        branch_code: user.branch_code
      };
    });
    
    return userMap;
  } catch (error) {
    console.error('获取用户映射失败:', error);
    return {};
  }
}

/**
 * 获取增量同步的时间过滤器
 * @param {string} tableName - 表名
 * @param {string} timestampColumn - 时间戳列名，如果为null则不使用时间过滤
 * @returns {string} 时间过滤参数
 */
function getIncrementalTimeFilter(tableName, timestampColumn) {
  // 如果表没有时间戳列，返回空过滤器
  if (!timestampColumn) {
    return `?limit=${SYNC_CONFIG.maxRecords}`;
  }
  
  if (!SYNC_CONFIG.incrementalSync) {
    // 如果不启用增量同步，返回最近24小时的数据
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `?${timestampColumn}=gte.${yesterday.toISOString()}`;
  }
  
  // 获取上次同步时间
  const lastSyncTime = getLastSyncTime(tableName);
  if (lastSyncTime) {
    return `?${timestampColumn}=gte.${lastSyncTime}&order=${timestampColumn}.desc&limit=${SYNC_CONFIG.maxRecords}`;
  } else {
    // 首次同步，获取最近7天的数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return `?${timestampColumn}=gte.${sevenDaysAgo.toISOString()}&order=${timestampColumn}.desc&limit=${SYNC_CONFIG.maxRecords}`;
  }
}

/**
 * 获取上次同步时间
 * @param {string} tableName - 表名
 * @returns {string|null} ISO时间字符串或null
 */
function getLastSyncTime(tableName) {
  try {
    const key = `last_sync_${tableName}`;
    return PropertiesService.getScriptProperties().getProperty(key);
  } catch (error) {
    console.error(`获取同步时间失败 [${tableName}]:`, error);
    return null;
  }
}

/**
 * 更新最后同步时间
 * @param {string} tableName - 表名
 */
function updateLastSyncTime(tableName) {
  try {
    const key = `last_sync_${tableName}`;
    const now = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty(key, now);
    console.log(`更新同步时间 [${tableName}]: ${now}`);
  } catch (error) {
    console.error(`更新同步时间失败 [${tableName}]:`, error);
  }
}

/**
 * 格式化日期为YYYY-MM-DD格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * 格式化日期时间为本地时间字符串
 * @param {string|Date} datetime - 日期时间
 * @returns {string} 格式化后的字符串
 */
function formatDateTime(datetime) {
  const date = typeof datetime === 'string' ? new Date(datetime) : datetime;
  return Utilities.formatDate(date, SYNC_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * 记录同步结果
 * @param {Object} results - 同步结果
 * @param {number} duration - 执行时长（秒）
 */
function logSyncResult(results, duration) {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      duration: duration,
      results: results
    };
    
    // 将日志保存到脚本属性中（最多保留最近10次）
    const logs = JSON.parse(PropertiesService.getScriptProperties().getProperty('sync_logs') || '[]');
    logs.unshift(logData);
    
    // 只保留最近10次记录
    if (logs.length > 10) {
      logs.splice(10);
    }
    
    PropertiesService.getScriptProperties().setProperty('sync_logs', JSON.stringify(logs));
    
  } catch (error) {
    console.error('记录同步日志失败:', error);
  }
}

/**
 * 处理同步错误
 * @param {Error} error - 错误对象
 */
function handleSyncError(error) {
  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    // 记录错误日志
    const errorLogs = JSON.parse(PropertiesService.getScriptProperties().getProperty('error_logs') || '[]');
    errorLogs.unshift(errorData);
    
    // 只保留最近5次错误记录
    if (errorLogs.length > 5) {
      errorLogs.splice(5);
    }
    
    PropertiesService.getScriptProperties().setProperty('error_logs', JSON.stringify(errorLogs));
    
    // 发送邮件通知（可选）
    // MailApp.sendEmail({
    //   to: 'your-email@example.com',
    //   subject: 'Supabase同步失败通知',
    //   body: `同步失败:\n\n${error.message}\n\n时间: ${new Date()}`
    // });
    
  } catch (e) {
    console.error('处理错误失败:', e);
  }
}

/**
 * 获取同步日志
 * @returns {Array} 同步日志数组
 */
function getSyncLogs() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('sync_logs') || '[]');
  } catch (error) {
    console.error('获取同步日志失败:', error);
    return [];
  }
}

/**
 * 获取错误日志
 * @returns {Array} 错误日志数组
 */
function getErrorLogs() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('error_logs') || '[]');
  } catch (error) {
    console.error('获取错误日志失败:', error);
    return [];
  }
}

/**
 * 清除所有日志
 */
function clearAllLogs() {
  PropertiesService.getScriptProperties().deleteProperty('sync_logs');
  PropertiesService.getScriptProperties().deleteProperty('error_logs');
  console.log('所有日志已清除');
}

/**
 * 清除同步状态（重置为首次同步）
 */
function resetSyncState() {
  const properties = PropertiesService.getScriptProperties();
  const keys = properties.getKeys();
  
  keys.forEach(key => {
    if (key.startsWith('last_sync_')) {
      properties.deleteProperty(key);
    }
  });
  
  console.log('同步状态已重置');
}

/**
 * 检查API配置是否完整
 * @returns {Object} 检查结果
 */
function checkConfig() {
  // 使用新的配置验证函数
  return validateConfig();
}