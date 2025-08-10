import supabase from '../lib/supabase.js'
import { format } from 'date-fns'
import { getYYYYMM } from '../lib/helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const userId = String(req.query.userId || '')
    const range = String(req.query.range || 'month')
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const today = new Date()
    const ymd = format(today, 'yyyy-MM-dd')
    const yyyyMM = getYYYYMM(today)

    // Ensure snapshot exists
    const { data: snap, error: snapErr } = await supabase
      .from('user_month_budget')
      .select('*')
      .eq('user_id', userId)
      .eq('yyyymm', yyyyMM)
      .maybeSingle()
    if (snapErr) throw snapErr
    let snapshot = snap
    if (!snapshot) {
      const { data: prof, error: profErr } = await supabase
        .from('user_profile')
        .select('monthly_income,a_pct,b_pct')
        .eq('user_id', userId)
        .single()
      if (profErr) throw profErr
      const { data: insSnap, error: insErr } = await supabase
        .from('user_month_budget')
        .insert([{ user_id: userId, yyyymm: yyyyMM, income: prof.monthly_income || 0, a_pct: prof.a_pct || 0, b_pct: prof.b_pct || 0 }])
        .select('*')
        .single()
      if (insErr) throw insErr
      snapshot = insSnap
    }

    // aggregate
    let startDate, endDate
    if (range === 'today') {
      startDate = ymd; endDate = ymd
    } else if (range === 'week') {
      const d = new Date(today)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1) // Monday
      startDate = format(d, 'yyyy-MM-dd')
      endDate = ymd
    } else {
      const d = new Date(today)
      d.setDate(1)
      startDate = format(d, 'yyyy-MM-dd')
      endDate = ymd
    }

    const { data: dsum, error: dErr } = await supabase
      .from('daily_summary')
      .select('sum_a,sum_b,sum_c')
      .gte('ymd', startDate)
      .lte('ymd', endDate)
      .eq('user_id', userId)

    if (dErr) throw dErr
    const totals = (dsum || []).reduce((acc, r) => {
      acc.a += Number(r.sum_a || 0)
      acc.b += Number(r.sum_b || 0)
      acc.c += Number(r.sum_c || 0)
      return acc
    }, { a: 0, b: 0, c: 0 })

    const { data: mtdData, error: mtdErr } = await supabase
      .from('daily_summary')
      .select('sum_a,sum_b,sum_c')
      .gte('ymd', `${yyyyMM}-01`)
      .lte('ymd', endDate)
      .eq('user_id', userId)
    if (mtdErr) throw mtdErr
    const mtd = mtdData || []

    const mtdTotals = mtd.reduce((acc, r) => {
      acc.a += Number(r.sum_a || 0)
      acc.b += Number(r.sum_b || 0)
      acc.c += Number(r.sum_c || 0)
      return acc
    }, { a: 0, b: 0, c: 0 })

    const aProgress = snapshot.cap_a_amount > 0 ? Math.min(100, Math.round((mtdTotals.a / snapshot.cap_a_amount) * 100)) : 0
    const bProgress = snapshot.cap_b_amount > 0 ? Math.min(100, Math.round((mtdTotals.b / snapshot.cap_b_amount) * 100)) : 0
    const cProgress = snapshot.cap_c_amount > 0 ? Math.min(100, Math.round(((mtdTotals.c + (snapshot.epf_amount || 0)) / snapshot.cap_c_amount) * 100)) : 0

    return res.status(200).json({
      range,
      totals,
      snapshot,
      progress: { a: aProgress, b: bProgress, c: cProgress }
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

