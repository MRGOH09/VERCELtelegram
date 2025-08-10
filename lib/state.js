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
    const { error: insProfErr } = await supabase
      .from('user_profile')
      .insert([{ user_id: userId, display_name: from.first_name || from.username || 'user', chat_id: chatId }])
    if (insProfErr) throw insProfErr
  } else {
    await supabase.from('user_profile').upsert({ user_id: userId, display_name: from.first_name || from.username || 'user', chat_id: chatId })
  }
  return userId
}

export async function getState(userId) {
  const { data } = await supabase.from('user_state').select('flow,step,payload').eq('user_id', userId).maybeSingle()
  return data || null
}

export async function setState(userId, flow, step, payload = {}) {
  await supabase.from('user_state').upsert({ user_id: userId, flow, step, payload, updated_at: new Date().toISOString() })
}

export async function clearState(userId) {
  await supabase.from('user_state').delete().eq('user_id', userId)
}

