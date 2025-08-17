import supabase from '../lib/supabase.js'
import { format } from 'date-fns'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  
  try {
    const { userId, range = 'month' } = req.query
    if (!userId) return res.status(400).json({ ok: false, error: 'userId required' })
    
    const today = new Date()
    let startDate, endDate, yyyyMM
    
    switch (range) {
      case 'today':
        startDate = endDate = format(today, 'yyyy-MM-dd')
        yyyyMM = format(today, 'yyyy-MM')
        break
      case 'month':
        startDate = format(today, 'yyyy-MM-01')
        endDate = format(today, 'yyyy-MM-dd')
        yyyyMM = format(today, 'yyyy-MM')
        break
      case 'lastmonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        startDate = format(lastMonth, 'yyyy-MM-01')
        endDate = format(new Date(today.getFullYear(), today.getMonth(), 0), 'yyyy-MM-dd')
        yyyyMM = format(lastMonth, 'yyyy-MM')
        break
      default:
        return res.status(400).json({ ok: false, error: 'Invalid range' })
    }
    
    // 获取用户资料和当月预算快照
    const [profileResult, budgetResult] = await Promise.all([
      supabase.from('user_profile').select('monthly_income,a_pct,b_pct,epf_pct').eq('user_id', userId).maybeSingle(),
      supabase.from('user_month_budget').select('income,a_pct,b_pct,epf_amount').eq('user_id', userId).eq('yyyymm', yyyyMM).maybeSingle()
    ])
    
    if (profileResult.error) throw profileResult.error
    if (budgetResult.error) throw budgetResult.error
    
    const profLive = profileResult.data
    const budget = budgetResult.data
    
    // 优先使用预算快照，fallback 到 profile
    const income = Number(budget?.income || profLive?.monthly_income || 0)
    const aPct = Number(budget?.a_pct || profLive?.a_pct || 0)
    const bPct = Number(budget?.b_pct || profLive?.b_pct || 0)
    const cPct = Math.max(0, 100 - aPct - bPct)
    
    // EPF 计算：优先读取预算快照的 epf_amount，fallback 到 profile 的 epf_pct
    const epfPct = Number(budget?.epf_pct || profLive?.epf_pct || 24)
    const epf = Number(budget?.epf_amount || income * epfPct / 100)
    
    // 获取汇总数据
    const { data: summary, error: summaryError } = await supabase
      .from('daily_summary')
      .select('sum_a,sum_b,sum_c')
      .eq('user_id', userId)
      .gte('ymd', startDate)
      .lte('ymd', endDate)
    
    if (summaryError) throw summaryError
    
    const totals = summary.reduce((acc, row) => ({
      a: acc.a + Number(row.sum_a || 0),
      b: acc.b + Number(row.sum_b || 0),
      c: acc.c + Number(row.sum_c || 0)
    }), { a: 0, b: 0, c: 0 })
    
    // 计算目标金额
    const capA = income * aPct / 100
    const capB = income * bPct / 100
    const capC = income * cPct / 100
    
    // 计算进度百分比
    const progressA = capA > 0 ? Math.round((totals.a / capA) * 100) : 0
    const progressB = capB > 0 ? Math.round((totals.b / capB) * 100) : 0
    const progressC = capC > 0 ? Math.round(((totals.c + epf) / capC) * 100) : 0
    
    // 实时占比计算（储蓄包含 EPF）
    const totalSpent = totals.a + totals.b + totals.c
    const realtimeA = income > 0 ? Math.round((totals.a / income) * 100) : 0
    const realtimeB = income > 0 ? Math.round((totals.b / income) * 100) : 0
    const realtimeC = income > 0 ? Math.max(0, 100 - realtimeA - realtimeB) : 0
    
    // 开销额度计算
    const aGap = capA - totals.a
    const aGapLine = aGap >= 0 ? `剩余额度 RM ${aGap.toFixed(2)}` : `已超出 RM ${Math.abs(aGap).toFixed(2)}`
    
    // 旅游基金月额
    const travelMonthly = income > 0 ? (Number(profLive?.travel_budget_annual || 0) / 12) : 0
    
    return res.status(200).json({
      ok: true,
      range,
      totals: {
        a: totals.a,
        b: totals.b,
        c: totals.c,
        total: totalSpent
      },
      progress: {
        a: progressA,
        b: progressB,
        c: progressC
      },
      realtime: {
        a: realtimeA,
        b: realtimeB,
        c: realtimeC
      },
      snapshotView: {
        income,
        a_pct: aPct,
        b_pct: bPct,
        c_pct: cPct,
        cap_a: capA,
        cap_b: capB,
        cap_c: capC,
        epf,
        travelMonthly
      },
      display: {
        a: totals.a.toFixed(2),
        b: totals.b.toFixed(2),
        c_residual: (totals.c + epf).toFixed(2)
      },
      a_gap: aGap,
      a_gap_line: aGapLine
    })
  } catch (e) {
    console.error('API Error:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

