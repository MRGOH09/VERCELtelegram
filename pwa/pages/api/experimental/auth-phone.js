import jwt from 'jsonwebtoken'

// 使用全局存储（在Node.js中，模块级变量在请求间共享）
if (!global.verificationCodes) {
  global.verificationCodes = new Map()
}
if (!global.phoneUsers) {
  global.phoneUsers = new Map()
}

const verificationCodes = global.verificationCodes
const phoneUsers = global.phoneUsers

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { phone, code, name } = req.body

    if (!phone || !code) {
      return res.status(400).json({ error: '请提供手机号和验证码' })
    }

    // 验证验证码
    const storedCode = verificationCodes.get(phone)
    
    if (!storedCode || storedCode.code !== code) {
      return res.status(401).json({ error: '验证码错误或已过期' })
    }

    // 检查验证码是否过期（5分钟）
    if (Date.now() - storedCode.timestamp > 5 * 60 * 1000) {
      verificationCodes.delete(phone)
      return res.status(401).json({ error: '验证码已过期' })
    }

    // 清除已使用的验证码
    verificationCodes.delete(phone)

    // 查找或创建用户
    let user = phoneUsers.get(phone)
    
    if (!user) {
      user = {
        id: `exp_phone_${Date.now()}`,
        phone,
        name: name || `用户${phone.slice(-4)}`,
        provider: 'phone',
        created_at: new Date().toISOString()
      }
      phoneUsers.set(phone, user)
      console.log(`[Experimental Phone Auth] 新用户注册: ${phone}`)
    } else {
      console.log(`[Experimental Phone Auth] 用户登录: ${phone}`)
    }

    // 生成Token
    const token = jwt.sign(
      {
        user_id: user.id,
        phone: user.phone,
        name: user.name,
        provider: 'phone'
      },
      process.env.JWT_SECRET || 'experimental_secret_key',
      { expiresIn: '30d' }
    )

    return res.status(200).json({
      success: true,
      token,
      user
    })

  } catch (error) {
    console.error('[Experimental Phone Auth] 错误:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}

// 导出验证码存储供send-code API使用
export { verificationCodes }