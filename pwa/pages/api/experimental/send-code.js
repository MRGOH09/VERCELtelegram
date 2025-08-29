// 发送验证码API（实验性）

// 使用全局存储（实际应用应使用Redis或数据库）
if (!global.verificationCodes) {
  global.verificationCodes = new Map()
}
const verificationCodes = global.verificationCodes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { phone } = req.body

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: '请提供有效的手机号码' })
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    
    // 存储验证码（带时间戳）
    verificationCodes.set(phone, {
      code,
      timestamp: Date.now()
    })

    console.log(`[Experimental Send Code] 发送验证码到 ${phone}: ${code}`)

    // 在实际应用中，这里应该调用SMS服务发送验证码
    // 例如: await sendSMS(phone, `您的验证码是: ${code}`)

    // 开发环境返回验证码（生产环境不应返回）
    const response = {
      success: true,
      message: '验证码已发送'
    }

    if (process.env.NODE_ENV === 'development') {
      response.code = code // 仅在开发环境返回验证码
    }

    return res.status(200).json(response)

  } catch (error) {
    console.error('[Experimental Send Code] 错误:', error)
    return res.status(500).json({ 
      error: 'Failed to send code',
      message: error.message 
    })
  }
}

// 导出验证码存储供auth-phone API使用
export { verificationCodes }