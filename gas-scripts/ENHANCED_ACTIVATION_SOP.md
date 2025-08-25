# 🚀 增强版10表全量同步激活SOP

## 📋 前言
你目前看到的是原版系统（4个表），需要激活增强版才能同步全部10个数据表。

## ✅ 步骤1: 配置API连接

### 1.1 打开config.gs文件
在Google Apps Script编辑器中点击 `config.gs`

### 1.2 运行配置函数
```javascript
// 找到并运行这个函数，替换为你的实际值
function myEnhancedSetup() {
  setupSensitiveConfig({
    supabaseUrl: 'https://你的项目ID.supabase.co',
    supabaseServiceKey: '你的supabase-service-role-key',
    recordsSheetId: '你的Google-Sheet-ID'
  });
}
```

**操作步骤：**
1. 在`config.gs`中找到或创建上述函数
2. 替换为你的实际配置值
3. 点击运行按钮（▶️）
4. 授权访问权限

## ✅ 步骤2: 激活增强版触发器

### 2.1 打开triggers.gs文件
在GAS编辑器中点击 `triggers.gs`

### 2.2 停用旧触发器
```javascript
// 运行这个函数清除旧的触发器
clearAllTriggers();
```

### 2.3 设置增强版触发器
```javascript
// 运行这个函数启用增强版智能同步
setupEnhancedTriggers();
```

**重要说明：**
- ⚠️ 这会将原来的4表同步替换为10表同步
- ✅ 新触发器每小时运行，智能选择同步内容

## ✅ 步骤3: 验证增强版系统

### 3.1 打开enhanced-main.gs文件
在GAS编辑器中点击 `enhanced-main.gs`

### 3.2 测试连接
```javascript
// 运行测试函数
validateConfig(); // 验证配置
testEnhancedSync(); // 测试增强版功能
```

### 3.3 手动执行一次完整同步
```javascript
// 运行主同步函数
enhancedSyncSupabaseToSheets();
```

## ✅ 步骤4: 确认同步结果

### 4.1 检查Google Sheets
你的Google Sheet现在应该有**10个工作表**：

| 工作表名称 | 数据来源表 | 同步频率 |
|----------|------------|----------|
| 支出记录 | records | 每小时 |
| 用户资料 | user_profile | 每小时 |
| 每日汇总 | daily_summary | 每小时 |
| 用户基础信息 | users | 每4小时 |
| 月度预算 | user_month_budget | 每4小时 |
| 分支统计 | branch_daily | 每4小时 |
| 用户状态 | user_state | 每12小时 |
| 排行榜数据 | leaderboard_daily | 每12小时 |
| 操作日志 | event_audit | 每24小时（脱敏） |
| 分支管理 | branch_leads | 每24小时（脱敏） |

### 4.2 查看同步报告
在`enhanced-main.gs`中运行：
```javascript
// 查看系统状态
getEnhancedSyncReport();
```

## 🔍 故障排除

### 问题1: 配置失败
```javascript
// 检查配置状态
showConfigStatus();
validateConfig();
```

### 问题2: 同步失败
```javascript
// 查看错误日志
getErrorLogs();
getSyncLogs();
```

### 问题3: 权限问题
1. 确保Google账户有Sheets访问权限
2. 确保Supabase Service Role Key正确
3. 重新运行授权流程

### 问题4: 触发器未生效
```javascript
// 检查触发器状态
listAllTriggers();

// 重新设置（如果需要）
clearAllTriggers();
setupEnhancedTriggers();
```

## 📊 成功指标

### 立即验证（运行后5分钟内）：
- ✅ Google Sheets中出现10个工作表
- ✅ 每个工作表有数据（至少有标题行）
- ✅ `getEnhancedSyncReport()` 显示 "healthy" 状态

### 持续验证（24小时内）：
- ✅ 核心数据表每小时更新
- ✅ 管理数据表每4小时更新  
- ✅ 敏感数据正确脱敏显示

## 🎯 完成确认

当你看到以下情况，说明增强版激活成功：

1. **Google Sheets有10个工作表**（不是4个）
2. **触发器显示 `enhancedSyncSupabaseToSheets`**（不是旧的函数名）
3. **系统报告显示 "healthy" 状态**
4. **敏感数据已脱敏**（如 telegram_id 显示为 tg_****1234）

## 📞 技术支持

如果遇到问题：
1. 检查浏览器控制台错误信息
2. 运行 `getErrorLogs()` 查看详细错误
3. 确认Supabase连接和权限
4. 验证Google Sheets访问权限

---

**🎉 激活成功后，你将拥有完整的10表数据同步系统，可以在Google Sheets中全面了解整个数据库状况！**