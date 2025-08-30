import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { googleId, email, name, picture, phone, verificationCode } = req.body

    console.log(`[Google Auth] 收到认证请求: email=${email}, googleId=${googleId}`)

    // 在实际应用中，这里应该验证：
    // 1. Google token的真实性（调用Google API验证）
    // 2. 手机验证码的正确性（从缓存/数据库验证）
    
    // 模拟验证码验证（开发环境接受任何6位数字）
    if (process.env.NODE_ENV === 'development') {
      if (!verificationCode || verificationCode.length !== 6) {
        return res.status(400).json({ error: '验证码无效' })
      }
    } else {
      // 生产环境应该验证真实的SMS验证码
      // const isValidCode = await verifySMSCode(phone, verificationCode)
      // if (!isValidCode) {
      //   return res.status(400).json({ error: '验证码错误' })
      // }
    }

    // 查找或创建用户
    let user = null
    
    // 先通过email查找用户 (如果email字段存在)
    let existingUser = null
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()
        
      if (!error) {
        existingUser = data
      } else if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    } catch (e) {
      console.log('[Google Auth] Email字段可能不存在，尝试其他方式查找用户')
    }

    // 如果通过email没找到，尝试通过name查找（备选方案）
    if (!existingUser) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('name', name)
          .limit(1)
          .maybeSingle()
        existingUser = data
      } catch (e) {
        console.log('[Google Auth] 通过name查找也失败，将创建新用户')
      }
    }

    if (existingUser) {
      console.log(`[Google Auth] 用户已存在: ${existingUser.id}`)
      user = existingUser
      
      // 尝试更新用户信息（兼容不同的表结构）
      const updateFields = { name: name || existingUser.name }
      
      // 只有字段存在时才添加到更新中
      try {
        if (googleId) updateFields.google_id = googleId
        updateFields.updated_at = new Date().toISOString()
        
        await supabase
          .from('users')
          .update(updateFields)
          .eq('id', user.id)
      } catch (e) {
        console.log('[Google Auth] 用户更新失败，可能是字段不存在:', e.message)
      }
    } else {
      console.log(`[Google Auth] 创建新用户`)
      
      // 创建新用户，使用基本字段
      const insertFields = {
        name,
        status: 'active',
        branch_code: 'MAIN'
      }
      
      // 只有在字段存在时才添加
      try {
        if (email) insertFields.email = email
        if (googleId) insertFields.google_id = googleId  
        if (phone) insertFields.phone_e164 = phone
        insertFields.created_at = new Date().toISOString()
        
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(insertFields)
          .select()
          .single()

        if (createError) {
          console.error('[Google Auth] 创建用户失败:', createError)
          throw createError
        }

        user = newUser
        console.log(`[Google Auth] 新用户创建成功: ${user.id}`)
      } catch (e) {
        console.error('[Google Auth] 创建用户失败，字段问题:', e.message)
        throw new Error('用户创建失败：数据库字段不兼容')
      }

      // 尝试创建用户profile
      try {
        const profileFields = {
          user_id: user.id,
          display_name: name,
          language: 'zh'
        }
        
        if (phone) profileFields.phone_e164 = phone
        if (email) profileFields.email = email
        if (picture) profileFields.avatar_url = picture
        
        await supabase
          .from('user_profile')
          .insert(profileFields)
      } catch (e) {
        console.log('[Google Auth] Profile创建失败，可能是字段问题:', e.message)
        // Profile创建失败不应该阻止整个流程
      }
    }

    // 更新用户profile（如果需要）
    if (phone) {
      await supabase
        .from('user_profile')
        .upsert({
          user_id: user.id,
          phone_e164: phone,
          avatar_url: picture
        })
    }

    // 生成JWT Token
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        name: user.name,
        google_id: googleId
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    console.log(`[Google Auth] JWT Token生成成功`)

    // 设置HttpOnly Cookie
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = isProduction
      ? 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000'
      : 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'

    res.setHeader('Set-Cookie', [
      `auth_token=${token}; ${cookieOptions}`,
      `user_name=${encodeURIComponent(user.name)}; Path=/; SameSite=Lax; Max-Age=2592000`
    ])

    // 返回成功响应
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: phone
      }
    })

  } catch (error) {
    console.error('[Google Auth] 认证错误:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}