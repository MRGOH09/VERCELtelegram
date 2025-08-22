/**
 * Telegram 推送系统
 * 通过定时触发器调用Vercel API执行推送任务
 */

/**
 * 早晨推送任务 - 8:00 AM
 */
function morningPush() {
  try {
    console.log('开始执行早晨推送任务...');
    
    const result = callPushAPI('morning');
    
    console.log('早晨推送完成:', result);
    return result;
    
  } catch (error) {
    console.error('早晨推送失败:', error);
    handlePushError('morning', error);
    throw error;
  }
}

/**
 * 中午推送任务 - 12:00 PM
 */
function noonPush() {
  try {
    console.log('开始执行中午推送任务...');
    
    const result = callPushAPI('noon');
    
    console.log('中午推送完成:', result);
    return result;
    
  } catch (error) {
    console.error('中午推送失败:', error);
    handlePushError('noon', error);
    throw error;
  }
}

/**
 * 晚间推送任务 - 10:00 PM
 */
function eveningPush() {
  try {
    console.log('开始执行晚间推送任务...');
    
    const result = callPushAPI('evening');
    
    console.log('晚间推送完成:', result);
    return result;
    
  } catch (error) {
    console.error('晚间推送失败:', error);
    handlePushError('evening', error);
    throw error;
  }
}

/**
 * 调用Vercel推送API
 * @param {string} action - 推送动作 (morning/noon/evening)
 * @returns {Object} API响应结果
 */
function callPushAPI(action) {
  const config = getConfig();
  
  // 构建API URL
  const apiUrl = `${config.vercelUrl}/api/cron/unified-cron`;
  
  // 准备请求数据
  const requestData = {
    action: action,
    adminId: config.adminId,
    mode: 'trigger',
    timestamp: new Date().toISOString()
  };
  
  console.log(`调用推送API: ${action}`, requestData);
  
  // 发起HTTP请求
  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(requestData),
    muteHttpExceptions: true
  });
  
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log(`API响应状态: ${responseCode}`);
  console.log(`API响应内容: ${responseText}`);
  
  if (responseCode !== 200) {
    throw new Error(`API调用失败: ${responseCode} - ${responseText}`);
  }
  
  const result = JSON.parse(responseText);
  
  if (!result.ok) {
    throw new Error(`推送执行失败: ${result.error || '未知错误'}`);
  }
  
  return {
    success: true,
    action: action,
    timestamp: new Date().toISOString(),
    totalSent: result.results?.totalSent || 0,
    totalFailed: result.results?.totalFailed || 0,
    details: result.results
  };
}

/**
 * 处理推送错误
 * @param {string} action - 推送动作
 * @param {Error} error - 错误对象
 */
function handlePushError(action, error) {
  const errorLog = {
    action: action,
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack
  };
  
  console.error('推送错误详情:', errorLog);
  
  // 可以在这里添加错误通知逻辑
  // 比如发送邮件给管理员或记录到Sheet
  logPushError(errorLog);
}

/**
 * 记录推送错误到Sheet
 * @param {Object} errorLog - 错误日志对象
 */
function logPushError(errorLog) {
  try {
    const config = getConfig();
    const sheet = getSheet(config.sheetsId, '推送错误日志');
    
    // 如果是空表，添加标题
    if (sheet.getLastRow() === 0) {
      const headers = ['时间', '动作', '错误信息', '堆栈跟踪'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 添加错误记录
    const row = [
      errorLog.timestamp,
      errorLog.action,
      errorLog.error,
      errorLog.stack || ''
    ];
    
    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    
    console.log('错误已记录到Sheet');
    
  } catch (logError) {
    console.error('记录错误日志失败:', logError);
  }
}

/**
 * 测试推送功能
 */
function testPush() {
  console.log('开始测试推送功能...');
  
  try {
    // 测试API连接
    const config = getConfig();
    const healthUrl = `${config.vercelUrl}/api/health`;
    
    const healthResponse = UrlFetchApp.fetch(healthUrl, {
      method: 'GET',
      muteHttpExceptions: true
    });
    
    console.log(`健康检查响应: ${healthResponse.getResponseCode()}`);
    console.log(`健康检查内容: ${healthResponse.getContentText()}`);
    
    if (healthResponse.getResponseCode() !== 200) {
      throw new Error('Vercel API连接失败');
    }
    
    // 测试推送API调用（使用快速测试）
    const testResult = callPushAPI('quick-test');
    console.log('推送测试成功:', testResult);
    
    return {
      success: true,
      message: '推送功能测试通过',
      details: testResult
    };
    
  } catch (error) {
    console.error('推送测试失败:', error);
    return {
      success: false,
      message: '推送功能测试失败',
      error: error.message
    };
  }
}

/**
 * 获取推送统计
 * 从Sheet中读取最近的推送记录
 */
function getPushStats() {
  try {
    const config = getConfig();
    const sheet = getSheet(config.sheetsId, '推送日志');
    
    if (sheet.getLastRow() <= 1) {
      return { message: '暂无推送记录' };
    }
    
    // 获取最近10条记录
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 9);
    const numRows = lastRow - startRow + 1;
    
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues();
    
    const stats = {
      totalRecords: lastRow - 1,
      recentRecords: data.map(row => ({
        timestamp: row[0],
        action: row[1],
        totalSent: row[2],
        totalFailed: row[3]
      })),
      todayStats: getTodayPushStats(data)
    };
    
    console.log('推送统计:', stats);
    return stats;
    
  } catch (error) {
    console.error('获取推送统计失败:', error);
    return { error: error.message };
  }
}

/**
 * 获取今日推送统计
 * @param {Array} data - 推送记录数据
 */
function getTodayPushStats(data) {
  const today = new Date().toISOString().slice(0, 10);
  
  const todayRecords = data.filter(row => {
    const recordDate = new Date(row[0]).toISOString().slice(0, 10);
    return recordDate === today;
  });
  
  if (todayRecords.length === 0) {
    return { message: '今日暂无推送记录' };
  }
  
  const totalSent = todayRecords.reduce((sum, row) => sum + (row[2] || 0), 0);
  const totalFailed = todayRecords.reduce((sum, row) => sum + (row[3] || 0), 0);
  
  return {
    pushCount: todayRecords.length,
    totalSent: totalSent,
    totalFailed: totalFailed,
    successRate: totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed) * 100).toFixed(1) : 0
  };
}