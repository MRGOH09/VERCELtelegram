import supabase from '../../lib/supabase.js'
import { format } from 'date-fns'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('leaderboard_daily')
      .select('top_json')
      .eq('ymd', today)
      .maybeSingle()
    if (error) throw error
    return res.status(200).json({ date: today, top: data?.top_json || [] })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

