import supabase from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { userId, phone_e164, email, wa_opt_in, monthly_income, a_pct, b_pct, travel_budget_annual, prev_month_spend, branch_code } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (branch_code) await supabase.from('users').update({ branch_code: branch_code.toUpperCase() }).eq('id', userId)
    const payload = { phone_e164, email, wa_opt_in, monthly_income, a_pct, b_pct, travel_budget_annual, prev_month_spend }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
    if (Object.keys(payload).length) {
      await supabase.from('user_profile').upsert({ user_id: userId, ...payload })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

