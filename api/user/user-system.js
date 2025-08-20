import { todayYMD } from '../../lib/time.js'
import supabase from '../../lib/supabase.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate, getYYYYMM } from '../../lib/helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { action, userId, data } = req.body
    
    if (!action) {
      return res.status(400).json({ 
        ok: false, 
        error: 'action is required',
        availableActions: ['get-profile', 'update-profile', 'get-stats', 'get-summary']
      })
    }

    // 根据动作执行相应的功能
    switch (action) {
      case 'get-profile':
        return await handleGetProfile(req, res, userId)
        
      case 'update-profile':
        return await handleUpdateProfile(req, res, userId, data)
        
      case 'get-stats':
        return await handleGetStats(req, res, userId)
        
      case 'get-summary':
        return await handleGetSummary(req, res, userId)
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown action: ${action}`,
          availableActions: ['get-profile', 'update-profile', 'get-stats', 'get-summary']
        })
    }
    
  } catch (e) {
    console.error('[user-system] 执行失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 获取用户资料
async function handleGetProfile(req, res, userId) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    const { data: profile, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[user-system] 获取用户资料失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get user profile' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      profile 
    })
    
  } catch (e) {
    console.error('[user-system] 获取用户资料失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 更新用户资料
async function handleUpdateProfile(req, res, userId, data) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!data) {
      return res.status(400).json({ 
        ok: false, 
        error: 'data is required' 
      })
    }

    const { data: profile, error } = await supabase
      .from('user_profile')
      .upsert({
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[user-system] 更新用户资料失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to update user profile' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      profile,
      message: 'Profile updated successfully'
    })
    
  } catch (e) {
    console.error('[user-system] 更新用户资料失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 获取用户统计
async function handleGetStats(req, res, userId) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    const yyyymm = todayYMD().slice(0, 7)
    
    // 获取本月记录
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('amount, category_group, category_code, ymd')
      .eq('user_id', userId)
      .gte('ymd', `${yyyymm}-01`)
      .lte('ymd', `${yyyymm}-31`)
      .eq('is_voided', false)

    if (recordsError) {
      console.error('[user-system] 获取记录失败:', recordsError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get records' 
      })
    }

    // 获取用户资料
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('monthly_income, travel_budget_annual, annual_medical_insurance, annual_car_insurance')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('[user-system] 获取用户资料失败:', profileError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get user profile' 
      })
    }

    // 计算统计
    const stats = calculateStats(records, profile, yyyymm)
    
    return res.status(200).json({ 
      ok: true, 
      stats 
    })
    
  } catch (e) {
    console.error('[user-system] 获取用户统计失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 获取用户摘要
async function handleGetSummary(req, res, userId) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    const yyyymm = getYYYYMM()
    
    // 调试日志：检查日期格式
    console.log(`[DEBUG] 获取到的日期格式: ${yyyymm}`)
    
    // 获取本月记录
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('amount, category_group, category_code, ymd')
      .eq('user_id', userId)
      .gte('ymd', `${yyyymm}-01`)
      .lte('ymd', `${yyyymm}-31`)
      .eq('is_voided', false)

    if (recordsError) {
      console.error('[user-system] 获取记录失败:', recordsError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get records' 
      })
    }

    // 获取用户资料
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('monthly_income, travel_budget_annual, annual_medical_insurance, annual_car_insurance, epf_pct')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('[user-system] 获取用户资料失败:', profileError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get user profile' 
      })
    }
    
    // 调试日志：检查用户资料
    console.log(`[DEBUG] 用户 ${userId} 资料:`, profile)

    // 计算摘要
    const summary = calculateSummary(records, profile, yyyymm)
    
    // 调试日志：检查计算结果
    console.log(`[DEBUG] 计算结果:`, summary)
    
    // 转换为 telegram.js 期望的数据格式
    try {
      // 计算EPF月供
      const monthlyIncome = summary.monthlyIncome || 0
      const epfPct = Number(profile?.epf_pct || 24) // 默认24%
      const monthlyEPF = (monthlyIncome * epfPct) / 100
      
      // 计算余额（收入 - A - B - C - EPF - 其他月度支出）
      const monthlyExpenses = (
        (summary.groups.A.total || 0) + 
        (summary.groups.B.total || 0) + 
        (summary.groups.C.total || 0) + 
        monthlyEPF +
        ((profile?.travel_budget_annual || 0) / 12) +
        ((profile?.annual_medical_insurance || 0) / 12) +
        ((profile?.annual_car_insurance || 0) / 12)
      )
      const monthlyBalance = Math.max(0, monthlyIncome - monthlyExpenses)
      
      const responseData = {
        progress: {
          a: summary.groups.A.total || 0,
          b: summary.groups.B.total || 0,
          c: summary.groups.C.total || 0
        },
        realtime: {
          a: summary.groups.A.percentage || '0.0',
          b: summary.groups.B.percentage || '0.0',
          c: summary.groups.C.percentage || '0.0'
        },
        snapshotView: {
          income: monthlyIncome,
          a_pct: 60, // 默认开销目标60%
          b_pct: 20, // 默认学习目标20%
          cap_a: summary.groups.A.target || 0,
          cap_b: summary.groups.B.target || 0,
          cap_c: summary.groups.C.target || 0,
          epf: monthlyEPF, // 计算的EPF月供
          travelMonthly: (profile?.travel_budget_annual || 0) / 12,
          medicalMonthly: (profile?.annual_medical_insurance || 0) / 12,
          carInsuranceMonthly: (profile?.annual_car_insurance || 0) / 12
        },
        totals: {
          a: summary.groups.A.total || 0,
          b: summary.groups.B.total || 0,
          c: summary.groups.C.total || 0
        },
        display: {
          a: (summary.groups.A.total || 0).toFixed(2),
          b: (summary.groups.B.total || 0).toFixed(2),
          c_residual: (summary.groups.C.total || 0).toFixed(2)
        },
        categoryBreakdown: calculateCategoryBreakdown(records, monthlyIncome),
        balance: monthlyBalance // 计算的月度余额
      }

      // 调试日志：检查转换后的数据
      console.log(`[DEBUG] 转换后的数据:`, responseData)
      
      return res.status(200).json(responseData)
    } catch (error) {
      console.error('[user-system] 数据转换失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Data conversion failed: ' + String(error.message || error) 
      })
    }

    // 调试日志：检查转换后的数据
    console.log(`[DEBUG] 转换后的数据:`, responseData)
    
  } catch (e) {
    console.error('[user-system] 获取用户摘要失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 计算统计
function calculateStats(records, profile, yyyymm) {
  const monthlyIncome = Number(profile?.monthly_income || 0)
  
  // 按分组统计
  const groupStats = {
    A: { total: 0, count: 0 }, // 开销
    B: { total: 0, count: 0 }, // 学习
    C: { total: 0, count: 0 }  // 储蓄
  }
  
  records.forEach(record => {
    const group = record.category_group
    if (groupStats[group]) {
      groupStats[group].total += Number(record.amount || 0)
      groupStats[group].count += 1
    }
  })
  
  // 计算百分比
  const totalSpent = groupStats.A.total + groupStats.B.total + groupStats.C.total
  const remaining = monthlyIncome - totalSpent
  
  const stats = {
    month: yyyymm,
    monthlyIncome,
    totalSpent,
    remaining,
    groups: {
      A: {
        ...groupStats.A,
        percentage: monthlyIncome > 0 ? (groupStats.A.total / monthlyIncome * 100).toFixed(1) : '0.0'
      },
      B: {
        ...groupStats.B,
        percentage: monthlyIncome > 0 ? (groupStats.B.total / monthlyIncome * 100).toFixed(1) : '0.0'
      },
      C: {
        ...groupStats.C,
        percentage: monthlyIncome > 0 ? (groupStats.C.total / monthlyIncome * 100).toFixed(1) : '0.0'
      }
    },
    overallPercentage: monthlyIncome > 0 ? (totalSpent / monthlyIncome * 100).toFixed(1) : '0.0'
  }
  
  return stats
}

// 计算摘要
function calculateSummary(records, profile, yyyymm) {
  const monthlyIncome = Number(profile?.monthly_income || 0)
  
  // 按分组统计
  const groupStats = {
    A: { total: 0, count: 0 }, // 开销
    B: { total: 0, count: 0 }, // 学习
    C: { total: 0, count: 0 }  // 储蓄
  }
  
  records.forEach(record => {
    const group = record.category_group
    if (groupStats[group]) {
      groupStats[group].total += Number(record.amount || 0)
      groupStats[group].count += 1
    }
  })
  
  // 计算百分比
  const totalSpent = groupStats.A.total + groupStats.B.total + groupStats.C.total
  const remaining = monthlyIncome - totalSpent
  
  // 计算目标差异
  const targetA = monthlyIncome * 0.6 // 开销目标60%
  const targetB = monthlyIncome * 0.2 // 学习目标20%
  const targetC = monthlyIncome * 0.2 // 储蓄目标20%
  
  const summary = {
    month: yyyymm,
    monthlyIncome,
    totalSpent,
    remaining,
    groups: {
      A: {
        ...groupStats.A,
        percentage: monthlyIncome > 0 ? (groupStats.A.total / monthlyIncome * 100).toFixed(1) : '0.0',
        target: targetA,
        difference: groupStats.A.total - targetA,
        status: groupStats.A.total <= targetA ? 'within' : 'exceeded'
      },
      B: {
        ...groupStats.B,
        percentage: monthlyIncome > 0 ? (groupStats.B.total / monthlyIncome * 100).toFixed(1) : '0.0',
        target: targetB,
        difference: groupStats.B.total - targetB,
        status: groupStats.B.total <= targetB ? 'within' : 'exceeded'
      },
      C: {
        ...groupStats.C,
        percentage: monthlyIncome > 0 ? (groupStats.C.total / monthlyIncome * 100).toFixed(1) : '0.0',
        target: targetC,
        difference: groupStats.C.total - targetC,
        status: groupStats.C.total <= targetC ? 'within' : 'exceeded'
      }
    },
    overallPercentage: monthlyIncome > 0 ? (totalSpent / monthlyIncome * 100).toFixed(1) : '0.0'
  }
  
  return summary
}

// 计算分类明细（按组别组织）
function calculateCategoryBreakdown(records, monthlyIncome) {
  if (!records || records.length === 0) {
    return {}
  }
  
  // 按组别和分类统计金额
  const groupedBreakdown = {}
  
  records.forEach(record => {
    const group = record.category_group
    const category = record.category_code
    const amount = Number(record.amount || 0)
    
    if (!groupedBreakdown[group]) {
      groupedBreakdown[group] = {}
    }
    
    if (!groupedBreakdown[group][category]) {
      groupedBreakdown[group][category] = 0
    }
    
    groupedBreakdown[group][category] += amount
  })
  
  return groupedBreakdown
} 