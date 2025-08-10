import supabase from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const userId = String(req.query.userId || '')
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)))
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return res.status(200).json({ records: data || [] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

