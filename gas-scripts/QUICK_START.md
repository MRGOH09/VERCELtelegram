# 🚀 Google Sheets同步系统快速开始指南

## 🎯 30秒快速部署

### 1. 进入gas-scripts目录
```bash
cd gas-scripts
```

### 2. 首次部署增强版系统
```bash
./deploy.sh
```
这个脚本会：
- ✅ 自动创建Google Apps Script项目
- ✅ 上传所有同步文件（包含增强版）
- ✅ 自动打开GAS编辑器

### 3. 在GAS编辑器中配置
```javascript
// 运行这个函数进行配置
function quickSetup() {
  setupSensitiveConfig({
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseServiceKey: 'your-supabase-service-role-key',
    recordsSheetId: 'your-main-google-sheet-id'
  });
}
```

### 4. 启用增强版全量同步
```javascript
// 设置增强版触发器（每小时智能同步）
setupEnhancedTriggers();

// 测试系统
testEnhancedSync();
```

## 🎉 完成！

现在你拥有：
- 📊 **10个数据表**完全同步到Google Sheets
- 🛡️ **敏感数据自动脱敏**保护
- ⚡ **智能分级同步**（核心数据每小时更新）
- 📈 **完整数据分析能力**

## 📋 后续操作

### 日常更新代码
```bash
cd gas-scripts
./quick-update.sh  # 5秒完成更新
```

### 查看同步状态
在GAS编辑器中运行：
```javascript
getEnhancedSyncReport();  // 查看系统状态
getSyncLogs();           // 查看同步日志
```

### 手动同步特定表
```javascript
syncTableData('records');      // 同步支出记录
syncTableData('user_profile'); // 同步用户资料
```

## 🔍 监控建议

1. **每周检查一次**系统健康状态
2. **每月验证**数据完整性
3. **关注Google Sheets**权限设置
4. **定期备份**重要数据

---

🎯 **目标达成**：现在你可以在Google Sheets中全面了解整个Supabase数据库的状况！