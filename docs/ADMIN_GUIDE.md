# LEARNER CLUB 财务记录机器人 - 管理员指南

## 🔐 管理员权限

### 权限级别
- **超级管理员**：拥有所有权限，可执行广播、数据管理、系统配置
- **分行管理员**：管理特定分行，查看分行统计，推送分行消息

### 管理员配置
在环境变量中设置：
```bash
ADMIN_TG_IDS=123456789,987654321  # 逗号分隔的 Telegram ID
```

## 📢 广播功能

### 发送广播消息
```
/broadcast 消息内容
```

**使用场景：**
- 系统维护通知
- 重要活动提醒
- 政策变更通知
- 节日祝福

**注意事项：**
- 消息会发送给所有注册用户
- 系统自动分批发送，避免限流
- 支持 Markdown 格式

### 广播示例
```
/broadcast 🎉 新年快乐！祝大家2025年财务健康，投资顺利！

/broadcast ⚠️ 系统将于今晚23:00-01:00进行维护，期间可能无法使用

/broadcast 📚 本月学习投资排行榜已更新，恭喜前三名用户！
```

## 📊 数据管理

### 查看系统状态
访问健康检查端点：
```
GET /api/health
```

**返回信息：**
- 系统运行状态
- 性能指标
- 错误统计
- 内存使用情况

### 性能监控
系统自动记录以下操作的性能指标：
- `computeLeaderboards`：排行榜计算
- `dailyReports`：日报生成
- `breakStreaksOneShot`：断签清零
- `sendBatchMessages`：批量发送

### 错误追踪
系统自动记录错误信息：
- 操作类型
- 错误详情
- 发生时间
- 上下文信息

## 🗄️ 数据库管理

### 执行数据库迁移
```bash
# 在 Supabase SQL Editor 中执行
# 1. 基础表结构
\i sql/schema.sql

# 2. 用户状态管理
\i sql/migrations/2025-08-10-user-state.sql

# 3. 上月开销百分比
\i sql/migrations/2025-08-11-prev-month-pct.sql

# 4. EPF 百分比支持
\i sql/migrations/2025-08-12-epf-pct.sql

# 5. 年度保险字段
\i sql/migrations/2025-08-13-annual-insurance.sql

# 6. 性能优化修复（重要！）
\i sql/migrations/2025-08-14-optimization-fixes.sql
```

### 关键表说明
- **users**：用户基础信息
- **user_profile**：用户详细资料
- **user_month_budget**：月度预算快照
- **records**：支出记录
- **daily_summary**：日汇总数据
- **leaderboard_daily**：排行榜缓存
- **branch_daily**：分行完成率
- **event_audit**：操作审计日志

## ⚙️ 系统配置

### 环境变量配置
```bash
# Telegram 配置
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_service_role_key

# 应用配置
DEFAULT_BRANCH=MAIN
DEFAULT_CURRENCY=MYR
APP_TZ_OFFSET_MINUTES=480

# 性能配置
MAX_SEND_PER_RUN=120
BATCH_SIZE=25
BATCH_SLEEP_MS=1100

# 管理员配置
ADMIN_TG_IDS=123456789,987654321
```

### Cron 任务配置
**Free 计划（2个 Cron）：**
```json
{
  "crons": [
    { "path": "/api/cron/morning", "schedule": "0 2 * * *" },
    { "path": "/api/cron/reminder", "schedule": "0 12 * * *" }
  ]
}
```

**Pro/Team 计划（4个 Cron）：**
```json
{
  "crons": [
    { "path": "/api/cron/break-streaks", "schedule": "0 19 * * *" },
    { "path": "/api/cron/morning", "schedule": "0 2 * * *" },
    { "path": "/api/cron/reminder", "schedule": "0 12 * * *" },
    { "path": "/api/cron/daily-report", "schedule": "30 12 * * *" }
  ]
}
```

## 🔍 故障排查

### 常见问题

#### 1. Webhook 401 错误
**原因：** `TELEGRAM_WEBHOOK_SECRET` 不匹配
**解决：** 重新设置 webhook 并确保 secret 一致

#### 2. 数据库连接失败
**原因：** Supabase 配置错误或网络问题
**解决：** 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE`

#### 3. 批量发送失败
**原因：** Telegram API 限流或网络问题
**解决：** 调整 `BATCH_SIZE` 和 `BATCH_SLEEP_MS`

#### 4. Cron 任务不执行
**原因：** Vercel Cron 配置错误或函数数量超限
**解决：** 检查 `vercel.json` 和函数数量限制

### 日志分析
系统提供详细的日志记录：
- 操作执行时间
- 成功/失败统计
- 错误详情和上下文
- 性能指标

### 性能优化建议
1. **数据库索引**：确保关键查询字段有适当索引
2. **批量操作**：使用批量 API 减少数据库调用
3. **缓存策略**：利用 `leaderboard_daily` 缓存排行榜数据
4. **异步处理**：非关键操作使用异步处理

## 📈 监控告警

### 关键指标
- **响应时间**：API 平均响应时间 < 2秒
- **成功率**：关键操作成功率 > 99%
- **错误率**：错误率 < 1%
- **资源使用**：内存使用 < 512MB

### 告警设置
建议设置以下告警：
- 错误率超过阈值
- 响应时间异常
- 系统资源不足
- 关键功能失败

## 🚀 部署更新

### 部署流程
1. 代码提交到 Git 仓库
2. Vercel 自动部署
3. 验证新功能
4. 监控系统状态

### 回滚策略
- 保留最近5个部署版本
- 快速回滚到稳定版本
- 数据库迁移向前兼容

---

**管理员职责：**
- 确保系统稳定运行
- 监控性能指标
- 处理用户反馈
- 维护数据安全
- 优化用户体验 