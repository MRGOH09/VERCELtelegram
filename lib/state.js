import supabase from './supabase.js'

export async function getOrCreateUserByTelegram(from, chatId) {
  const { data: u, error: uErr } = await supabase
    .from('users')
    .select('id, branch_code')
    .eq('telegram_id', from.id)
    .maybeSingle()
  if (uErr) throw uErr
  let userId = u?.id
  if (!userId) {
    const { data: newU, error: insUErr } = await supabase
      .from('users')
      .insert([{ telegram_id: from.id, name: from.first_name || from.username || 'user', branch_code: process.env.DEFAULT_BRANCH || 'MAIN' }])
      .select('id')
      .single()
    if (insUErr) throw insUErr
    userId = newU.id
    // 新用户：不自动设置 display_name，让用户主动设置
    const { error: insProfErr } = await supabase
      .from('user_profile')
      .insert([{ user_id: userId, display_name: null, chat_id: chatId }])
    if (insProfErr) throw insProfErr
  } else {
    // 老用户：只更新 chat_id，不覆盖 display_name
    await supabase.from('user_profile').upsert({ user_id: userId, chat_id: chatId })
  }
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

