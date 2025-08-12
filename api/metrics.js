import supabase from '../lib/supabase.js'
import { format } from 'date-fns'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  try {
    const type = String(req.query.type || 'leaderboard')
    const today = format(new Date(), 'yyyy-MM-dd')
    if (type === 'leaderboard') {
      const { data, error } = await supabase
        .from('leaderboard_daily')
        .select('top_json')
        .eq('ymd', today)
        .maybeSingle()
      if (error) throw error
      return res.status(200).json({ ok: true, date: today, top: data?.top_json || [] })
    }
    if (type === 'branch') {
      const code = String(req.query.code || '').toUpperCase()
      if (!code) return res.status(400).json({ ok: false, error: 'code required' })
      const { data, error } = await supabase
        .from('branch_daily')
        .select('*')
        .eq('ymd', today)
        .eq('branch_code', code)
        .maybeSingle()
      if (error) throw error
      return res.status(200).json({ ok: true, date: today, branch: code, stat: data || { done: 0, total: 0, rate: 0 } })
    }
    return res.status(400).json({ ok: false, error: 'unknown type' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

