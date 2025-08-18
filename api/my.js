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
      case 'week':
        // 计算本周的开始日期（周一）和结束日期（周日）
        const dayOfWeek = today.getDay() // 0=周日, 1=周一, ..., 6=周六
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 如果是周日，往前推6天；否则推到周一
        const monday = new Date(today)
        monday.setDate(today.getDate() + mondayOffset)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        
        startDate = format(monday, 'yyyy-MM-dd')
        endDate = format(sunday, 'yyyy-MM-dd')
        yyyyMM = format(today, 'yyyy-MM') // 使用当前月份作为预算参考
        break
      default:
        return res.status(400).json({ ok: false, error: 'Invalid range' })
    }
    
    // 获取用户资料和当月预算快照
    const [profileResult, budgetResult] = await Promise.all([
      supabase.from('user_profile').select('monthly_income,a_pct,b_pct,epf_pct,travel_budget_annual,annual_medical_insurance,annual_car_insurance').eq('user_id', userId).maybeSingle(),
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
    
    // 获取分类明细数据
    const { data: categoryDetails, error: categoryError } = await supabase
      .from('records')
      .select('category_group,category_code,amount')
      .eq('user_id', userId)
      .gte('ymd', startDate)
      .lte('ymd', endDate)
      .eq('is_voided', false)
    
    if (categoryError) throw categoryError
    
    // 计算分类明细
    const categoryBreakdown = categoryDetails.reduce((acc, record) => {
      const group = record.category_group
      const code = record.category_code
      const amount = Number(record.amount || 0)
      
      if (!acc[group]) acc[group] = {}
      if (!acc[group][code]) acc[group][code] = 0
      acc[group][code] += amount
      
      return acc
    }, {})
    
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
    const totalWithEPF = totals.a + totals.b + totals.c + epf
    const realtimeA = income > 0 ? Math.round((totals.a / income) * 100) : 0
    const realtimeB = income > 0 ? Math.round((totals.b / income) * 100) : 0
    const realtimeC = income > 0 ? Math.round(((totals.c + epf) / income) * 100) : 0
    
    // 开销额度计算
    const aGap = capA - totals.a
    const aGapLine = aGap >= 0 ? `剩余额度 RM ${aGap.toFixed(2)}` : `已超出 RM ${Math.abs(aGap).toFixed(2)}`
    
    // 旅游基金月额
    const travelMonthly = income > 0 ? (Number(profLive?.travel_budget_annual || 0) / 12) : 0
    
    // 保险月额计算
    const medicalMonthly = income > 0 ? (Number(profLive?.annual_medical_insurance || 0) / 12) : 0
    const carInsuranceMonthly = income > 0 ? (Number(profLive?.annual_car_insurance || 0) / 12) : 0
    
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
        income: income.toFixed(2),
        a_pct: aPct,
        b_pct: bPct,
        c_pct: cPct,
        cap_a: capA.toFixed(2),
        cap_b: capB.toFixed(2),
        cap_c: capC.toFixed(2),
        epf: epf.toFixed(2),
        travelMonthly: Number(travelMonthly).toFixed(2),
        medicalMonthly: Number(medicalMonthly).toFixed(2),
        carInsuranceMonthly: Number(carInsuranceMonthly).toFixed(2)
      },
      display: {
        a: totals.a.toFixed(2),
        b: totals.b.toFixed(2),
        c_residual: (totals.c + epf).toFixed(2)
      },
      a_gap: aGap,
      a_gap_line: aGapLine,
      categoryBreakdown
    })
  } catch (e) {
    console.error('API Error:', e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

