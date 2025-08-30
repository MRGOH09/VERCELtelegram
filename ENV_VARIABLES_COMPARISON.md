# 🔍 项目环境变量对比分析

## 📊 环境变量完整对比

| 变量名 | 主项目 | PWA | PWA-Google | 说明 |
|--------|-------|-----|------------|------|
| `SUPABASE_URL` | ✅ | ✅ | ✅ | Supabase项目URL |
| `SUPABASE_SERVICE_KEY` | ✅ | ❌ | ✅ | 服务端操作密钥（主项目和PWA-Google需要） |
| `SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | 客户端操作密钥 |
| `JWT_SECRET` | ✅ | ✅ | ✅ | JWT签名密钥 |
| `TELEGRAM_BOT_TOKEN` | ✅ | ✅ | ✅ | Telegram机器人Token |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | ✅ | ✅ | ✅ | 机器人用户名（前端可见） |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ❌ | ❌ | ✅ | Google OAuth客户端ID（仅PWA-Google需要） |
| `NEXT_PUBLIC_FCM_VAPID_KEY` | ✅ | ❌ | ✅ | Web Push公钥 |
| `VAPID_PRIVATE_KEY` | ✅ | ❌ | ✅ | Web Push私钥 |
| `CRON_SECRET` | ✅ | ❌ | ❌ | Vercel Cron安全密钥 |
| `NEXT_PUBLIC_APP_NAME` | ❌ | ✅ | ❌ | 应用名称（PWA特有） |
| `NEXT_PUBLIC_APP_DESCRIPTION` | ❌ | ✅ | ❌ | 应用描述（PWA特有） |

## 🚨 PWA-Google缺失的关键环境变量

从你现有的主项目和PWA项目来看，PWA-Google可能缺少以下变量：

### 必需变量（从主项目复制）
```bash
# 从主项目获取这些值
SUPABASE_URL=https://ezrpmrnfdvtfxwnyekzi.supabase.co
SUPABASE_SERVICE_KEY=[从主项目复制]
SUPABASE_ANON_KEY=[从主项目复制]
JWT_SECRET=[从主项目复制，确保统一]
TELEGRAM_BOT_TOKEN=[从主项目复制]
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=[从主项目复制]
```

### PWA-Google特有变量
```bash
# 需要新申请的Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=[需要从Google Console获取]
```

### Web Push变量（可选）
```bash
# 从主项目复制或使用默认值
NEXT_PUBLIC_FCM_VAPID_KEY=BHn7QgZMASGfPzs_t1h604Z5ku_HlpZufjZZgDO1qiPopryzLII_GaInmuHqiNMhypVkz99dy2ES8tknl8n-ncE
VAPID_PRIVATE_KEY=ipeX28Aw-OH1EVubf6M4P2azz3ijx5n6wp0Us7V6zEU
```

## 📋 Vercel配置检查清单

在Vercel Dashboard → PWA-Google项目 → Settings → Environment Variables中确认：

### ✅ 必需变量（来源：主项目）
- [ ] `SUPABASE_URL` 
- [ ] `SUPABASE_SERVICE_KEY` 
- [ ] `SUPABASE_ANON_KEY` 
- [ ] `JWT_SECRET` 
- [ ] `TELEGRAM_BOT_TOKEN` 
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` 

### ✅ PWA-Google特有变量
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` （需要新申请）

### ⚠️ 可选变量
- [ ] `NEXT_PUBLIC_FCM_VAPID_KEY` 
- [ ] `VAPID_PRIVATE_KEY` 

## 🔑 如何获取缺失的环境变量

### 1. 从现有主项目复制
```bash
# 使用Vercel CLI从主项目导出环境变量
vercel env pull .env.main --cwd /path/to/main/project

# 然后复制到PWA-Google项目
```

### 2. 获取Google Client ID
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Create Credentials → OAuth 2.0 Client ID
4. 配置授权域名：
   - `https://pwa-google-[随机字符].vercel.app`
   - `https://pwagoogle-git-main-mrgoh09s-projects.vercel.app`

## 🐛 401错误的真正原因

基于环境变量分析，401错误很可能是由于：

1. **JWT_SECRET缺失或错误** - 导致所有认证失败
2. **SUPABASE_SERVICE_KEY缺失** - API无法连接数据库
3. **环境变量未生效** - Vercel配置问题

## 🛠️ 修复步骤

### 步骤1: 立即配置必需变量
在Vercel Dashboard中添加：
```bash
SUPABASE_URL=https://ezrpmrnfdvtfxwnyekzi.supabase.co
SUPABASE_SERVICE_KEY=[从现有项目复制]
SUPABASE_ANON_KEY=[从现有项目复制]  
JWT_SECRET=[从现有项目复制]
```

### 步骤2: 重新部署
配置环境变量后，在Vercel Dashboard点击 "Redeploy"

### 步骤3: 测试
访问：`https://pwagoogle-git-main-mrgoh09s-projects.vercel.app/api/public-health`

## 💡 重要提示

- **JWT_SECRET必须一致**：如果要与主系统共享用户会话，三个项目的JWT_SECRET必须相同
- **数据库共享**：三个项目都使用同一个Supabase实例，确保数据一致性
- **Google OAuth**：PWA-Google需要独立的Google Client ID

---
🎯 **立即行动**：先配置前6个必需的环境变量，然后重新部署！