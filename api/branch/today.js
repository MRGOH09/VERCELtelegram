import supabase from '../../lib/supabase.js'
import { format } from 'date-fns'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const code = String(req.query.code || '').toUpperCase()
    if (!code) return res.status(400).json({ error: 'code required' })
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('branch_daily')
      .select('*')
      .eq('ymd', today)
      .eq('branch_code', code)
      .maybeSingle()
    if (error) throw error
    return res.status(200).json({ date: today, branch: code, stat: data || { done: 0, total: 0, rate: 0 } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

