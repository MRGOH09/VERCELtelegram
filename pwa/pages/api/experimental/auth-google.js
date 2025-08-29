import jwt from 'jsonwebtoken'

// 实验性Google认证API - 独立于Telegram系统
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { googleId, email, name, picture } = req.body

    console.log(`[Experimental Google Auth] 收到认证请求: ${email}`)

    // 模拟用户创建/查找（实验性，使用内存存储）
    const user = {
      id: `exp_${googleId || Date.now()}`,
      email,
      name,
      picture,
      provider: 'google',
      created_at: new Date().toISOString()
    }

    // 生成实验性JWT Token
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        name: user.name,
        provider: 'google'
      },
      process.env.JWT_SECRET || 'experimental_secret_key',
      { expiresIn: '30d' }
    )

    console.log(`[Experimental Google Auth] Token生成成功`)

    // 设置Cookie（可选）
    const cookieOptions = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'
    res.setHeader('Set-Cookie', `exp_token=${token}; ${cookieOptions}`)

    return res.status(200).json({
      success: true,
      token,
      user
    })

  } catch (error) {
    console.error('[Experimental Google Auth] 错误:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}