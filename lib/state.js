import supabase from './supabase.js'

export async function getOrCreateUserByTelegram(from, chatId) {
  console.log(`[getOrCreateUserByTelegram] 查询用户 telegram_id: ${from.id}`)
  
  // 先检查用户是否已存在
  const { data: existingUser } = await supabase
    .from('users')
    .select('id,branch_code')
    .eq('telegram_id', from.id)
    .maybeSingle()
  
  console.log(`[getOrCreateUserByTelegram] 现有用户查询结果:`, existingUser)
  
  let userId
  
  if (existingUser) {
    console.log(`[getOrCreateUserByTelegram] 用户已存在，当前分行: ${existingUser.branch_code}`)
    // 用户已存在，只更新名称，保留现有的branch_code
    const { error: updateErr } = await supabase
      .from('users')
      .update({ 
        name: from.first_name || from.username || 'user'
      })
      .eq('telegram_id', from.id)
    
    if (updateErr) throw updateErr
    userId = existingUser.id
    console.log(`[getOrCreateUserByTelegram] 用户名更新成功，保留分行: ${existingUser.branch_code}`)
  } else {
    console.log(`[getOrCreateUserByTelegram] 创建新用户`)
    // 新用户，创建时设置默认分行
    const { data: users, error: userErr } = await supabase
      .from('users')
      .insert([{ 
        telegram_id: from.id, 
        name: from.first_name || from.username || 'user', 
        branch_code: process.env.DEFAULT_BRANCH || '快点设置分行' 
      }])
      .select('id')
    
    if (userErr) throw userErr
    userId = users[0].id
    console.log(`[getOrCreateUserByTelegram] 新用户创建成功，userId: ${userId}`)
  }

  // 为用户profile更新chat_id，但保留现有display_name
  // 先检查是否已有profile
  const { data: existingProfile } = await supabase
    .from('user_profile')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()

  console.log(`[getOrCreateUserByTelegram] 现有profile:`, existingProfile)

  // 使用upsert，但保持智能的display_name处理
  const { error: profileErr } = await supabase
    .from('user_profile')
    .upsert([{ 
      user_id: userId, 
      chat_id: chatId,
      // 如果是新用户设为null让用户设置，老用户保持原值
      display_name: existingProfile?.display_name || null
    }], {
      onConflict: 'user_id',
      ignoreDuplicates: false
    })

  console.log(`[getOrCreateUserByTelegram] profile upsert完成，error:`, profileErr)
  
  if (profileErr) throw profileErr
  
  // 最后再次确认用户的分行设置
  const { data: finalUser } = await supabase
    .from('users')
    .select('branch_code')
    .eq('id', userId)
    .single()
  
  console.log(`[getOrCreateUserByTelegram] 最终用户分行: ${finalUser?.branch_code}`)
  
  return userId
}

export async function getState(userId) {
  const { data } = await supabase
    .from('user_state')
    .select('flow,step,payload,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (data) {
    const now = new Date()
    const updatedAt = new Date(data.updated_at)
    const diffHours = (now - updatedAt) / (1000 * 60 * 60)
    
    // 如果状态超过24小时，自动过期
    if (diffHours > 24) {
      console.log(`State expired for user ${userId}, clearing...`)
      await clearState(userId)
      return null
    }
  }
  
  return data || null
}

export async function setState(userId, flow, step, payload = {}) {
  await supabase.from('user_state').upsert({ 
    user_id: userId, 
    flow, 
    step, 
    payload, 
    updated_at: new Date().toISOString() 
  })
}

export async function clearState(userId) {
  await supabase.from('user_state').delete().eq('user_id', userId)
}

// 新增：获取步骤描述
export function getStepDescription(step) {
  const stepDescriptions = {
    'nickname': '输入昵称',
    'phone': '输入手机号',
    'email': '输入邮箱',
    'income': '输入月收入',
    'a_pct': '设置开销占比',
    'travel': '设置旅游目标',
    'ins_med': '输入医疗保险',
    'ins_car': '输入车险',
    'prev': '输入上月开销占比',
    'branch': '选择分行'
  }
  return stepDescriptions[step] || '未知步骤'
}

