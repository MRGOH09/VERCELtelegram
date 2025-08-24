import supabase from './supabase.js'

export async function getOrCreateUserByTelegram(from, chatId) {
  // 使用UPSERT避免竞态条件：如果用户存在则返回，不存在则创建
  const { data: users, error: userErr } = await supabase
    .from('users')
    .upsert([{ 
      telegram_id: from.id, 
      name: from.first_name || from.username || 'user', 
      branch_code: process.env.DEFAULT_BRANCH || 'MAIN' 
    }], {
      onConflict: 'telegram_id',
      ignoreDuplicates: false
    })
    .select('id')

  if (userErr) throw userErr
  const userId = users[0].id

  // 为用户profile更新chat_id，但保留现有display_name
  // 先检查是否已有profile
  const { data: existingProfile } = await supabase
    .from('user_profile')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()

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

  if (profileErr) throw profileErr
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

