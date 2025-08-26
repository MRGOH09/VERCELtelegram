import { createClient } from '@supabase/supabase-js'
import { validateJWTToken, formatYMD, getYYYYMM, getEndOfMonth } from '../../../lib/auth'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  try {
    // CORS处理
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    // JWT Token验证
    const user = await validateJWTToken(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    const { action, ...params } = req.body
    console.log(`[PWA Data] 处理请求: action=${action}, user=${user.id}`)
    
    switch (action) {
      case 'dashboard':
        return await getDashboardData(user.id, res)
        
      case 'profile':
        return await getProfileData(user.id, res)
        
      case 'check-auth':
        return res.json({ authenticated: true, user: { id: user.id, name: user.name, branch: user.branch_code } })
        
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('[PWA Data] API错误:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// 获取仪表板数据
async function getDashboardData(userId, res) {
  try {
    console.log(`[getDashboardData] 获取用户 ${userId} 的仪表板数据`)
    
    // 获取用户资料
    const { data: profile } = await supabase
      .from('user_profile')
      .select('display_name, monthly_income, a_pct, travel_budget_annual, current_streak, total_records')
      .eq('user_id', userId)
      .single()
      
    // 获取用户分行
    const { data: user } = await supabase
      .from('users')
      .select('branch_code')
      .eq('id', userId)
      .single()
      
    console.log(`[getDashboardData] 用户资料:`, { profile, user })
      
    // 获取当月预算
    const yyyymm = getYYYYMM()
    const { data: budget } = await supabase
      .from('user_month_budget')
      .select('*')
      .eq('user_id', userId)
      .eq('yyyymm', yyyymm)
      .maybeSingle()
      
    console.log(`[getDashboardData] 当月预算:`, budget)
      
    // 获取当月支出统计
    const startOfMonth = `${yyyymm}-01`
    const endOfMonth = getEndOfMonth(yyyymm)
    
    const { data: records } = await supabase
      .from('records')
      .select('category_group, amount')
      .eq('user_id', userId)
      .gte('ymd', startOfMonth)
      .lte('ymd', endOfMonth)
      .eq('is_voided', false)
      
    console.log(`[getDashboardData] 当月记录数: ${records?.length || 0}`)
      
    // 计算支出汇总
    const expenses = records?.reduce((acc, record) => {
      acc[record.category_group] = (acc[record.category_group] || 0) + Math.abs(record.amount)
      return acc
    }, { A: 0, B: 0, C: 0 }) || { A: 0, B: 0, C: 0 }
    
    // 计算占比
    const totalExpenses = expenses.A + expenses.B + expenses.C
    const income = budget?.income || profile?.monthly_income || 0
    const percentages = {
      A: income > 0 ? Math.round((expenses.A / income) * 100) : 0,
      B: income > 0 ? Math.round((expenses.B / income) * 100) : 0,
      C: income > 0 ? Math.round((expenses.C / income) * 100) : 0
    }
    
    // 获取最近记录
    const { data: recentRecords } = await supabase
      .from('records')
      .select('id, category_group, category_code, amount, note, ymd, created_at')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log(`[getDashboardData] 最近记录数: ${recentRecords?.length || 0}`)
    
    // 计算本月剩余天数
    const now = new Date()
    const endOfMonthDate = new Date(endOfMonth)
    const daysLeft = Math.max(0, Math.ceil((endOfMonthDate - now) / (1000 * 60 * 60 * 24)))
    
    const response = {
      user: {
        name: profile?.display_name || 'User',
        branch: user?.branch_code || '未设置'
      },
      monthly: {
        income: income,
        spent_a: expenses.A,
        spent_b: expenses.B,
        spent_c: expenses.C,
        percentage_a: percentages.A,
        percentage_b: percentages.B,
        percentage_c: percentages.C,
        days_left: daysLeft,
        budget_a: budget?.cap_a_amount || 0,
        budget_b: budget?.cap_b_amount || 0,
        budget_c: budget?.cap_c_amount || 0
      },
      stats: {
        current_streak: profile?.current_streak || 0,
        total_records: profile?.total_records || 0
      },
      recent: recentRecords?.map(record => ({
        id: record.id,
        category: record.category_code,
        group: record.category_group,
        amount: record.amount,
        note: record.note,
        date: record.created_at
      })) || []
    }
    
    console.log(`[getDashboardData] 返回数据:`, JSON.stringify(response, null, 2))
    
    return res.json(response)
    
  } catch (error) {
    console.error('[getDashboardData] 错误:', error)
    return res.status(500).json({ error: 'Failed to get dashboard data' })
  }
}

// 获取个人资料数据
async function getProfileData(userId, res) {
  try {
    console.log(`[getProfileData] 获取用户 ${userId} 的个人资料`)
    
    // 获取用户资料
    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()
      
    // 获取用户基本信息
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, name, branch_code, created_at')
      .eq('id', userId)
      .single()
      
    // 获取统计数据
    const { data: recordStats } = await supabase
      .from('records')
      .select('ymd')
      .eq('user_id', userId)
      .eq('is_voided', false)
      
    const uniqueDays = new Set(recordStats?.map(r => r.ymd) || []).size
    
    const response = {
      user: {
        telegram_id: user?.telegram_id,
        name: user?.name || profile?.display_name,
        branch: user?.branch_code || '未设置',
        joined_date: user?.created_at
      },
      profile: {
        display_name: profile?.display_name,
        phone: profile?.phone_e164,
        email: profile?.email,
        income: profile?.monthly_income || 0,
        a_pct: profile?.a_pct || 0,
        travel_budget: profile?.travel_budget_annual || 0
      },
      stats: {
        record_days: uniqueDays,
        total_records: profile?.total_records || 0,
        current_streak: profile?.current_streak || 0,
        max_streak: profile?.max_streak || 0
      }
    }
    
    console.log(`[getProfileData] 返回个人资料数据`)
    
    return res.json(response)
    
  } catch (error) {
    console.error('[getProfileData] 错误:', error)
    return res.status(500).json({ error: 'Failed to get profile data' })
  }
}