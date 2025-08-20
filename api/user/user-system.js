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
    
    // 调试日志：检查用户资料
    console.log(`[DEBUG] 用户 ${userId} 资料:`, profile)

    // 计算摘要
    const summary = calculateSummary(records, profile, yyyymm)
    
    // 调试日志：检查计算结果
    console.log(`[DEBUG] 计算结果:`, summary)
    
    return res.status(200).json({ 
      ok: true, 
      summary 
    })
    
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