import jwt from 'jsonwebtoken'

// 模拟Google账号数据库
if (!global.googleAccounts) {
  global.googleAccounts = new Map()
}
const googleAccounts = global.googleAccounts

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      birthDate,
      gender,
      googleId,
      verified
    } = req.body

    console.log(`[Create Google Account] 创建账号: ${email}`)

    // 检查邮箱是否已存在
    const fullEmail = email.includes('@') ? email : `${email}@gmail.com`
    
    if (googleAccounts.has(fullEmail)) {
      return res.status(400).json({ 
        error: '该邮箱已被注册',
        suggestion: `试试 ${email}${Math.floor(Math.random() * 1000)}@gmail.com`
      })
    }

    // 创建账号对象
    const account = {
      id: googleId || `google_${Date.now()}`,
      email: fullEmail,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      password, // 实际应用中应该加密
      phone,
      phoneVerified: verified || false,
      birthDate,
      gender,
      avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
      createdAt: new Date().toISOString(),
      settings: {
        language: 'zh-CN',
        timezone: 'Asia/Kuala_Lumpur',
        twoFactorEnabled: false,
        notifications: {
          email: true,
          sms: false,
          push: true
        }
      },
      services: {
        gmail: true,
        drive: true,
        photos: true,
        youtube: true,
        maps: true,
        calendar: true,
        meet: true,
        docs: true
      }
    }

    // 保存账号
    googleAccounts.set(fullEmail, account)
    
    // 生成JWT Token
    const token = jwt.sign(
      {
        user_id: account.id,
        email: account.email,
        name: account.fullName,
        verified: account.phoneVerified,
        provider: 'google'
      },
      process.env.JWT_SECRET || 'google_test_secret',
      { expiresIn: '30d' }
    )

    // 生成OAuth tokens（模拟）
    const oauthTokens = {
      access_token: Buffer.from(`access_${account.id}_${Date.now()}`).toString('base64'),
      refresh_token: Buffer.from(`refresh_${account.id}_${Date.now()}`).toString('base64'),
      id_token: token,
      scope: 'openid email profile https://www.googleapis.com/auth/userinfo.email',
      token_type: 'Bearer',
      expires_in: 3599
    }

    console.log(`[Create Google Account] 账号创建成功: ${account.id}`)

    // 返回账号信息（不包含密码）
    const { password: _, ...accountWithoutPassword } = account

    return res.status(200).json({
      success: true,
      message: '账号创建成功',
      user: accountWithoutPassword,
      token,
      oauth: oauthTokens,
      nextSteps: [
        '验证邮箱地址',
        '设置账号恢复选项',
        '完善个人资料',
        '探索Google服务'
      ]
    })

  } catch (error) {
    console.error('[Create Google Account] 错误:', error)
    return res.status(500).json({ 
      error: '创建账号失败',
      message: error.message 
    })
  }
}