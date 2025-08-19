# 🚀 推送系统使用指南 (Hobby 计划兼容版)

## 📊 优化后的推送任务架构

### **🎯 统一推送系统 (`/api/cron/unified-push`)**

#### **⏰ 执行时间安排**
- **凌晨 2:00** - 统一执行所有任务（符合 Hobby 计划限制）

#### **📱 推送内容详情**

##### **1. 🌅 早晨推送 (凌晨 2:00)**
- ✅ 每月1号自动入账月度分摊
- ✅ 个人当日总结和排名
- ✅ 分行排行榜推送
- ✅ 断签清零检查
- ✅ **Admin 总报告**

##### **2. 🌞 中午任务准备 (凌晨 2:00)**
- ✅ 计算今日未记录用户
- ✅ 准备用户提醒数据
- ✅ 准备日报推送数据
- ✅ **数据准备完成，等待手动触发**

##### **3. 🌙 晚间任务准备 (凌晨 2:00)**
- ✅ 计算今日未记录用户
- ✅ 准备晚间提醒数据
- ✅ **数据准备完成，等待手动触发**

### **🚀 手动触发推送 (`/api/trigger-push`)**

#### **📋 可触发的动作**
- `noon` - 执行中午推送（用户提醒 + 日报）
- `evening` - 执行晚间推送（晚间提醒）

#### **🔧 使用方法**

##### **1. 使用 curl 触发**
```bash
# 触发中午推送
curl -X POST https://your-domain.vercel.app/api/trigger-push \
  -H "Content-Type: application/json" \
  -d '{"action": "noon", "adminId": "1042061810"}'

# 触发晚间推送
curl -X POST https://your-domain.vercel.app/api/trigger-push \
  -H "Content-Type: application/json" \
  -d '{"action": "evening", "adminId": "1042061810"}'
```

##### **2. 在 Telegram Bot 中触发**
```
/trigger noon      # 触发中午推送
/trigger evening   # 触发晚间推送
```

### **🧪 测试功能 (`/api/test-push`)**

#### **📋 可测试的动作**
- `morning` - 测试早晨任务
- `noon` - 测试中午任务  
- `evening` - 测试晚上任务
- `monthly` - 测试月度自动入账
- `break-streaks` - 测试断签清零
- `all` - 测试所有任务

#### **🔧 使用方法**

##### **1. 在 Telegram Bot 中**
```
/testpush
```

##### **2. 使用 curl 测试**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "quick-test", "adminId": "1042061810"}'
```

## **🔧 部署和配置**

#### **1. 更新 Vercel 配置**
```json
{
  "crons": [
    { "path": "/api/cron/unified-push", "schedule": "0 2 * * *" }
  ]
}
```

#### **2. 环境变量配置**
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_TG_IDS=admin1,admin2
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_service_role
```

## **🎯 工作流程说明**

### **🔄 每日执行流程**

#### **凌晨 2:00 (自动)**
1. 执行早晨推送任务
2. 准备中午任务数据
3. 准备晚间任务数据
4. 发送 Admin 报告

#### **中午 12:00 (手动触发)**
1. 调用 `/api/trigger-push` 或 `/trigger noon`
2. 执行用户提醒推送
3. 执行日报推送
4. 发送执行报告

#### **晚上 10:00 (手动触发)**
1. 调用 `/api/trigger-push` 或 `/trigger evening`
2. 执行晚间提醒推送
3. 发送执行报告

### **💡 优势**

#### **✅ Hobby 计划兼容**
- 每天只运行一次 cron 任务
- 符合 Vercel 免费计划限制
- 功能完全保留

#### **✅ 灵活控制**
- 可以手动控制推送时间
- 支持实时触发
- 便于调试和测试

#### **✅ 成本优化**
- 无需升级到 Pro 计划
- 保持所有功能
- 智能任务调度

## **🚨 注意事项**

1. **自动执行**：凌晨 2:00 自动执行所有准备任务
2. **手动触发**：中午和晚上需要手动触发推送
3. **数据准备**：所有数据在凌晨已准备完成
4. **权限控制**：只有管理员可以手动触发推送

## **📞 支持**

如果遇到问题，请检查：
1. 环境变量配置是否正确
2. 管理员 ID 是否已设置
3. 手动触发是否成功
4. 日志中是否有错误信息

---

**🎉 现在您拥有了一个 Hobby 计划兼容的完整推送系统！** 