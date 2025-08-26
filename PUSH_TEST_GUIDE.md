# 🔔 Web推送功能测试指南

## 📋 测试前检查清单

### 1. 环境要求
- ✅ 使用 Chrome/Edge/Firefox (Safari需要特殊配置)
- ✅ 使用 HTTPS 环境 (localhost也可以)
- ✅ 确保浏览器允许通知权限

### 2. 必要数据库表
确保Supabase中存在 `push_subscriptions` 表：
```sql
-- 如果表不存在，在Supabase SQL编辑器中运行：
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    device_info jsonb,
    last_used timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, endpoint)
);
```

## 🧪 测试步骤

### 方法1: 使用专用测试页面 (推荐)
1. 访问: `https://yourdomain.vercel.app/test-push.html`
2. 按步骤操作:
   - 点击 "🔐 请求推送权限"
   - 浏览器弹出权限请求，点击"允许"
   - 点击 "✅ 订阅推送通知"
   - 点击 "🧪 发送测试推送"
3. 应该收到测试通知！

### 方法2: 使用PWA设置页面
1. 访问: `https://yourdomain.vercel.app/settings`
2. 找到"推送通知"设置
3. 开启推送通知开关
4. 使用"发送测试推送"按钮

### 方法3: 触发定时推送
1. 等待晨间推送 (每天8:00 AM)
2. 等待晚间提醒 (每天6:00 PM)
3. 或者在Telegram中记录消费，触发推送

## 🔍 故障排除

### 推送权限被拒绝
- Chrome: 地址栏左侧 → 点击锁图标 → 通知 → 允许
- Firefox: 地址栏左侧 → 盾牌图标 → 通知 → 允许

### 订阅失败
- 检查网络连接
- 查看浏览器控制台错误信息
- 确认用户已正确登录 (有JWT token)

### 推送不显示
- 检查操作系统通知设置
- Windows: 设置 → 系统 → 通知和操作
- macOS: 系统偏好设置 → 通知
- 关闭浏览器重新打开

### 调试信息
在浏览器控制台查看详细日志：
```
[Push] 推送权限已获得
[Push] 浏览器订阅成功
[Push] 服务器订阅保存成功
[Push] 测试推送发送成功
```

## 📊 验证推送是否工作

### 1. 数据库检查
在Supabase中查询:
```sql
SELECT * FROM push_subscriptions ORDER BY created_at DESC;
```
应该看到你的订阅记录。

### 2. 服务器日志
查看Vercel部署日志，应该看到:
```
[PWA] 用户 xxx 订阅推送通知
✅ [PWA] 推送订阅保存成功
[PWA] 用户 xxx 请求测试推送
✅ [PWA] 测试推送发送成功
```

### 3. 浏览器通知
成功的测试推送应该显示:
- 标题: "🧪 测试通知"
- 内容: "恭喜！你的推送通知设置成功了！"
- 图标: 应用图标

## ⚡ 高级测试

### 手动触发定时任务
使用以下URL触发推送:
- 晨间推送: `https://yourdomain.vercel.app/api/cron/morning-push`
- 晚间提醒: `https://yourdomain.vercel.app/api/cron/daily-settlement`

注意: 这些是受保护的endpoint，只能从Vercel cron或特定IP调用。

## 🎯 预期结果

完整功能的推送系统应该：
- ✅ 成功请求和获得通知权限
- ✅ 订阅信息正确保存到数据库
- ✅ 测试推送能正常发送和显示
- ✅ 定时推送 (8:00AM / 6:00PM) 正常工作
- ✅ 推送内容个性化 (包含用户名和数据)

## 📞 支持

如果遇到问题:
1. 检查浏览器控制台错误
2. 检查Supabase数据库状态
3. 确认环境变量配置正确
4. 联系技术支持并提供详细错误信息