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
    const { googleId, email, name, picture, email_verified } = req.body

    console.log(`[PWA Google Auth] 收到认证请求: email=${email}, googleId=${googleId}`)

    if (!googleId || !email) {
      return res.status(400).json({ error: '缺少必要的认证信息' })
    }

    // 查找或创建用户
    let user = null
    
    // 先尝试通过google_id查找
    let { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .maybeSingle()

    // 如果没找到，尝试通过email查找
    if (!existingUser) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()
      
      if (emailUser) {
        // 如果找到了email相同的用户，更新其google_id
        console.log(`[PWA Google Auth] 找到email相同的用户，关联Google账号`)
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            google_id: googleId,
            name: name || emailUser.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailUser.id)
          .select()
          .single()

        if (updateError) {
          console.error('[PWA Google Auth] 更新用户失败:', updateError)
          throw updateError
        }

        user = updatedUser
      }
    } else {
      user = existingUser
      console.log(`[PWA Google Auth] 找到现有Google用户: ${user.id}`)
    }

    // 如果还是没有用户，创建新用户
    if (!user) {
      console.log(`[PWA Google Auth] 创建新用户`)
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          google_id: googleId,
          email: email,
          name: name || email.split('@')[0],
          status: 'active',
          branch_code: 'MAIN', // 默认分行
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('[PWA Google Auth] 创建用户失败:', createError)
        
        // 如果是因为字段不存在，尝试不带email创建
        if (createError.message?.includes('column')) {
          const { data: simpleUser, error: simpleError } = await supabase
            .from('users')
            .insert({
              name: name || email.split('@')[0],
              status: 'active',
              branch_code: 'MAIN',
              created_at: new Date().toISOString()
            })
            .select()
            .single()

          if (simpleError) {
            throw simpleError
          }
          user = simpleUser
        } else {
          throw createError
        }
      } else {
        user = newUser
      }

      console.log(`[PWA Google Auth] 新用户创建成功: ${user.id}`)
    }

    // 更新或创建用户profile
    const { data: existingProfile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      // 创建新profile
      const profileData = {
        user_id: user.id,
        display_name: name || user.name,
        language: 'zh'
      }
      
      // 只添加存在的字段
      if (email) profileData.email = email
      if (picture) profileData.avatar_url = picture
      
      await supabase
        .from('user_profile')
        .insert(profileData)
    } else if (picture && !existingProfile.avatar_url) {
      // 更新avatar
      const updateData = {}
      if (picture) updateData.avatar_url = picture
      if (email && !existingProfile.email) updateData.email = email
      
      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('user_profile')
          .update(updateData)
          .eq('user_id', user.id)
      }
    }

    // 生成JWT Token
    const token = jwt.sign(
      {
        user_id: user.id,
        google_id: googleId,
        email: email,
        name: user.name,
        telegram_id: user.telegram_id // 保留兼容性
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    console.log(`[PWA Google Auth] JWT Token生成成功`)

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
        email: email,
        name: user.name,
        picture: picture,
        google_id: googleId,
        branch_code: user.branch_code
      }
    })

  } catch (error) {
    console.error('[PWA Google Auth] 认证错误:', error)
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    })
  }
}