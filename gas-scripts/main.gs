/**
 * 主同步脚本
 * 每小时执行一次，同步Supabase数据到Google Sheets
 */

/**
 * 主同步函数 - 由定时触发器调用
 */
function syncSupabaseToSheets() {
  try {
    console.log('开始同步Supabase数据到Google Sheets...');
    const startTime = new Date();
    
    // 执行各项同步任务
    const results = {
      records: syncRecords(),
      userStats: syncUserStats(),
      branchStats: syncBranchStats()
    };
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`同步完成，耗时: ${duration}秒`);
    console.log('同步结果:', results);
    
    // 记录同步日志
    logSyncResult(results, duration);
    
    return results;
  } catch (error) {
    console.error('同步失败:', error);
    handleSyncError(error);
    throw error;
  }
}

/**
 * 同步支出记录
 */
function syncRecords() {
  try {
    console.log('同步支出记录...');
    
    // 获取最近的记录（增量同步）
    const timeFilter = getIncrementalTimeFilter('records');
    const apiUrl = getApiUrl('records', timeFilter);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`API请求失败: ${response.getResponseCode()}`);
    }
    
    const records = JSON.parse(response.getContentText());
    console.log(`获取到 ${records.length} 条记录`);
    
    if (records.length === 0) {
      return { synced: 0, message: '没有新记录需要同步' };
    }
    
    // 获取用户信息以便关联
    const userMap = getUserMap();
    
    // 打开Google Sheet
    const sheet = getSheet(SHEETS_CONFIG.recordsSheetId, SHEETS_CONFIG.recordsSheetName);
    
    // 准备数据
    const rows = records.map(record => [
      record.ymd,
      record.created_at,
      userMap[record.user_id]?.name || 'Unknown',
      userMap[record.user_id]?.branch_code || '',
      record.category_group,
      record.category_code,
      record.amount,
      record.note || '',
      record.is_voided ? '已撤销' : '正常',
      record.id
    ]);
    
    // 写入数据
    if (sheet.getLastRow() === 0) {
      // 如果是空表，先写入标题
      const headers = [
        '日期', '创建时间', '用户名', '分支', '类别组', '类别码', 
        '金额', '备注', '状态', '记录ID'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    // 更新最后同步时间
    updateLastSyncTime('records');
    
    return { synced: records.length, message: `成功同步 ${records.length} 条记录` };
    
  } catch (error) {
    console.error('同步记录失败:', error);
    return { synced: 0, error: error.message };
  }
}

/**
 * 同步用户统计
 */
function syncUserStats() {
  try {
    console.log('同步用户统计...');
    
    // 获取用户档案数据
    const apiUrl = getApiUrl('userProfile', '?select=*,users(name,branch_code,telegram_id)');
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    const profiles = JSON.parse(response.getContentText());
    
    if (profiles.length === 0) {
      return { synced: 0, message: '没有用户数据' };
    }
    
    // 打开统计Sheet
    const sheet = getSheet(SHEETS_CONFIG.statsSheetId, SHEETS_CONFIG.statsSheetName);
    
    // 清空现有数据（全量更新）
    sheet.clear();
    
    // 写入标题
    const headers = [
      '用户名', '分支', 'Telegram ID', '显示名称', '语言', 
      '月收入', 'A类占比', 'B类占比', '连续记录天数', '最大连续天数',
      '总记录数', '最后记录日期', '上月支出', '年度旅游预算'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 准备数据
    const rows = profiles.map(profile => [
      profile.users?.name || '',
      profile.users?.branch_code || '',
      profile.users?.telegram_id || '',
      profile.display_name || '',
      profile.language || 'zh',
      profile.monthly_income || 0,
      profile.a_pct || 0,
      profile.b_pct || 0,
      profile.current_streak || 0,
      profile.max_streak || 0,
      profile.total_records || 0,
      profile.last_record || '',
      profile.prev_month_spend || 0,
      profile.travel_budget_annual || 0
    ]);
    
    // 写入数据
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    
    return { synced: profiles.length, message: `成功同步 ${profiles.length} 个用户统计` };
    
  } catch (error) {
    console.error('同步用户统计失败:', error);
    return { synced: 0, error: error.message };
  }
}

/**
 * 同步分支统计
 */
function syncBranchStats() {
  try {
    console.log('同步分支统计...');
    
    // 获取最近7天的分支数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFilter = `?ymd=gte.${formatDate(sevenDaysAgo)}`;
    
    const apiUrl = getApiUrl('branchDaily', dateFilter);
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    const branchData = JSON.parse(response.getContentText());
    
    if (branchData.length === 0) {
      return { synced: 0, message: '没有分支数据' };
    }
    
    // 打开分支统计Sheet
    const sheet = getSheet(SHEETS_CONFIG.branchSheetId, SHEETS_CONFIG.branchSheetName);
    
    // 清空现有数据
    sheet.clear();
    
    // 写入标题
    const headers = ['分支代码', '日期', '完成人数', '总人数', '完成率%'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 准备数据
    const rows = branchData.map(item => [
      item.branch_code,
      item.ymd,
      item.done || 0,
      item.total || 0,
      item.rate || 0
    ]);
    
    // 写入数据
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    
    return { synced: branchData.length, message: `成功同步 ${branchData.length} 条分支统计` };
    
  } catch (error) {
    console.error('同步分支统计失败:', error);
    return { synced: 0, error: error.message };
  }
}

/**
 * 测试连接函数
 */
function testSync() {
  console.log('测试Supabase连接...');
  
  try {
    const apiUrl = getApiUrl('users', '?limit=1');
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: getApiHeaders()
    });
    
    if (response.getResponseCode() === 200) {
      console.log('Supabase连接成功！');
      const data = JSON.parse(response.getContentText());
      console.log('测试数据:', data);
      return true;
    } else {
      console.error('连接失败，状态码:', response.getResponseCode());
      return false;
    }
  } catch (error) {
    console.error('连接测试失败:', error);
    return false;
  }
}