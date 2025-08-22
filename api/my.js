import supabase from '../lib/supabase.js'
import { messages } from '../lib/i18n.js'
import { formatTemplate } from '../lib/helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, range = 'month' } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' })
    }

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 获取用户配置
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    // 计算日期范围
    const now = new Date()
    let startDate, endDate, rangeLabel

    switch (range) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        startDate = today.toISOString().split('T')[0]
        endDate = startDate
        rangeLabel = '今日'
        break
      
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        startDate = weekStart.toISOString().split('T')[0]
        endDate = now.toISOString().split('T')[0]
        rangeLabel = '本周'
        break
      
      case 'lastmonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        startDate = lastMonth.toISOString().split('T')[0]
        endDate = lastMonthEnd.toISOString().split('T')[0]
        rangeLabel = '上月'
        break
      
      case 'month':
      default:
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate = monthStart.toISOString().split('T')[0]
        endDate = now.toISOString().split('T')[0]
        rangeLabel = '本月'
        break
    }

    // 获取支出记录
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .gte('ymd', startDate)
      .lte('ymd', endDate)
      .eq('is_voided', false)

    if (recordsError) {
      console.error('Error fetching records:', recordsError)
      return res.status(500).json({ error: 'Failed to fetch records' })
    }

    // 分组统计
    const stats = {
      A: { amount: 0, count: 0 },
      B: { amount: 0, count: 0 },
      C: { amount: 0, count: 0 }
    }

    const categoryDetails = {}

    records.forEach(record => {
      const group = record.category_group
      const category = record.category_code
      const amount = record.amount || 0

      if (stats[group]) {
        stats[group].amount += amount
        stats[group].count += 1
      }

      if (!categoryDetails[category]) {
        categoryDetails[category] = { amount: 0, count: 0 }
      }
      categoryDetails[category].amount += amount
      categoryDetails[category].count += 1
    })

    // 计算总额和占比
    const totalAmount = stats.A.amount + stats.B.amount + stats.C.amount
    const income = profile.monthly_income || 0

    const percentages = {
      A: totalAmount > 0 ? (stats.A.amount / income * 100) : 0,
      B: totalAmount > 0 ? (stats.B.amount / income * 100) : 0,
      C: totalAmount > 0 ? (stats.C.amount / income * 100) : 0
    }

    // 计算目标占比
    const targetA = profile.a_pct || 0
    const targetC = 100 - targetA  // 储蓄占比 = 100% - 生活开销占比

    // 计算预算状态
    const budgetA = (income * targetA / 100)
    const remainingA = budgetA - stats.A.amount
    const budgetStatusA = remainingA >= 0 ? `还可支出 RM ${remainingA.toFixed(2)}` : `超支 RM ${Math.abs(remainingA).toFixed(2)}`

    // 格式化分类明细
    let categoryDetailsText = ''
    Object.entries(categoryDetails).forEach(([category, data]) => {
      if (data.amount > 0) {
        categoryDetailsText += `• ${category}：RM ${data.amount.toFixed(2)} (${data.count}笔)\n`
      }
    })
    if (!categoryDetailsText) {
      categoryDetailsText = '暂无支出记录'
    }

    // 构建响应消息
    const response = formatTemplate(messages.my.summary, {
      range: rangeLabel,
      a: stats.A.amount.toFixed(2),
      b: stats.B.amount.toFixed(2),
      c: stats.C.amount.toFixed(2),
      ra: percentages.A.toFixed(1),
      rb: percentages.B.toFixed(1),
      rc: percentages.C.toFixed(1),
      a_pct: targetA,
      da: (percentages.A - targetA).toFixed(1),
      a_gap_line: budgetStatusA,
      income: income.toFixed(2),
      cap_a: budgetA.toFixed(2),
      epf: ((income * 0.11) || 0).toFixed(2), // 假设EPF为11%
      travel: ((profile.travel_budget_annual || 0) / 12).toFixed(2),
      medical: ((profile.ins_med_annual || 0) / 12).toFixed(2),
      car_insurance: ((profile.ins_car_annual || 0) / 12).toFixed(2),
      category_details: categoryDetailsText.trim()
    })

    return res.status(200).json({
      ok: true,
      message: response,
      // 匹配telegram.js期望的数据结构
      realtime: {
        a: percentages.A.toFixed(1),
        b: percentages.B.toFixed(1), 
        c: percentages.C.toFixed(1)
      },
      totals: {
        a: stats.A.amount,
        b: stats.B.amount,
        c: stats.C.amount
      },
      display: {
        a: stats.A.amount.toFixed(2),
        b: stats.B.amount.toFixed(2),
        c_residual: stats.C.amount.toFixed(2)
      },
      snapshotView: {
        a_pct: targetA,
        income: income,
        cap_a: budgetA,
        cap_b: (income * (100 - targetA) / 100), // 学习投资 + 储蓄
        cap_c: (income * (100 - targetA) / 100), // 储蓄投资
        epf: (income * 0.11), // EPF 11%
        travelMonthly: ((profile.travel_budget_annual || 0) / 12),
        medicalMonthly: ((profile.ins_med_annual || 0) / 12),
        carInsuranceMonthly: ((profile.ins_car_annual || 0) / 12)
      },
      categoryBreakdown: categoryDetails,
      balance: Math.max(0, income - totalAmount),
      // 保持向后兼容
      data: {
        range: rangeLabel,
        stats,
        percentages,
        totalAmount,
        income,
        budgetStatus: {
          A: budgetStatusA
        }
      }
    })

  } catch (error) {
    console.error('Error in /api/my:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}