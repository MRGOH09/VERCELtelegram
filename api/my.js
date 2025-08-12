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
    // Live mode: derive caps from current profile (no snapshot locking)
    const { data: profLive, error: profLiveErr } = await supabase
      .from('user_profile')
      .select('monthly_income,a_pct,b_pct,travel_budget_annual')
      .eq('user_id', userId)
      .maybeSingle()
    if (profLiveErr) throw profLiveErr
    const income = Number(profLive?.monthly_income || 0)
    const aPct = Number(profLive?.a_pct || 0)
    const bPct = Number(profLive?.b_pct || 0)
    const cPct = Math.max(0, 100 - aPct - bPct)
    const capA = income * aPct / 100
    const capB = income * bPct / 100
    const capC = income * cPct / 100
    const epfPct = Number(profLive?.epf_pct || 24)
    const epf = income * epfPct / 100
    const travelMonthlyNum = Number(profLive?.travel_budget_annual || 0) / 12

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

    // Realtime ratios against income
    const denom = income > 0 ? income : 0
    const ra = denom > 0 ? Math.round((mtdTotals.a / denom) * 100) : null
    const rb = denom > 0 ? Math.round(((mtdTotals.b + travelMonthlyNum) / denom) * 100) : null
    const rc = denom > 0 ? Math.round(((mtdTotals.c + epf) / denom) * 100) : null
    const aProgress = capA > 0 ? Math.min(100, Math.round((mtdTotals.a / capA) * 100)) : 0
    const bProgress = capB > 0 ? Math.min(100, Math.round(((mtdTotals.b + travelMonthlyNum) / capB) * 100)) : 0
    const cProgress = capC > 0 ? Math.min(100, Math.round(((mtdTotals.c + epf) / capC) * 100)) : 0

    return res.status(200).json({
      range,
      totals,
      snapshot: null,
      progress: { a: aProgress, b: bProgress, c: cProgress },
      realtime: { a: ra, b: rb, c: rc },
      snapshotView: {
        income: income.toFixed(2),
        a_pct: aPct.toFixed(2),
        b_pct: bPct.toFixed(2),
        c_pct: cPct.toFixed(2),
        cap_a: capA.toFixed(2),
        cap_b: capB.toFixed(2),
        cap_c: capC.toFixed(2),
        epf: epf.toFixed(2),
        travelMonthly: Number(travelMonthlyNum || 0).toFixed(2)
      }
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

