/**
 * 定时触发器管理
 * 设置和管理Google Apps Script的定时任务
 */

/**
 * 设置所有触发器
 * 运行此函数来创建定时同步任务
 */
function setupTriggers() {
  // 先清除所有现有触发器
  clearAllTriggers();
  
  console.log('开始设置触发器...');
  
  try {
    // 1. 主同步任务 - 每小时执行
    const mainTrigger = ScriptApp.newTrigger('syncSupabaseToSheets')
      .timeBased()
      .everyHours(1)
      .create();
    
    console.log(`主同步触发器已创建: ${mainTrigger.getUniqueId()}`);
    
    // 2. 每日汇总同步 - 每天凌晨2点
    const dailySummaryTrigger = ScriptApp.newTrigger('syncDailySummary')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .create();
    
    console.log(`日汇总触发器已创建: ${dailySummaryTrigger.getUniqueId()}`);
    
    // 3. 周报告同步 - 每周一早上8点
    const weeklyReportTrigger = ScriptApp.newTrigger('syncWeeklyReport')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();
    
    console.log(`周报告触发器已创建: ${weeklyReportTrigger.getUniqueId()}`);
    
    console.log('所有触发器设置完成!');
    
    // 显示当前所有触发器
    listAllTriggers();
    
  } catch (error) {
    console.error('设置触发器失败:', error);
    throw error;
  }
}

/**
 * 设置推送触发器
 * 创建定时推送任务（早中晚三次推送）
 */
function setupPushTriggers() {
  // 先清除现有推送触发器
  clearPushTriggers();
  
  console.log('开始设置推送触发器...');
  
  try {
    // 1. 早晨推送 - 每天早上8点
    const morningTrigger = ScriptApp.newTrigger('morningPush')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    
    console.log(`早晨推送触发器已创建: ${morningTrigger.getUniqueId()}`);
    
    // 2. 中午推送 - 每天中午12点
    const noonTrigger = ScriptApp.newTrigger('noonPush')
      .timeBased()
      .everyDays(1)
      .atHour(12)
      .create();
    
    console.log(`中午推送触发器已创建: ${noonTrigger.getUniqueId()}`);
    
    // 3. 晚间推送 - 每天晚上10点
    const eveningTrigger = ScriptApp.newTrigger('eveningPush')
      .timeBased()
      .everyDays(1)
      .atHour(22)
      .create();
    
    console.log(`晚间推送触发器已创建: ${eveningTrigger.getUniqueId()}`);
    
    console.log('所有推送触发器设置完成!');
    
    // 显示当前推送触发器
    listPushTriggers();
    
  } catch (error) {
    console.error('设置推送触发器失败:', error);
    throw error;
  }
}

/**
 * 清除推送触发器
 */
function clearPushTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const pushFunctions = ['morningPush', 'noonPush', 'eveningPush'];
  
  console.log('清除现有推送触发器...');
  
  triggers.forEach(trigger => {
    if (pushFunctions.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      console.log(`已删除推送触发器: ${trigger.getHandlerFunction()}`);
    }
  });
}

/**
 * 列出推送触发器
 */
function listPushTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const pushFunctions = ['morningPush', 'noonPush', 'eveningPush'];
  
  const pushTriggers = triggers.filter(trigger => 
    pushFunctions.includes(trigger.getHandlerFunction())
  );
  
  console.log(`\n当前推送触发器 (${pushTriggers.length}个):`);
  console.log('='.repeat(50));
  
  if (pushTriggers.length === 0) {
    console.log('没有设置推送触发器');
    return;
  }
  
  pushTriggers.forEach((trigger, index) => {
    const handlerFunction = trigger.getHandlerFunction();
    const triggerId = trigger.getUniqueId();
    
    let timeDesc = '';
    switch(handlerFunction) {
      case 'morningPush':
        timeDesc = '每天早上8点';
        break;
      case 'noonPush':
        timeDesc = '每天中午12点';
        break;
      case 'eveningPush':
        timeDesc = '每天晚上10点';
        break;
    }
    
    console.log(`${index + 1}. ${handlerFunction} - ${timeDesc}`);
    console.log(`   ID: ${triggerId}`);
    console.log('');
  });
}

/**
 * 设置完整系统（同步 + 推送）
 */
function setupAllTriggers() {
  console.log('设置完整的触发器系统...');
  
  // 设置数据同步触发器
  setupTriggers();
  
  console.log('');
  
  // 设置推送触发器  
  setupPushTriggers();
  
  console.log('\n✅ 完整系统设置完成！');
  console.log('📊 数据同步：每小时同步，每天2点汇总，每周一8点周报');
  console.log('📱 消息推送：每天8点/12点/22点自动推送');
}

/**
 * 清除所有触发器
 */
function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  console.log(`找到 ${triggers.length} 个触发器，准备清除...`);
  
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
    console.log(`已删除触发器: ${trigger.getHandlerFunction()}`);
  });
  
  console.log('所有触发器已清除');
}

/**
 * 列出所有当前触发器
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  console.log(`\n当前活动触发器 (${triggers.length}个):`);
  console.log('='.repeat(50));
  
  if (triggers.length === 0) {
    console.log('没有设置任何触发器');
    return;
  }
  
  triggers.forEach((trigger, index) => {
    const eventType = trigger.getEventType().toString();
    const handlerFunction = trigger.getHandlerFunction();
    const triggerId = trigger.getUniqueId();
    
    console.log(`${index + 1}. ${handlerFunction}`);
    console.log(`   ID: ${triggerId}`);
    console.log(`   类型: ${eventType}`);
    
    if (eventType === 'CLOCK') {
      console.log(`   触发源: ${trigger.getTriggerSource().toString()}`);
    }
    
    console.log('');
  });
}

/**
 * 设置测试触发器（每5分钟执行一次，用于测试）
 */
function setupTestTrigger() {
  // 清除现有测试触发器
  clearTestTriggers();
  
  const testTrigger = ScriptApp.newTrigger('testSync')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  console.log(`测试触发器已创建: ${testTrigger.getUniqueId()}`);
  console.log('测试触发器将每5分钟执行一次testSync函数');
}

/**
 * 清除所有测试触发器
 */
function clearTestTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'testSync') {
      ScriptApp.deleteTrigger(trigger);
      console.log('已删除测试触发器');
    }
  });
}

/**
 * 每日汇总同步函数
 * 同步昨天的汇总数据
 */
function syncDailySummary() {
  try {
    console.log('开始同步每日汇总数据...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = formatDate(yesterday);
    
    // 获取昨天的汇总数据
    const apiUrl = getApiUrl('dailySummary', `?ymd=eq.${ymd}&select=*,users(name,branch_code)`);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    const summaryData = JSON.parse(response.getContentText());
    
    if (summaryData.length === 0) {
      console.log(`没有找到 ${ymd} 的汇总数据`);
      return;
    }
    
    // 同步到专门的日汇总Sheet
    const sheet = getSheet(SHEETS_CONFIG.recordsSheetId, '每日汇总');
    
    // 准备数据
    const rows = summaryData.map(item => [
      item.ymd,
      item.users?.name || 'Unknown',
      item.users?.branch_code || '',
      item.sum_a || 0,
      item.sum_b || 0,
      item.sum_c || 0,
      item.total_count || 0
    ]);
    
    // 如果是空表，添加标题
    if (sheet.getLastRow() === 0) {
      const headers = ['日期', '用户', '分支', 'A类金额', 'B类金额', 'C类金额', '记录数'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 写入数据
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    console.log(`成功同步 ${ymd} 的 ${rows.length} 条汇总数据`);
    
  } catch (error) {
    console.error('同步每日汇总失败:', error);
    handleSyncError(error);
  }
}

/**
 * 周报告同步函数
 * 每周一同步上周的统计数据
 */
function syncWeeklyReport() {
  try {
    console.log('开始同步周报告数据...');
    
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - (today.getDay() + 6) % 7 - 7);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    
    const startDate = formatDate(lastMonday);
    const endDate = formatDate(lastSunday);
    
    console.log(`生成周报告: ${startDate} 至 ${endDate}`);
    
    // 获取周数据
    const apiUrl = getApiUrl('dailySummary', 
      `?ymd=gte.${startDate}&ymd=lte.${endDate}&select=*,users(name,branch_code)`
    );
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    const weekData = JSON.parse(response.getContentText());
    
    if (weekData.length === 0) {
      console.log(`没有找到 ${startDate} 至 ${endDate} 的数据`);
      return;
    }
    
    // 按用户汇总数据
    const userSummary = {};
    weekData.forEach(item => {
      const userId = item.user_id;
      if (!userSummary[userId]) {
        userSummary[userId] = {
          name: item.users?.name || 'Unknown',
          branch_code: item.users?.branch_code || '',
          sum_a: 0,
          sum_b: 0,
          sum_c: 0,
          total_count: 0,
          active_days: 0
        };
      }
      
      userSummary[userId].sum_a += item.sum_a || 0;
      userSummary[userId].sum_b += item.sum_b || 0;
      userSummary[userId].sum_c += item.sum_c || 0;
      userSummary[userId].total_count += item.total_count || 0;
      if (item.total_count > 0) {
        userSummary[userId].active_days += 1;
      }
    });
    
    // 同步到周报告Sheet
    const sheet = getSheet(SHEETS_CONFIG.recordsSheetId, '周报告');
    
    // 准备数据
    const rows = Object.values(userSummary).map(user => [
      `${startDate} 至 ${endDate}`,
      user.name,
      user.branch_code,
      user.sum_a,
      user.sum_b,
      user.sum_c,
      user.total_count,
      user.active_days
    ]);
    
    // 如果是空表，添加标题
    if (sheet.getLastRow() === 0) {
      const headers = ['周期', '用户', '分支', 'A类金额', 'B类金额', 'C类金额', '总记录数', '活跃天数'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // 写入数据
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    console.log(`成功同步周报告，包含 ${rows.length} 个用户的数据`);
    
  } catch (error) {
    console.error('同步周报告失败:', error);
    handleSyncError(error);
  }
}