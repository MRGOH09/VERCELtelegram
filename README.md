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
- MAX_SEND_PER_RUN（每次 Cron 最大推送条数，默认 120）

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

6) 首次使用：

- 发送 `/start` 给机器人注册（一次性填写“收入/A%/B%/旅游年额/上月开销/分行”）。
- 发送 `/record`（按钮式：选择 A/B/C → 分类 → 金额 → 备注 → 预览 → 确认）。
- 发送 `/my month` 查看月度统计与目标进度。

部署到 Vercel 后，`vercel.json` 已精简为 2 个 Cron（UTC：19:00/02:00/12:00 合并一条；另有 12:30 一条），符合免费计划上限 2 条。

注意：此起步包优先后端 API 与数据口径的落地，Telegram 向导已支持分步注册/记录/设置。完整规则见 docs/RULES.md。

