## Telegram + Vercel + Supabase 财务记录机器人（起步包）

快速启动：

1) 准备环境变量（Vercel 项目 Settings → Environment Variables，或本地新建 `.env.local`）

必填：

- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE
- DEFAULT_BRANCH（默认：MAIN）
- DEFAULT_CURRENCY（默认：MYR）
- APP_TZ_OFFSET_MINUTES（默认 480=UTC+8）
- ADMIN_TG_IDS（逗号分隔 Telegram 数字 ID，用于 /broadcast 鉴权）

性能优化配置：

- MAX_SEND_PER_RUN（每次 Cron 最大推送条数，默认 120）
- BATCH_SIZE（批量发送批次大小，默认 25）
- BATCH_SLEEP_MS（批次间延迟毫秒，默认 1100）

2) 安装依赖（Node 18+）

```bash
npm i
```

3) 本地开发（基于 Vercel CLI）

```bash
npx vercel login
npx vercel dev
```

4) 配置 Telegram Webhook（推荐使用 `X-Telegram-Bot-Api-Secret-Token`）

```bash
export BOT_TOKEN=xxx
export WEBHOOK_SECRET=xxx
export WEBHOOK_URL=https://your-vercel-deployment.vercel.app/api/telegram
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d url="${WEBHOOK_URL}" \
  -d secret_token="${WEBHOOK_SECRET}" | jq .
```

5) 数据库：将 `sql/schema.sql` 执行到 Supabase（或分步执行 `sql/migrations/*`）。若启用按钮状态机，请额外执行 `sql/migrations/2025-08-10-user-state.sql` 创建 `user_state` 表。

**重要**：执行最新的性能优化迁移 `sql/migrations/2025-08-14-optimization-fixes.sql` 以修复排行榜幂等性和 EPF 计算问题。

6) 首次使用：

- 发送 `/start` 给机器人注册（一次性填写"收入/A%/B%/旅游年额/上月开销/分行"）。
- 发送 `/record`（按钮式：选择 A/B/C → 分类 → 金额 → 备注 → 预览 → 确认）。
- 发送 `/my month` 查看月度统计与目标进度。

### 部署与 Cron（按计划选择）

Pro/Team（4 条 Cron，UTC）：

```json
{
  "crons": [
    { "path": "/api/cron/break-streaks", "schedule": "0 19 * * *" },
    { "path": "/api/cron/morning",       "schedule": "0 2 * * *"  },
    { "path": "/api/cron/reminder",      "schedule": "0 12 * * *" },
    { "path": "/api/cron/daily-report",  "schedule": "30 12 * * *"}
  ]
}
```

Free（2 条 Cron）示例（合并 20:00 与 20:30；合并 03:00 与 10:00）：

```json
{
  "crons": [
    { "path": "/api/cron/morning",      "schedule": "0 2 * * *" },
    { "path": "/api/cron/reminder",     "schedule": "0 12 * * *" }
  ]
}
```

说明：
- Free 方案可在 `reminder` 内先发提醒后调用 `/api/cron/daily-report`，或用外部调度调用两个端点。

### 性能优化特性

- **批量断签清零**：使用批量 SQL 操作，一次性重置所有断签用户
- **EPF 计算统一**：优先读取当月预算快照，fallback 到 profile 设置
- **排行榜幂等性**：`leaderboard_daily` 表唯一约束确保不重复写入
- **批量发信优化**：汇总所有消息后一次性发送，支持分片和限流
- **数据库索引优化**：复合索引提升查询性能

### 环境变量（新增建议）

- APP_TZ（如 `Asia/Kuala_Lumpur`）
- MAX_SEND_PER_RUN（单次最多发送数）
- BATCH_SIZE（默认 25）
- BATCH_SLEEP_MS（默认 1100）

### EPF 百分比

- 迁移：`sql/migrations/2025-08-12-epf-pct.sql` 为 `user_month_budget` 增加 `epf_pct`，`epf_amount` = income * epf_pct / 100。
- 月初生成预算时请写入 `epf_pct`（来自 `user_profile.epf_pct`）。

注意：此起步包优先后端 API 与数据口径的落地，Telegram 向导已支持分步注册/记录/设置。完整规则见 docs/RULES.md。

