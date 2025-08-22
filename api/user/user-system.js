import { todayYMD } from '../../lib/time.js'
import supabase from '../../lib/supabase.js'
import { messages } from '../../lib/i18n.js'
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
      
      // 学习总额 = B类记录 + 旅游基金
      const travelMonthly = (profile?.travel_budget_annual || 0) / 12
      const totalLearning = (summary.groups.B.total || 0) + travelMonthly
      
      // 计算余额（收入 - 开销 - 学习完整金额）- 允许负数
      console.log(`[DEBUG] 余额计算: 收入${monthlyIncome} - 开销${summary.groups.A.total} - 学习${totalLearning}`)
      const monthlyBalance = monthlyIncome - (summary.groups.A.total || 0) - totalLearning
      console.log(`[DEBUG] 计算后余额: ${monthlyBalance}`)
      
      // 判断是否超支
      const isOverspent = monthlyBalance < 0
      const overspentAmount = isOverspent ? Math.abs(monthlyBalance) : 0
      
      // 储蓄 = monthlyBalance（可以是负数）
      const totalSavings = monthlyBalance
      
      const responseData = {
        progress: {
          a: summary.groups.A.total || 0,
          b: totalLearning, // 学习 = B类记录 + 旅游基金
          c: totalSavings // 储蓄 = 余额
        },
        realtime: {
          a: monthlyIncome > 0 ? ((summary.groups.A.total || 0) / monthlyIncome * 100).toFixed(1) : '0.0',
          b: monthlyIncome > 0 ? (totalLearning / monthlyIncome * 100).toFixed(1) : '0.0',
          c: monthlyIncome > 0 ? (totalSavings / monthlyIncome * 100).toFixed(1) : '0.0'
        },
        snapshotView: {
          income: monthlyIncome,
          a_pct: profile?.a_pct || 60, // 用户设置的开销目标占比
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
          b: totalLearning,
          c: totalSavings
        },
        display: {
          a: (summary.groups.A.total || 0).toFixed(2),
          b: totalLearning.toFixed(2),
          c_residual: totalSavings.toFixed(2)
        },
        categoryBreakdown: calculateCategoryBreakdown(records, monthlyIncome, profile, monthlyBalance, summary),
        balance: monthlyBalance // 计算的月度余额
      }

      // 调试日志：检查转换后的数据
      console.log(`[DEBUG] 转换后的数据:`, responseData)
      
      // 格式化消息以匹配telegram期望的格式
      const range = 'month'
      const aGap = (responseData.snapshotView.cap_a - responseData.totals.a).toFixed(2)
      const aGapLine = Number(aGap) >= 0 ? `剩余额度 RM ${aGap}` : `已超出 RM ${Math.abs(Number(aGap)).toFixed(2)}`
      
      // 添加学习超支警告
      const learningDisplay = isOverspent ? 
        `${(responseData.display?.b || responseData.totals.b.toFixed(2))} ⚠️已超支` : 
        (responseData.display?.b || responseData.totals.b.toFixed(2))
      
      const msg = formatTemplate(messages.my.summary, {
        range,
        a: responseData.display?.a || responseData.totals.a.toFixed(2),
        b: learningDisplay,
        c: responseData.display?.c_residual || responseData.totals.c.toFixed(2),
        ra: responseData.realtime.a,
        rb: responseData.realtime.b,
        rc: responseData.realtime.c,
        a_pct: responseData.snapshotView.a_pct || 60,
        da: `还可花 RM ${aGap >= 0 ? aGap : '0.00'}`,
        a_gap_line: aGapLine,
        income: responseData.snapshotView.income || 0,
        cap_a: responseData.snapshotView.cap_a || 0,
        epf: responseData.snapshotView.epf || 0,
        travel: (responseData.snapshotView.travelMonthly || 0).toFixed(2),
        medical: (responseData.snapshotView.medicalMonthly || 0).toFixed(2),
        car_insurance: (responseData.snapshotView.carInsuranceMonthly || 0).toFixed(2),
        category_details: formatCategoryBreakdown(responseData.categoryBreakdown)
      })
      
      return res.status(200).json({
        ...responseData,
        msg
      })
    } catch (error) {
      console.error('[user-system] 数据转换失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Data conversion failed: ' + String(error.message || error) 
      })
    }

    
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
  const aPct = Number(profile?.a_pct || 60) / 100 // 用户设置的开销占比
  const targetA = monthlyIncome * aPct // 开销目标
  const targetB = monthlyIncome * 0.2 // 学习目标20%
  const targetC = monthlyIncome * (0.8 - aPct) // 储蓄目标 = 80% - 开销占比
  
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
function calculateCategoryBreakdown(records, monthlyIncome, profile, monthlyBalance, summary) {
  // 按组别和分类统计金额
  const groupedBreakdown = {}
  
  // 处理实际记录
  if (records && records.length > 0) {
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
  }
  
  // 加入自动生成的月度项目
  if (profile) {
    // 旅游基金（学习类）
    const travelMonthly = Number(profile.travel_budget_annual || 0) / 12
    if (travelMonthly > 0) {
      if (!groupedBreakdown['B']) groupedBreakdown['B'] = {}
      groupedBreakdown['B']['travel_auto'] = travelMonthly
    }
    
    // 医疗保险（储蓄类）
    const medicalMonthly = Number(profile.annual_medical_insurance || 0) / 12
    if (medicalMonthly > 0) {
      if (!groupedBreakdown['C']) groupedBreakdown['C'] = {}
      groupedBreakdown['C']['ins_med_auto'] = medicalMonthly
    }
    
    // 车险（储蓄类）
    const carMonthly = Number(profile.annual_car_insurance || 0) / 12
    if (carMonthly > 0) {
      if (!groupedBreakdown['C']) groupedBreakdown['C'] = {}
      groupedBreakdown['C']['ins_car_auto'] = carMonthly
    }
    
    // 余额（储蓄类）- 扣除已显示的保险和C类记录，允许负数
    const displayedInsurance = medicalMonthly + carMonthly // 已在分类明细显示的保险
    const displayedCRecords = Object.keys(groupedBreakdown.C || {})
      .filter(key => !key.includes('_auto') && key !== 'balance')
      .reduce((sum, key) => sum + (groupedBreakdown.C[key] || 0), 0)
    
    const remainingBalance = monthlyBalance - displayedInsurance - displayedCRecords
    // 显示余额，即使是负数
    if (!groupedBreakdown['C']) groupedBreakdown['C'] = {}
    groupedBreakdown['C']['balance'] = remainingBalance
  }
  
  return groupedBreakdown
}

// 格式化分类明细为显示字符串
function formatCategoryBreakdown(categoryBreakdown) {
  if (!categoryBreakdown || Object.keys(categoryBreakdown).length === 0) {
    return '（暂无记录）'
  }
  
  const groupLabels = { 'A': '开销', 'B': '学习', 'C': '储蓄' }
  
  // 分类代码到中文的映射
  const categoryLabels = {
    // 开销类别
    'food': '餐饮', '餐饮': '餐饮',
    'ent': '娱乐', '娱乐': '娱乐', 
    'shop': '购物', '购物': '购物',
    'transport': '交通', '交通': '交通',
    'utilities': '水电', '水电': '水电',
    'mobile': '手机', '手机': '手机',
    'home': '家用', '家用': '家用',
    'other': '其他', '其他': '其他',
    
    // 学习类别
    'books': '书籍', '书籍': '书籍',
    'course': '课程', '课程': '课程',
    'training': '培训', '培训': '培训',
    'cert': '认证', '认证': '认证',
    
    // 储蓄类别
    'stock': '股票', '股票': '股票',
    'fixed': '定存', '定存': '定存',
    'insurance': '保险', '保险': '保险',
    'emerg': '紧急基金', '紧急基金': '紧急基金',
    
    // 自动生成项目
    'ins_med_auto': '医疗保险（月）',
    'ins_car_auto': '车险（月）',
    'epf_auto': 'EPF（月）',
    'travel_auto': '旅游基金（月）',
    'balance': '余额'
  }
  
  let result = ''
  
  for (const [group, categories] of Object.entries(categoryBreakdown)) {
    const groupLabel = groupLabels[group] || group
    result += `\n${groupLabel}：\n`
    
    // 合并同类项目（英文代码和中文标签指向同一项目）
    const mergedCategories = {}
    for (const [category, amount] of Object.entries(categories)) {
      const displayName = categoryLabels[category] || category
      mergedCategories[displayName] = (mergedCategories[displayName] || 0) + Number(amount)
    }
    
    for (const [displayName, amount] of Object.entries(mergedCategories)) {
      if (amount > 0) {
        result += `  • ${displayName}：RM ${amount.toFixed(2)}\n`
      }
    }
  }
  
  return result.trim() || '（暂无记录）'
} 