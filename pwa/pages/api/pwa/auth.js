import jwt from 'jsonwebtoken'
import { verifyTelegramAuth, getOrCreateUserByTelegram } from '../../../lib/auth'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const { id, first_name, username, photo_url, auth_date, hash } = req.query
    
    console.log(`[PWA Auth] 收到认证请求: telegram_id=${id}, name=${first_name}`)
    
    // 验证Telegram认证数据
    if (!verifyTelegramAuth(req.query, process.env.TELEGRAM_BOT_TOKEN)) {
      console.error(`[PWA Auth] Telegram认证验证失败`)
      return res.status(401).json({ error: 'Invalid Telegram authentication' })
    }
    
    console.log(`[PWA Auth] Telegram认证验证成功`)
    
    // 获取或创建用户
    const user = await getOrCreateUserByTelegram({
      id: parseInt(id),
      first_name: first_name || username || 'User',
      username: username
    })
    
    console.log(`[PWA Auth] 用户获取成功: ${user.id}`)
    
    // 生成JWT Token
    const token = jwt.sign(
      { 
        telegram_id: parseInt(id),
        user_id: user.id,
        name: user.name
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )
    
    console.log(`[PWA Auth] JWT Token生成成功`)
    
    // 设置HttpOnly Cookie
    res.setHeader('Set-Cookie', [
      `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`, // 30天
      `user_name=${encodeURIComponent(user.name)}; Path=/; SameSite=Strict; Max-Age=2592000`
    ])
    
    console.log(`[PWA Auth] Cookie设置成功，重定向到首页`)
    
    // 重定向到PWA首页
    return res.redirect('/')
    
  } catch (error) {
    console.error('[PWA Auth] 认证错误:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}