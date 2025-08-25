/**
 * 增强版主同步脚本 - 全量数据库同步
 * 支持所有数据表的智能同步，包含敏感数据脱敏
 */

/**
 * 主同步函数 - 根据优先级分批执行
 */
function enhancedSyncSupabaseToSheets() {
  try {
    console.log('开始增强版全量数据同步...');
    const startTime = new Date();
    const hour = startTime.getHours();
    
    // 根据时间确定同步级别
    const syncLevel = getSyncLevel(hour);
    console.log(`当前时间: ${hour}:00, 同步级别: ${syncLevel}`);
    
    // 执行对应级别的同步任务
    const results = executeSyncByLevel(syncLevel);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`全量同步完成，耗时: ${duration}秒`);
    console.log('同步结果:', results);
    
    // 记录同步日志
    logSyncResult(results, duration);
    
    return results;
  } catch (error) {
    console.error('增强版同步失败:', error);
    handleSyncError(error);
    throw error;
  }
}

/**
 * 根据时间确定同步级别
 */
function getSyncLevel(hour) {
  if (hour % 24 === 0) return 'daily';    // 每24小时：敏感数据
  if (hour % 12 === 0) return 'half-daily'; // 每12小时：系统数据
  if (hour % 4 === 0) return 'quarter';   // 每4小时：管理数据
  return 'hourly';                        // 每小时：核心数据
}

/**
 * 按级别执行同步任务
 */
function executeSyncByLevel(level) {
  const syncPlan = {
    'hourly': ['records', 'user_profile', 'daily_summary'],
    'quarter': ['users', 'user_month_budget', 'branch_daily'],
    'half-daily': ['user_state', 'leaderboard_daily'],
    'daily': ['event_audit', 'branch_leads', 'daily_reminder_queue']
  };
  
  const tablesToSync = syncPlan[level] || syncPlan['hourly'];
  const results = {};
  
  for (const tableName of tablesToSync) {
    console.log(`开始同步表: ${tableName}`);
    try {
      results[tableName] = syncTableData(tableName);
    } catch (error) {
      console.error(`同步表 ${tableName} 失败:`, error);
      results[tableName] = { synced: 0, error: error.message };
    }
  }
  
  return results;
}

/**
 * 表名映射：下划线命名 -> camelCase API端点名
 */
function getApiEndpointName(tableName) {
  const mapping = {
    'user_profile': 'userProfile',
    'daily_summary': 'dailySummary',
    'branch_daily': 'branchDaily',
    'user_month_budget': 'userMonthBudget',
    'user_state': 'userState',
    'leaderboard_daily': 'leaderboardDaily',
    'event_audit': 'eventAudit',
    'branch_leads': 'branchLeads',
    'daily_reminder_queue': 'dailyReminderQueue',
    'records': 'records',
    'users': 'users'
  };
  
  return mapping[tableName] || tableName;
}

/**
 * 同步单个数据表
 */
function syncTableData(tableName) {
  const tableConfig = getTableConfig(tableName);
  if (!tableConfig) {
    throw new Error(`未找到表 ${tableName} 的配置`);
  }
  
  // 获取数据
  const data = fetchTableData(tableName, tableConfig);
  if (!data || data.length === 0) {
    return { synced: 0, message: '没有新数据需要同步' };
  }
  
  // 数据脱敏处理
  const sanitizedData = data.map(record => sanitizeData(tableName, record));
  
  // 写入Google Sheets
  const syncResult = writeToGoogleSheet(tableName, sanitizedData, tableConfig);
  
  // 更新同步状态
  if (syncResult.synced > 0) {
    updateLastSyncTime(tableName);
  }
  
  return syncResult;
}

/**
 * 获取表配置信息
 */
function getTableConfig(tableName) {
  const configs = {
    // P1 - 核心数据表
    'records': {
      sheetName: '支出记录',
      syncStrategy: 'incremental',
      timestampColumn: 'created_at',
      columns: ['ymd', 'created_at', 'user_name', 'branch_code', 'category_group', 'category_code', 'amount', 'note', 'status', 'id'],
      joinWith: 'users',
      sensitiveLevel: 'low'
    },
    'user_profile': {
      sheetName: '用户资料',
      syncStrategy: 'full_replace',
      timestampColumn: null,
      columns: ['user_name', 'branch_code', 'display_name', 'phone_e164', 'email', 'language', 'monthly_income', 'a_pct', 'b_pct', 'current_streak', 'max_streak', 'total_records'],
      joinWith: 'users',
      sensitiveLevel: 'medium'
    },
    'daily_summary': {
      sheetName: '每日汇总',
      syncStrategy: 'rolling_window',
      windowDays: 30,
      timestampColumn: null,
      columns: ['ymd', 'user_name', 'branch_code', 'sum_a', 'sum_b', 'sum_c', 'total_count'],
      joinWith: 'users',
      sensitiveLevel: 'low'
    },
    
    // P2 - 管理数据表
    'users': {
      sheetName: '用户基础信息',
      syncStrategy: 'incremental',
      timestampColumn: 'created_at',
      columns: ['id', 'name', 'branch_code', 'status', 'created_at'],
      sensitiveLevel: 'medium'
    },
    'user_month_budget': {
      sheetName: '月度预算',
      syncStrategy: 'full_replace',
      timestampColumn: null,
      columns: ['user_name', 'branch_code', 'yyyymm', 'income', 'a_pct', 'b_pct', 'c_pct', 'cap_a_amount', 'epf_amount'],
      joinWith: 'users',
      sensitiveLevel: 'low'
    },
    'branch_daily': {
      sheetName: '分支统计',
      syncStrategy: 'rolling_window',
      timestampColumn: null,
      columns: ['branch_code', 'ymd', 'done', 'total', 'rate'],
      windowDays: 30,
      sensitiveLevel: 'low'
    },
    
    // P3 - 系统数据表
    'user_state': {
      sheetName: '用户状态',
      syncStrategy: 'incremental',
      timestampColumn: 'updated_at',
      columns: ['user_name', 'flow', 'step', 'updated_at'],
      joinWith: 'users',
      sensitiveLevel: 'low'
    },
    'leaderboard_daily': {
      sheetName: '排行榜数据',
      syncStrategy: 'rolling_window',
      windowDays: 30,
      timestampColumn: null,
      columns: ['ymd', 'top_users_summary', 'branch_summary'],
      sensitiveLevel: 'low'
    },
    'event_audit': {
      sheetName: '操作日志',
      syncStrategy: 'incremental',
      timestampColumn: 'ts',
      columns: ['ts', 'action', 'user_summary', 'changes_count'],
      sensitiveLevel: 'high'
    },
    'branch_leads': {
      sheetName: '分支管理',
      syncStrategy: 'full_replace',
      timestampColumn: null,
      columns: ['branch_code', 'leaders_count', 'last_updated'],
      sensitiveLevel: 'high'
    },
    'daily_reminder_queue': {
      sheetName: 'WhatsApp提醒队列',
      syncStrategy: 'full_replace',
      timestampColumn: null,
      columns: ['phone_e164', 'message', 'ymd', 'user_name'],
      joinWith: 'users',
      sensitiveLevel: 'high'
    }
  };
  
  return configs[tableName];
}

/**
 * 从Supabase获取表数据
 */
function fetchTableData(tableName, config) {
  const apiEndpointName = getApiEndpointName(tableName);
  let apiUrl = getApiUrl(apiEndpointName);
  let params = [];
  
  // 根据同步策略构建查询参数
  switch (config.syncStrategy) {
    case 'incremental':
      const timeFilter = getIncrementalTimeFilter(tableName, config.timestampColumn);
      params.push(timeFilter.replace('?', ''));
      break;
      
    case 'rolling_window':
      if (config.windowDays) {
        const windowDate = new Date();
        windowDate.setDate(windowDate.getDate() - config.windowDays);
        params.push(`ymd=gte.${formatDate(windowDate)}`);
      }
      break;
      
    case 'full_replace':
      if (config.timestampColumn) {
        params.push(`order=${config.timestampColumn}.desc`);
      }
      if (tableName !== 'users') params.push('limit=1000');
      break;
  }
  
  // 添加JOIN查询
  if (config.joinWith) {
    params.push(`select=*,${config.joinWith}(name,branch_code)`);
  }
  
  // 构建最终URL
  const finalUrl = apiUrl + (params.length > 0 ? '?' + params.join('&') : '');
  
  console.log(`获取数据: ${finalUrl}`);
  
  const response = UrlFetchApp.fetch(finalUrl, {
    method: 'GET',
    headers: getApiHeaders()
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`API请求失败: ${response.getResponseCode()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * 敏感数据脱敏处理
 */
function sanitizeData(tableName, record) {
  const sensitiveFields = {
    'users': {
      telegram_id: (id) => id ? `tg_****${String(id).slice(-4)}` : '',
      id: (id) => id ? `user_${id.substring(0, 8)}...` : ''
    },
    'user_profile': {
      chat_id: (id) => id ? `chat_****${String(id).slice(-4)}` : '',
      phone_e164: (phone) => phone ? `+***-***-${phone.slice(-4)}` : '',
      email: (email) => email ? `${email.charAt(0)}***@${email.split('@')[1] || 'hidden.com'}` : ''
    },
    'event_audit': {
      user_id: (id) => id ? `user_${id.substring(0, 8)}...` : '',
      old: (data) => data ? `[${Object.keys(data || {}).length} fields]` : null,
      new: (data) => data ? `[${Object.keys(data || {}).length} fields]` : null
    },
    'branch_leads': {
      leader_chat_ids: (ids) => ids ? `[${ids.length} leaders]` : '[]'
    }
  };
  
  const rules = sensitiveFields[tableName] || {};
  const sanitized = { ...record };
  
  // 应用脱敏规则
  Object.keys(rules).forEach(field => {
    if (sanitized[field] !== undefined) {
      sanitized[field] = rules[field](sanitized[field]);
    }
  });
  
  // 处理JOIN数据
  if (record.users) {
    sanitized.user_name = record.users.name || 'Unknown';
    sanitized.branch_code = record.users.branch_code || '';
    delete sanitized.users;
  }
  
  return sanitized;
}

/**
 * 写入Google Sheets
 */
function writeToGoogleSheet(tableName, data, config) {
  try {
    // 获取或创建工作表
    const sheet = getSheet(SHEETS_CONFIG.recordsSheetId, config.sheetName);
    
    // 准备表头
    const headers = config.columns;
    
    // 根据同步策略处理数据
    if (config.syncStrategy === 'full_replace') {
      // 全量替换：清空后重新写入
      sheet.clear();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      const rows = data.map(record => headers.map(col => getColumnValue(record, col)));
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      
    } else {
      // 增量同步：追加到末尾
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      
      const rows = data.map(record => headers.map(col => getColumnValue(record, col)));
      if (rows.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
      }
    }
    
    return { 
      synced: data.length, 
      message: `成功同步 ${data.length} 条${config.sheetName}记录`,
      strategy: config.syncStrategy
    };
    
  } catch (error) {
    console.error(`写入 ${tableName} 到Google Sheets失败:`, error);
    throw error;
  }
}

/**
 * 获取列值（处理特殊字段）
 */
function getColumnValue(record, columnName) {
  switch (columnName) {
    case 'status':
      if (record.is_voided) return '已撤销';
      return '正常';
      
    case 'top_users_summary':
      if (record.top_json) {
        const top = Array.isArray(record.top_json) ? record.top_json : [];
        return `前${Math.min(5, top.length)}名用户`;
      }
      return '';
      
    case 'branch_summary':
      if (record.branch_top_json) {
        const branches = Array.isArray(record.branch_top_json) ? record.branch_top_json : [];
        return `${branches.length}个分支`;
      }
      return '';
      
    case 'user_summary':
      return record.user_id ? '用户操作' : '系统操作';
      
    case 'changes_count':
      const oldCount = record.old ? Object.keys(record.old).length : 0;
      const newCount = record.new ? Object.keys(record.new).length : 0;
      return Math.max(oldCount, newCount);
      
    case 'leaders_count':
      return record.leader_chat_ids ? record.leader_chat_ids.length : 0;
      
    case 'last_updated':
      return new Date().toISOString().split('T')[0];
      
    default:
      return record[columnName] || '';
  }
}

/**
 * 设置增强版触发器
 */
function setupEnhancedTriggers() {
  console.log('设置增强版同步触发器...');
  
  // 清除现有触发器
  clearAllTriggers();
  
  // 创建智能同步触发器（每小时）
  const enhancedTrigger = ScriptApp.newTrigger('enhancedSyncSupabaseToSheets')
    .timeBased()
    .everyHours(1)
    .create();
  
  console.log(`增强版同步触发器已创建: ${enhancedTrigger.getUniqueId()}`);
  
  // 保留原有的日汇总和周报告触发器
  const dailySummaryTrigger = ScriptApp.newTrigger('syncDailySummary')
    .timeBased()
    .everyDays(1)
    .atHour(3)  // 稍微错开时间避免冲突
    .create();
  
  const weeklyReportTrigger = ScriptApp.newTrigger('syncWeeklyReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)  // 稍微错开时间
    .create();
  
  console.log('增强版触发器设置完成！');
  console.log('📊 数据同步：每小时智能同步，每天3点汇总，每周一9点周报');
  
  return {
    enhanced: enhancedTrigger.getUniqueId(),
    daily: dailySummaryTrigger.getUniqueId(),
    weekly: weeklyReportTrigger.getUniqueId()
  };
}

/**
 * 增强版测试函数
 */
function testEnhancedSync() {
  console.log('测试增强版同步功能...');
  
  try {
    // 测试各个级别的同步
    const levels = ['hourly', 'quarter', 'half-daily', 'daily'];
    
    for (const level of levels) {
      console.log(`\n测试 ${level} 级别同步:`);
      const results = executeSyncByLevel(level);
      console.log(`${level} 结果:`, results);
    }
    
    console.log('\n✅ 增强版同步测试完成！');
    return true;
    
  } catch (error) {
    console.error('❌ 增强版同步测试失败:', error);
    return false;
  }
}

/**
 * 获取同步状态报告
 */
function getEnhancedSyncReport() {
  const logs = getSyncLogs();
  const errors = getErrorLogs();
  
  const report = {
    lastSync: logs[0] || null,
    recentErrors: errors.slice(0, 3),
    syncStats: calculateSyncStats(logs),
    systemHealth: assessSystemHealth(logs, errors)
  };
  
  console.log('📊 增强版同步报告:');
  console.log(`最后同步: ${report.lastSync?.timestamp || '未知'}`);
  console.log(`近期错误: ${report.recentErrors.length} 条`);
  console.log(`系统健康: ${report.systemHealth}`);
  
  return report;
}

/**
 * 计算同步统计
 */
function calculateSyncStats(logs) {
  if (!logs || logs.length === 0) return { total: 0, avgDuration: 0 };
  
  const recent = logs.slice(0, 10);
  const totalDuration = recent.reduce((sum, log) => sum + (log.duration || 0), 0);
  
  return {
    total: recent.length,
    avgDuration: Math.round(totalDuration / recent.length * 100) / 100,
    successRate: recent.filter(log => !log.results?.error).length / recent.length * 100
  };
}

/**
 * 评估系统健康状态
 */
function assessSystemHealth(logs, errors) {
  if (!logs || logs.length === 0) return 'unknown';
  
  const recentLogs = logs.slice(0, 5);
  const recentErrors = errors.filter(err => {
    const errorTime = new Date(err.timestamp);
    const oneHourAgo = new Date(Date.now() - 3600000);
    return errorTime > oneHourAgo;
  });
  
  if (recentErrors.length > 2) return 'critical';
  if (recentErrors.length > 0) return 'warning';
  if (recentLogs.length > 0) return 'healthy';
  
  return 'unknown';
}