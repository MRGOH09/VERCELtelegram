# 🚀 推送系统使用指南

## 📊 优化后的推送任务架构

### **🎯 统一推送系统 (`/api/cron/unified-push`)**

#### **⏰ 执行时间安排**
- **凌晨 2:00** - 早晨推送 + 断签清零
- **中午 12:00** - 用户提醒 + 日报推送  
- **晚上 10:00** - 晚间提醒

#### **📱 推送内容详情**

##### **1. 🌅 早晨推送 (凌晨 2:00)**
- ✅ 每月1号自动入账月度分摊
- ✅ 个人当日总结和排名
- ✅ 分行排行榜推送
- ✅ 断签清零检查
- ✅ **Admin 总报告**

##### **2. 🌞 中午推送 (中午 12:00)**
- ✅ 断签清零检查
- ✅ 向今日未记录用户发送提醒
- ✅ 每日支出汇总推送
- ✅ 分行排行和个人排行
- ✅ **Admin 总报告**

##### **3. 🌙 晚上推送 (晚上 10:00)**
- ✅ 晚间提醒（针对今日未记录用户）
- ✅ **Admin 总报告**

### **🧪 测试功能 (`/api/test-push`)**

#### **📋 可测试的动作**
- `morning` - 测试早晨任务
- `noon` - 测试中午任务  
- `evening` - 测试晚上任务
- `monthly` - 测试月度自动入账
- `break-streaks` - 测试断签清零
- `all` - 测试所有任务

#### **🔧 使用方法**

##### **1. 测试早晨推送**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "morning"}'
```

##### **2. 测试中午推送**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "noon"}'
```

##### **3. 测试晚上推送**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "evening"}'
```

##### **4. 测试所有功能**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "all"}'
```

##### **5. 测试特定时间**
```bash
curl -X POST https://your-domain.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"action": "morning", "testTime": "2025-01-01T02:00:00Z"}'
```

#### **📊 测试结果**
- 所有测试都会发送详细报告到 Admin
- 测试消息会标记为 "🧪 测试消息"
- 可以验证推送逻辑和消息格式
- 不会影响真实用户的正常使用

### **👨‍💼 Admin 报告系统**

#### **📈 报告内容**
- 每个推送任务执行后自动发送
- 包含成功/失败统计
- 显示发送数量和失败原因
- 总体成功率和性能指标

#### **🔧 配置要求**
```bash
# 在 Vercel 环境变量中设置
ADMIN_TG_IDS=123456789,987654321
```

#### **📱 报告示例**
```
📊 推送任务执行报告

📅 日期：2025-01-15
⏰ 时间：02:00

🌅 早晨推送 (2:00 AM)：
   • 分行排行：成功 5，失败 0
   • 个人排名：成功 25，失败 0
   • 月度入账：已执行
   • 总计：成功 30，失败 0

📈 总体统计：
   • 总发送：30
   • 总失败：0
   • 成功率：100.0%

✅ 任务执行完成！
```

### **⚡ 性能优化特性**

#### **🚀 批量处理**
- 批量数据库查询
- 批量消息发送
- 并发控制 (≤5条同时发送)
- 批次间延迟 (1.1秒)

#### **🔄 智能调度**
- 根据时间自动选择任务
- 避免重复执行
- 错误处理和重试机制
- 幂等性保证

#### **📊 监控和日志**
- 详细的执行日志
- 成功/失败统计
- 性能指标监控
- Admin 实时报告

### **🔧 部署和配置**

#### **1. 更新 Vercel 配置**
```json
{
  "crons": [
    { "path": "/api/cron/unified-push", "schedule": "0 2,12,22 * * *" }
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

#### **3. 部署命令**
```bash
git add .
git commit -m "🚀 部署统一推送系统"
git push origin main
```

### **🎯 优势总结**

#### **✅ 功能增强**
- 从2个Cron扩展到3个时间点
- 新增夜猫子提醒功能
- 完整的Admin报告系统
- 智能任务调度

#### **✅ 性能提升**
- 减少重复的数据库查询
- 批量消息发送优化
- 并发控制和限流
- 错误处理和重试

#### **✅ 维护简化**
- 统一管理所有推送逻辑
- 集中的错误处理
- 完整的监控和日志
- 易于测试和调试

#### **✅ 用户体验**
- 更合理的推送时间
- 个性化提醒内容
- 完整的统计信息
- 实时状态反馈

### **🚨 注意事项**

1. **测试环境**：建议先在测试环境验证功能
2. **Admin配置**：确保 `ADMIN_TG_IDS` 正确设置
3. **消息模板**：测试消息会标记为测试，不影响用户
4. **性能监控**：关注推送成功率和响应时间
5. **用户反馈**：收集用户对推送时间的反馈

### **💡 下一步计划**

1. **用户偏好设置**：允许用户选择推送时间
2. **智能推送**：根据用户活跃度调整频率
3. **A/B测试**：测试不同推送时间的效果
4. **数据分析**：分析推送效果和用户行为

---

**🎉 现在您拥有了一个功能完整、性能优化的推送系统！** 