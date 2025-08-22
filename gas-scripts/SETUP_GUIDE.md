# 🔐 GAS 安全配置指南

## 🎯 问题解决

**解决问题**：每次推送代码后需要重新设置密码/配置
**解决方案**：使用 Google Apps Script PropertiesService 安全存储敏感信息

## 📋 一次性配置步骤

### 步骤 1：上传所有脚本文件

确保已上传以下文件到 GAS 项目：
- `config.gs` - 配置管理
- `utils.gs` - 工具函数  
- `push.gs` - 推送核心
- `triggers.gs` - 定时器管理

### 步骤 2：运行配置设置函数

在 GAS 编辑器中运行以下函数进行一次性配置：

```javascript
// 方式 1：使用配置函数（推荐）
function mySetup() {
  setupSensitiveConfig({
    supabaseUrl: 'https://你的项目.supabase.co',
    supabaseServiceKey: '你的supabase-service-role-key',
    vercelUrl: 'https://你的应用.vercel.app', 
    adminId: '你的管理员TelegramID',
    recordsSheetId: '你的记录SheetID',
    logSheetId: '你的日志SheetID',
    // 可选配置
    statsSheetId: '统计SheetID',
    branchSheetId: '分支SheetID'
  });
}
```

### 步骤 3：验证配置

```javascript
// 验证配置是否正确
validateConfig();

// 查看配置状态（隐藏敏感信息）
showConfigStatus();
```

### 步骤 4：测试功能

```javascript
// 测试推送功能
testPush();
```

## 🔧 配置说明

### 必需配置项

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `supabaseUrl` | Supabase 项目 URL | `https://abc123.supabase.co` |
| `supabaseServiceKey` | Supabase Service Role Key | `eyJ...` |
| `vercelUrl` | Vercel 应用 URL | `https://myapp.vercel.app` |
| `adminId` | 管理员 Telegram ID | `1042061810` |
| `recordsSheetId` | 主记录 Google Sheet ID | `1a2b3c...` |
| `logSheetId` | 推送日志 Google Sheet ID | `4d5e6f...` |

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

### Vercel URL
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目，复制项目 URL

### Telegram Admin ID
1. 发送 `/start` 给 [@userinfobot](https://t.me/userinfobot)
2. 复制显示的 ID 数字

### Google Sheet ID
- Sheet URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- 复制 `SHEET_ID` 部分

## 🛡️ 安全优势

### ✅ 使用 PropertiesService 后
- ✅ **安全存储** - 敏感信息存储在 Google 云端
- ✅ **代码推送不影响** - 配置独立于代码文件
- ✅ **团队友好** - 不会泄露敏感信息到代码库
- ✅ **一次配置** - 永久有效，无需重复设置

### ❌ 之前硬编码的问题
- ❌ **不安全** - 密钥明文存储在代码中
- ❌ **需重复设置** - 每次推送后需要重新修改
- ❌ **容易泄露** - 敏感信息可能被误提交

## 🔧 管理函数

### 查看配置状态
```javascript
showConfigStatus(); // 显示配置状态（隐藏敏感信息）
```

### 验证配置
```javascript
validateConfig(); // 验证所有必需配置是否正确
```

### 清除配置（谨慎使用）
```javascript
clearSensitiveConfig(); // 清除所有敏感配置
```

## 🚨 故障排除

### 配置错误
```javascript
// 如果看到这些错误：
// "缺少配置: SUPABASE_URL, SUPABASE_SERVICE_KEY"
// "配置无效: VERCEL_URL"

// 解决方法：重新运行配置函数
mySetup(); // 使用正确的值重新配置
```

### 权限问题
1. 确保已授权 GAS 访问外部 URL
2. 检查 Google Sheets 访问权限
3. 验证 Supabase 和 Vercel API 可访问性

### 测试连接
```javascript
// 测试 API 连接
testPush();

// 测试 Supabase 连接  
checkConfig();
```

## 📝 配置完成检查清单

- [ ] 上传所有 `.gs` 文件
- [ ] 运行 `setupSensitiveConfig()` 配置函数
- [ ] 运行 `validateConfig()` 验证配置
- [ ] 运行 `testPush()` 测试功能
- [ ] 设置定时触发器（8AM、10PM）
- [ ] 验证推送功能正常工作

## 🎉 完成

配置完成后，你的 GAS 推送系统将：
- 🔒 **安全存储**所有敏感配置
- 🚀 **自动运行**定时推送任务  
- 📊 **详细记录**推送和错误日志
- 🔄 **持续工作**无需重复配置

**重要提醒**：完成配置后，请删除或注释掉 `mySetup()` 函数中的敏感信息，防止意外泄露。