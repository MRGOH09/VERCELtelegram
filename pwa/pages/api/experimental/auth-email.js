import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// 模拟用户数据库（实验性）
if (!global.emailUsers) {
  global.emailUsers = new Map()
}
const users = global.emailUsers

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password, name, action } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' })
    }

    if (action === 'signup') {
      // 注册新用户
      if (users.has(email)) {
        return res.status(400).json({ error: '该邮箱已被注册' })
      }

      if (password.length < 6) {
        return res.status(400).json({ error: '密码至少需要6位' })
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const user = {
        id: `exp_email_${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        provider: 'email',
        created_at: new Date().toISOString()
      }

      users.set(email, user)
      console.log(`[Experimental Email Auth] 新用户注册: ${email}`)

      // 生成Token
      const token = jwt.sign(
        {
          user_id: user.id,
          email: user.email,
          name: user.name,
          provider: 'email'
        },
        process.env.JWT_SECRET || 'experimental_secret_key',
        { expiresIn: '30d' }
      )

      // 返回用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = user

      return res.status(200).json({
        success: true,
        token,
        user: userWithoutPassword
      })

    } else {
      // 登录现有用户
      const user = users.get(email)
      
      if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' })
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      
      if (!isValidPassword) {
        return res.status(401).json({ error: '邮箱或密码错误' })
      }

      console.log(`[Experimental Email Auth] 用户登录: ${email}`)

      // 生成Token
      const token = jwt.sign(
        {
          user_id: user.id,
          email: user.email,
          name: user.name,
          provider: 'email'
        },
        process.env.JWT_SECRET || 'experimental_secret_key',
        { expiresIn: '30d' }
      )

      // 返回用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = user

      return res.status(200).json({
        success: true,
        token,
        user: userWithoutPassword
      })
    }

  } catch (error) {
    console.error('[Experimental Email Auth] 错误:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}