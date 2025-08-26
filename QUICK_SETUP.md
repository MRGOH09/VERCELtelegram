# 🚀 快速设置指南

## 步骤 1: Supabase设置

1. **登录Supabase**: https://app.supabase.com
2. **获取API密钥**:
   - Settings → API
   - 复制 Project URL, anon key, service_role key

3. **运行SQL脚本**:
   - SQL Editor → New Query
   - 复制粘贴 `supabase-setup.sql` 的内容
   - 点击 Run

## 步骤 2: Vercel环境变量

1. **登录Vercel**: https://vercel.com
2. **进入项目设置**: 你的项目 → Settings → Environment Variables
3. **添加以下变量**:

```bash
SUPABASE_URL=你的Supabase URL
SUPABASE_SERVICE_KEY=你的service_role密钥
SUPABASE_ANON_KEY=你的anon密钥
TELEGRAM_BOT_TOKEN=你的Bot Token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=你的Bot用户名
JWT_SECRET=a13b856dc4a28988be698344058e30a3eedba4f0d9b9258aae1de9900ecd9382
NEXT_PUBLIC_FCM_VAPID_KEY=BHn7QgZMASGfPzs_t1h604Z5ku_HlpZufjZZgDO1qiPopryzLII_GaInmuHqiNMhypVkz99dy2ES8tknl8n-ncE
VAPID_PRIVATE_KEY=ipeX28Aw-OH1EVubf6M4P2azz3ijx5n6wp0Us7V6zEU
```

4. **重新部署**: Deployments → 三个点 → Redeploy

## 步骤 3: 验证设置

### 检查数据库
在Supabase SQL Editor运行:
```sql
-- 检查表是否创建
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'push_subscriptions';

-- 应该返回: push_subscriptions
```

### 测试推送
1. 访问: `https://你的域名.vercel.app/test-push.html`
2. 点击"请求推送权限" → 允许
3. 点击"订阅推送通知"
4. 点击"发送测试推送"
5. 应该收到测试通知！

## 步骤 4: 设置定时任务（可选）

在 Vercel Dashboard → Settings → Functions → Crons 添加:

```json
{
  "crons": [
    {
      "path": "/api/cron/morning-push",
      "schedule": "0 0 * * *"  // UTC 0:00 = 马来西亚 8:00 AM
    },
    {
      "path": "/api/cron/daily-settlement",  
      "schedule": "0 10 * * *"  // UTC 10:00 = 马来西亚 6:00 PM
    }
  ]
}
```

## 🎯 完成检查清单

- [ ] Supabase API密钥已配置
- [ ] Telegram Bot Token已配置
- [ ] JWT密钥已配置
- [ ] VAPID密钥已配置
- [ ] 数据库表已创建
- [ ] 推送测试成功
- [ ] 定时任务已配置（可选）

## 🆘 常见问题

### Q: Invalid action错误
A: 确保所有环境变量已正确设置并重新部署

### Q: 推送权限被拒绝
A: 浏览器设置 → 通知 → 允许你的网站

### Q: 数据库连接失败
A: 检查SUPABASE_URL和密钥是否正确

### Q: JWT认证失败
A: 确保JWT_SECRET在所有环境中一致

## 📞 需要帮助？

如果遇到问题：
1. 检查Vercel Functions日志
2. 查看浏览器控制台错误
3. 确认Supabase表已创建
4. 验证所有环境变量已设置