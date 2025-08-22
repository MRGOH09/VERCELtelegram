# 🚀 GAS 推送系统部署指南

## 📋 系统概述

此 GAS 推送系统解决了 Vercel Hobby 计划只允许一个定时任务的限制，通过 Google Apps Script 提供 **每天 3 次自动推送**（早中晚），支持 300 用户规模。

## 🎯 主要功能

- **🌅 早晨推送** - 每天 8:00 AM
- **🌞 中午推送** - 每天 12:00 PM  
- **🌙 晚间推送** - 每天 10:00 PM
- **📊 错误日志记录** - 自动记录到 Google Sheet
- **🔧 测试功能** - 支持 API 连接测试
- **📈 推送统计** - 详细的发送统计

## 🛠 部署步骤

### 1. 创建 Google Apps Script 项目

1. 访问 [Google Apps Script](https://script.google.com/)
2. 点击 "新建项目"
3. 将项目重命名为 "Finance Bot Push System"

### 2. 上传脚本文件

按顺序创建以下文件，并复制对应的代码：

#### **config.gs** (配置文件)
```javascript
// 复制 /gas-scripts/config.gs 的内容
// 记得修改以下配置项：
```

**必须修改的配置项：**
```javascript
const SUPABASE_CONFIG = {
  url: 'https://你的supabase项目.supabase.co',
  serviceKey: '你的supabase-service-role-key'
};

const PUSH_CONFIG = {
  vercelUrl: 'https://你的vercel应用.vercel.app',
  adminId: '你的管理员TelegramID',
  logSheetId: '你的推送日志Sheet ID'
};
```

#### **utils.gs** (工具函数)
```javascript
// 复制 /gas-scripts/utils.gs 的内容
```

#### **push.gs** (推送核心)
```javascript  
// 复制 /gas-scripts/push.gs 的内容
```

#### **triggers.gs** (定时器管理)
```javascript
// 复制 /gas-scripts/triggers.gs 的内容
```

### 3. 配置定时触发器

在 Google Apps Script 编辑器中：

1. 运行 `setupPushTriggers()` 函数
2. 授权脚本访问权限
3. 检查触发器是否创建成功

**或者手动设置：**
1. 点击左侧 "触发器" 图标
2. 点击 "添加触发器"
3. 设置以下触发器：

| 函数名 | 事件类型 | 时间 |
|--------|----------|------|
| `morningPush` | 时间驱动 | 每天 8:00 |
| `noonPush` | 时间驱动 | 每天 12:00 |
| `eveningPush` | 时间驱动 | 每天 22:00 |

### 4. 测试系统

运行测试函数验证系统：

```javascript
// 在 GAS 编辑器中运行
testPush(); // 测试 API 连接和推送功能
```

## 📊 配置说明

### Vercel URL 配置
```javascript
vercelUrl: 'https://your-vercel-app.vercel.app'
```

### 管理员 ID 配置  
```javascript
adminId: '1042061810' // 你的 Telegram ID
```

### Google Sheet 配置
需要创建推送日志 Sheet 来记录推送结果：
```javascript
logSheetId: 'your-google-sheet-id'
```

## 🔍 监控和日志

### 推送日志 Sheet 结构
| 列 | 内容 |
|-----|------|
| A | 时间戳 |
| B | 推送动作 (morning/noon/evening) |
| C | 发送成功数 |
| D | 发送失败数 |

### 错误日志 Sheet 结构  
| 列 | 内容 |
|-----|------|
| A | 时间戳 |
| B | 动作类型 |
| C | 错误信息 |
| D | 堆栈跟踪 |

## 🧪 测试功能

### 基本测试
```javascript
testPush(); // 测试 API 连接
```

### 手动触发推送  
```javascript
morningPush();  // 手动触发早晨推送
noonPush();     // 手动触发中午推送
eveningPush();  // 手动触发晚间推送
```

### 查看推送统计
```javascript
getPushStats(); // 获取推送统计信息
```

## 🚨 故障排除

### 常见问题

1. **权限错误**
   - 确保已授权脚本访问外部 URL
   - 检查 Google Sheets 访问权限

2. **API 调用失败**
   - 验证 Vercel URL 是否正确
   - 检查 Supabase 配置是否有效
   - 确认管理员 ID 配置正确

3. **触发器不工作**
   - 检查触发器是否创建成功
   - 验证函数名是否正确
   - 查看执行历史记录

### 调试步骤

1. **检查配置**
   ```javascript
   console.log(getConfig()); // 查看完整配置
   ```

2. **测试 API 连接**
   ```javascript
   testPush(); // 测试基本连接
   ```

3. **查看日志**
   - 查看 GAS 执行记录
   - 检查推送日志 Sheet
   - 查看错误日志 Sheet

## 💡 优势对比

### 🆚 对比 Vercel Hobby 限制

| 功能 | Vercel Hobby | GAS 推送系统 |
|------|-------------|-------------|
| 定时任务数 | 1个 | 无限制 |
| 推送频率 | 受限 | 每天3次 |
| 成本 | 免费但受限 | 完全免费 |
| 可靠性 | 一般 | 高 (Google 基础设施) |
| 扩展性 | 需要升级 | 支持 300+ 用户 |

### ✅ 系统优势

- **🆓 完全免费** - 无需升级 Vercel 计划
- **🔄 自动化** - 真正的定时自动推送  
- **📊 详细记录** - 完整的推送和错误日志
- **🛡 可靠性高** - 基于 Google 云基础设施
- **⚡ 响应快速** - 直接调用 Vercel API
- **📈 支持扩展** - 轻松支持 300+ 用户

## 📞 技术支持

如遇问题，请检查：

1. **配置文件** - 所有 URL 和 ID 是否正确
2. **权限设置** - GAS 是否有足够权限
3. **触发器状态** - 定时器是否正常运行
4. **日志记录** - 查看详细的错误信息

---

**🎉 现在您拥有了一个完全自动化的 300 用户推送系统！**

系统将在每天 8:00、12:00、22:00 自动执行推送，完全解决了 Vercel Hobby 计划的限制问题。