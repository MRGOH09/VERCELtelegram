# 🔐 GAS Supabase 同步系统配置指南

## 🎯 系统概述

此 GAS (Google Apps Script) 系统提供 **Supabase 数据库与 Google Sheets 的自动同步功能**，支持：
- 每小时自动同步最新数据
- 每日凌晨2点汇总数据  
- 每周一早上8点生成周报
- 安全的敏感信息存储

## 📋 主要功能

- **🔄 实时同步** - 每小时同步 Supabase 数据到 Google Sheets
- **📊 每日汇总** - 自动生成每日统计数据
- **📈 周报生成** - 每周自动生成用户活跃度报告
- **🔐 安全存储** - 使用 PropertiesService 安全存储敏感配置
- **📝 详细日志** - 完整的同步日志和错误记录

## 🛠 部署步骤

### 步骤 1：创建 Google Apps Script 项目

1. 访问 [Google Apps Script](https://script.google.com/)
2. 点击 "新建项目"
3. 将项目重命名为 "Supabase Data Sync System"

### 步骤 2：上传脚本文件

创建以下文件并复制对应的代码：

#### **config.gs** (配置管理)
```javascript
// 复制 /gas-scripts/config.gs 的内容
```

#### **utils.gs** (工具函数)
```javascript
// 复制 /gas-scripts/utils.gs 的内容
```

#### **main.gs** (同步核心)
```javascript  
// 复制 /gas-scripts/main.gs 的内容
```

#### **triggers.gs** (定时器管理)
```javascript
// 复制 /gas-scripts/triggers.gs 的内容
```

### 步骤 3：配置敏感信息

在 Google Apps Script 编辑器中运行以下配置函数：

```javascript
function mySetup() {
  setupSensitiveConfig({
    supabaseUrl: 'https://你的项目.supabase.co',
    supabaseServiceKey: '你的supabase-service-role-key',
    recordsSheetId: '你的主数据SheetID',
    // 可选配置
    statsSheetId: '统计数据SheetID',
    branchSheetId: '分支数据SheetID'
  });
}
```

### 步骤 4：设置定时触发器

运行以下函数设置自动同步：

```javascript
setupAllTriggers(); // 设置完整的同步系统
```

**或者手动设置触发器：**
1. 点击左侧 "触发器" 图标
2. 点击 "添加触发器"
3. 设置以下触发器：

| 函数名 | 事件类型 | 触发时间 | 说明 |
|--------|----------|----------|------|
| `syncSupabaseToSheets` | 时间驱动 | 每小时 | 主数据同步 |
| `syncDailySummary` | 时间驱动 | 每天凌晨2点 | 日汇总数据 |
| `syncWeeklyReport` | 时间驱动 | 每周一早上8点 | 周报生成 |

### 步骤 5：测试系统

运行测试函数验证系统：

```javascript
// 验证配置
validateConfig();

// 测试同步功能
testSync();

// 手动同步测试
syncSupabaseToSheets();
```

## 📊 配置说明

### 必需配置项

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `supabaseUrl` | Supabase 项目 URL | `https://abc123.supabase.co` |
| `supabaseServiceKey` | Supabase Service Role Key | `eyJ...` |
| `recordsSheetId` | 主数据 Google Sheet ID | `1a2b3c...` |

### 可选配置项

| 配置项 | 说明 |
|--------|------|
| `statsSheetId` | 用户统计 Sheet ID |
| `branchSheetId` | 分支统计 Sheet ID |

## 🔍 获取配置信息

### Supabase 配置
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → Settings → API
3. 复制 `URL` 和 `service_role key`

### Google Sheet ID
- Sheet URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- 复制 `SHEET_ID` 部分

## 🛡️ 安全优势

### ✅ 使用 PropertiesService 后
- ✅ **安全存储** - 敏感信息存储在 Google 云端
- ✅ **代码推送不影响** - 配置独立于代码文件
- ✅ **团队友好** - 不会泄露敏感信息到代码库
- ✅ **一次配置** - 永久有效，无需重复设置

## 🔧 管理函数

### 查看配置状态
```javascript
showConfigStatus(); // 显示配置状态（隐藏敏感信息）
```

### 验证配置
```javascript
validateConfig(); // 验证所有必需配置是否正确
```

### 查看同步日志
```javascript
getSyncLogs(); // 查看最近的同步日志
getErrorLogs(); // 查看错误日志
```

### 手动同步
```javascript
syncSupabaseToSheets(); // 手动执行主数据同步
syncDailySummary(); // 手动执行日汇总
syncWeeklyReport(); // 手动执行周报生成
```

## 📋 数据同步内容

### 主数据同步 (每小时)
- 用户记录数据
- 支出分类统计
- 用户资料更新

### 每日汇总 (凌晨2点)
- 按日期汇总用户支出
- 分支统计数据
- 活跃用户统计

### 周报生成 (每周一8点)
- 用户活跃度分析
- 周度支出趋势
- 分支表现对比

## 🚨 故障排除

### 常见问题

1. **配置错误**
   ```javascript
   // 如果看到这些错误：
   // "缺少配置: SUPABASE_URL, SUPABASE_SERVICE_KEY"
   
   // 解决方法：重新运行配置函数
   mySetup(); // 使用正确的值重新配置
   ```

2. **权限问题**
   - 确保已授权 GAS 访问外部 URL
   - 检查 Google Sheets 访问权限
   - 验证 Supabase API 密钥权限

3. **同步失败**
   ```javascript
   // 检查同步日志
   getErrorLogs();
   
   // 验证配置
   validateConfig();
   
   // 手动测试同步
   testSync();
   ```

### 调试步骤

1. **检查配置**
   ```javascript
   validateConfig(); // 验证配置完整性
   showConfigStatus(); // 查看配置状态
   ```

2. **测试连接**
   ```javascript
   testSync(); // 测试基本同步功能
   ```

3. **查看日志**
   - 查看 GAS 执行记录
   - 检查同步日志
   - 查看错误日志

## 📝 配置完成检查清单

- [ ] 上传所有 `.gs` 文件
- [ ] 运行 `setupSensitiveConfig()` 配置函数
- [ ] 运行 `validateConfig()` 验证配置
- [ ] 运行 `testSync()` 测试功能
- [ ] 设置定时触发器
- [ ] 验证同步功能正常工作

## 🎉 完成

配置完成后，你的 GAS 同步系统将：
- 🔄 **自动同步** Supabase 数据到 Google Sheets
- 📊 **定期生成** 汇总报告和统计数据
- 🔒 **安全存储** 所有敏感配置
- 📝 **详细记录** 同步日志和错误信息

**重要提醒**：完成配置后，请删除或注释掉 `mySetup()` 函数中的敏感信息，防止意外泄露。