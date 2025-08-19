# 合并函数使用说明

由于 Vercel Hobby 计划限制（最多12个 Serverless Functions），我们已将相关功能合并以减少函数数量。

## 📁 合并后的文件结构

### 1. `api/cron/push-system.js` - 统一推送系统
**功能：**
- ✅ 凌晨2点自动执行（cron模式）
- ✅ 手动触发推送（trigger模式）
- ✅ 早晨任务：断签清零、排行榜、月度入账
- ✅ 中午任务：用户提醒、每日报告（数据准备）
- ✅ 晚间任务：晚间提醒（数据准备）

**使用方式：**
```bash
# Cron模式（自动执行）
POST /api/cron/push-system
Body: { "mode": "cron" }

# 手动触发模式
POST /api/cron/push-system
Body: { 
  "action": "noon",  # 或 "evening"
  "adminId": "YOUR_ADMIN_ID"
}
```

### 2. `api/test-system.js` - 统一测试系统
**功能：**
- ✅ 普通测试（public模式）
- ✅ Admin测试（admin模式）
- ✅ 快速测试、早晨任务、中午任务、晚间任务等

**使用方式：**
```bash
# 普通测试
POST /api/test-system
Body: { 
  "action": "quick-test",
  "type": "public"
}

# Admin测试
POST /api/test-system
Body: { 
  "action": "all",
  "adminId": "YOUR_ADMIN_ID"
}
```

## 🔄 功能对应关系

| 原文件 | 新文件 | 功能 |
|--------|--------|------|
| `unified-push.js` | `push-system.js` | 统一推送 + 手动触发 |
| `trigger-push.js` | `push-system.js` | 手动触发推送 |
| `test-push.js` | `test-system.js` | 普通测试功能 |
| `admin-test.js` | `test-system.js` | Admin测试功能 |

## 📊 函数数量统计

**合并前：** 4个函数
**合并后：** 2个函数
**减少：** 2个函数

## 🚀 部署说明

1. **自动部署：** 通过 `vercel.json` 配置，每天凌晨2点自动执行
2. **手动触发：** 管理员可通过API手动触发中午和晚间推送
3. **测试功能：** 支持完整的测试和调试功能

## ⚠️ 注意事项

1. **权限验证：** 手动触发和Admin测试需要验证管理员身份
2. **环境变量：** 确保 `ADMIN_TG_IDS` 已正确配置
3. **Cron限制：** 由于Hobby计划限制，中午和晚间任务数据已准备，需要通过其他方式触发

## 🔧 故障排除

如果遇到问题，请检查：
1. 环境变量配置
2. 管理员ID设置
3. 数据库连接状态
4. Telegram Bot Token 配置

## 📞 技术支持

如有问题，请联系管理员或查看日志输出。 