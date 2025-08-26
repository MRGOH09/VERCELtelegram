import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// JWT Token验证
export async function validateJWTToken(req) {
  try {
    // 从Cookie或Authorization header获取token
    let token = null
    
    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie)
      token = cookies.auth_token || cookies.auth
    }
    
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '')
    }
    
    if (!token) {
      return null
    }
    
    // 验证JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // 获取用户信息
    const { data: user } = await supabase
      .from('users')
      .select('id, telegram_id, name, branch_code')
      .eq('telegram_id', decoded.telegram_id)
      .single()
      
    return user
  } catch (error) {
    console.error('JWT validation error:', error)
    return null
  }
}

// 验证Telegram认证数据
export function verifyTelegramAuth(data, botToken) {
  const { hash, ...userData } = data
  
  // 创建数据字符串
  const dataCheckString = Object.keys(userData)
    .sort()
    .map(key => `${key}=${userData[key]}`)
    .join('\n')
  
  // 计算hash
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  
  return calculatedHash === hash
}

// 获取或创建用户 (复用现有逻辑)
export async function getOrCreateUserByTelegram(telegramData, chatId = null, branch = null) {
  const { id: telegramId, first_name, username } = telegramData
  console.log(`[getOrCreateUserByTelegram] 查询用户 telegram_id: ${telegramId}`)
  
  // 查找现有用户
  let { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, branch_code')
    .eq('telegram_id', telegramId)
    .maybeSingle()
    
  console.log(`[getOrCreateUserByTelegram] 现有用户查询结果:`, existingUser)
  
  let userId = null
  
  if (!existingUser) {
    console.log(`[getOrCreateUserByTelegram] 用户不存在，创建新用户`)
    // 创建新用户
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        name: first_name || username || 'User',
        branch_code: branch,
        status: 'active'
      })
      .select('id')
      .single()
    
    if (createError) throw createError
    userId = newUser.id
    
    console.log(`[getOrCreateUserByTelegram] 新用户创建成功: ${userId}`)
  } else {
    userId = existingUser.id
    console.log(`[getOrCreateUserByTelegram] 用户已存在，当前分行: ${existingUser.branch_code}`)
    
    // 更新用户名
    await supabase
      .from('users')
      .update({ name: first_name || username || 'User' })
      .eq('id', userId)
      
    console.log(`[getOrCreateUserByTelegram] 用户名更新成功，保留分行: ${existingUser.branch_code}`)
  }
  
  // 确保用户profile存在
  const { data: existingProfile } = await supabase
    .from('user_profile')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()
    
  console.log(`[getOrCreateUserByTelegram] 现有profile:`, existingProfile)
  
  if (!existingProfile) {
    await supabase
      .from('user_profile')
      .insert({
        user_id: userId,
        display_name: first_name || username || 'User',
        chat_id: chatId,
        language: 'zh'
      })
  } else {
    await supabase
      .from('user_profile')
      .upsert({
        user_id: userId,
        display_name: first_name || username || existingProfile.display_name,
        chat_id: chatId
      })
  }
  
  console.log(`[getOrCreateUserByTelegram] profile upsert完成`)
  
  // 返回最终用户信息
  const { data: finalUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
    
  console.log(`[getOrCreateUserByTelegram] 最终用户分行: ${finalUser.branch_code}`)
  
  return finalUser
}

// Cookie解析工具
function parseCookies(cookieString) {
  return cookieString
    .split(';')
    .reduce((cookies, cookie) => {
      const [name, value] = cookie.split('=').map(c => c.trim())
      cookies[name] = value
      return cookies
    }, {})
}

// 日期工具函数
export function formatYMD(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function getYYYYMM(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

export function getEndOfMonth(yyyymm) {
  const year = parseInt(yyyymm.slice(0, 4))
  const month = parseInt(yyyymm.slice(5, 7))
  const lastDay = new Date(year, month, 0).getDate()
  return `${yyyymm}-${lastDay.toString().padStart(2, '0')}`
}