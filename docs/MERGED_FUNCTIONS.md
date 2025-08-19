# 合并函数使用说明

由于 Vercel Hobby 计划限制（最多12个 Serverless Functions），我们已将相关功能合并以减少函数数量。

## 📁 合并后的文件结构

### 1. `api/cron/unified-cron.js` - 统一Cron系统
**功能：**
- ✅ 凌晨2点自动执行（cron模式）
- ✅ 手动触发推送（trigger模式）
- ✅ 执行特定任务（task模式）
- ✅ 早晨任务：断签清零、排行榜、月度入账
- ✅ 中午任务：用户提醒、每日报告
- ✅ 晚间任务：晚间提醒
- ✅ 支持：break-streaks、daily-report、morning-tasks、reminder

**使用方式：**
```bash
# Cron模式（自动执行）
POST /api/cron/unified-cron
Body: { "mode": "cron" }

# 手动触发推送
POST /api/cron/unified-cron
Body: { 
  "action": "noon",  # 或 "evening"
  "adminId": "YOUR_ADMIN_ID"
}

# 执行特定任务
POST /api/cron/unified-cron
Body: { 
  "task": "break-streaks",  # 或 "daily-report", "morning-tasks", "reminder"
  "adminId": "YOUR_ADMIN_ID"  # 可选
}
```

### 2. `api/test-system.js` - 统一测试系统
**功能：**
- ✅ 普通测试（public模式）
- ✅ Admin测试（admin模式）
- ✅ **新增：公开推送测试（public-push模式）**
- ✅ 快速测试、早晨任务、中午任务、晚间任务等

**使用方式：**
```bash
# 普通测试
POST /api/test-system
Body: { "action": "quick-test", "type": "public" }

# Admin测试
POST /api/test-system
Body: { "action": "all", "adminId": "YOUR_ADMIN_ID" }

# 🆕 公开推送测试（非admin用户）
POST /api/test-system
Body: { 
  "action": "test-push",
  "userId": "YOUR_TELEGRAM_ID",
  "testType": "reminder"  # 或 "daily-report", "evening-reminder", "quick-message"
}
```

**公开推送测试类型：**
- `reminder` - 测试提醒推送
- `daily-report` - 测试日报推送  
- `evening-reminder` - 测试晚间提醒
- `quick-message` - 测试快速消息

### 3. `api/user/user-system.js` - 统一用户系统
**功能：**
- ✅ 获取用户资料（get-profile）
- ✅ 更新用户资料（update-profile）
- ✅ 获取用户统计（get-stats）
- ✅ 获取用户摘要（get-summary）

**使用方式：**
```bash
# 获取用户资料
POST /api/user/user-system
Body: { 
  "action": "get-profile",
  "userId": "USER_ID"
}

# 更新用户资料
POST /api/user/user-system
Body: { 
  "action": "update-profile",
  "userId": "USER_ID",
  "data": { "monthly_income": 5000 }
}

# 获取用户统计
POST /api/user/user-system
Body: { 
  "action": "get-stats",
  "userId": "USER_ID"
}

# 获取用户摘要
POST /api/user/user-system
Body: { 
  "action": "get-summary",
  "userId": "USER_ID"
}
```

### 4. `api/records/record-system.js` - 统一记录系统
**功能：**
- ✅ 创建记录（create）
- ✅ 更新记录（update）
- ✅ 删除记录（delete）
- ✅ 列出记录（list）
- ✅ 获取记录（get）
- ✅ 修正记录（correct）
- ✅ 批量创建（batch-create）

**使用方式：**
```bash
# 创建记录
POST /api/records/record-system
Body: { 
  "action": "create",
  "userId": "USER_ID",
  "data": { 
    "category_group": "A", 
    "category_code": "food", 
    "amount": 25.50, 
    "ymd": "2025-01-15" 
  }
}

# 列出记录
POST /api/records/record-system
Body: { 
  "action": "list",
  "userId": "USER_ID",
  "data": { "yyyymm": "2025-01", "limit": 20 }
}

# 批量创建记录
POST /api/records/record-system
Body: { 
  "action": "batch-create",
  "userId": "USER_ID",
  "data": { 
    "records": [
      { "category_group": "A", "category_code": "food", "amount": 25.50, "ymd": "2025-01-15" },
      { "category_group": "B", "category_code": "course", "amount": 100.00, "ymd": "2025-01-15" }
    ]
  }
}
```

## 🔄 功能对应关系

| 原文件 | 新文件 | 功能 |
|--------|--------|------|
| `unified-push.js` | `unified-cron.js` | 统一推送 + 手动触发 + 特定任务 |
| `trigger-push.js` | `unified-cron.js` | 手动触发推送 |
| `test-push.js` | `test-system.js` | 普通测试功能 |
| `admin-test.js` | `test-system.js` | Admin测试功能 |
| `reminder.js` | `unified-cron.js` | 提醒功能 |
| `morning.js` | `unified-cron.js` | 早晨任务 |
| `daily-report.js` | `unified-cron.js` | 日报功能 |
| `break-streaks.js` | `unified-cron.js` | 断签清零 |
| `my.js` | `user-system.js` | 个人资料 + 统计 |
| `profile.js` | `user-system.js` | 用户资料管理 |
| `record.js` | `record-system.js` | 记录管理 |
| `list.js` | `record-system.js` | 记录列表 |
| `correct.js` | `record-system.js` | 记录修正 |

## 📊 函数数量统计

**合并前：** 16个函数
**合并后：** 7个函数
**减少：** 9个函数 ✅

## 🚀 部署说明

1. **自动部署：** 通过 `vercel.json` 配置，每天凌晨2点自动执行
2. **手动触发：** 管理员可通过API手动触发各种任务
3. **测试功能：** 支持完整的测试和调试功能
4. **用户管理：** 完整的用户资料和统计功能
5. **记录管理：** 完整的记录CRUD操作
6. **🆕 公开测试：** 普通用户可测试推送功能

## ⚠️ 注意事项

1. **权限验证：** 手动触发和Admin测试需要验证管理员身份
2. **环境变量：** 确保 `ADMIN_TG_IDS` 已正确配置
3. **Cron限制：** 由于Hobby计划限制，中午和晚间任务数据已准备，需要通过其他方式触发
4. **API调用：** 所有功能都通过统一的API端点，使用 `action` 参数区分功能
5. **🆕 公开测试：** 非admin用户可通过 `test-push` 测试推送功能

## 🔧 故障排除

如果遇到问题，请检查：
1. 环境变量配置
2. 管理员ID设置
3. 数据库连接状态
4. Telegram Bot Token 配置
5. API调用参数是否正确
6. 🆕 公开测试时确保 `userId` 和 `testType` 参数正确

## 🆕 新增功能：公开推送测试

### **用途**
让普通用户（非admin）也能测试推送功能，验证系统是否正常工作。

### **使用场景**
- 用户想测试推送系统是否正常
- 验证Telegram Bot是否能正常发送消息
- 测试不同类型的推送消息格式

### **测试类型**
1. **reminder** - 测试提醒推送（模拟中午提醒）
2. **daily-report** - 测试日报推送（模拟每日报告）
3. **evening-reminder** - 测试晚间提醒（模拟晚上提醒）
4. **quick-message** - 测试快速消息（通用测试消息）

### **示例调用**
```bash
# 测试提醒推送
curl -X POST https://your-domain.vercel.app/api/test-system \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test-push",
    "userId": "123456789",
    "testType": "reminder"
  }'
```

## 📞 技术支持

如有问题，请联系管理员或查看日志输出。 