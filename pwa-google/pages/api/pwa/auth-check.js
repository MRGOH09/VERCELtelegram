import { validateJWTToken } from '../../../lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 验证JWT Token
    const user = await validateJWTToken(req)
    
    if (!user) {
      return res.status(200).json({ 
        authenticated: false 
      })
    }

    console.log(`[Auth Check] 验证用户: ${user.id} (${user.email})`)

    // 通过user_profile.email获取完整用户信息
    const { data: profileData, error: profileError } = await supabase
      .from('user_profile')
      .select(`
        user_id,
        display_name,
        monthly_income,
        a_pct,
        email,
        users!inner (
          id,
          name,
          branch_code,
          status
        )
      `)
      .eq('email', user.email)
      .single()

    if (profileError) {
      console.error('[Auth Check] Profile查询失败:', profileError)
      return res.status(200).json({ authenticated: false })
    }

    const profile = {
      display_name: profileData.display_name,
      monthly_income: profileData.monthly_income,
      a_pct: profileData.a_pct
    }
    
    const userData = profileData.users

    // 判断是否需要完成注册
    const needsRegistration = !profile || 
      !profile.display_name || 
      !profile.monthly_income || 
      profile.a_pct === null || 
      profile.a_pct === undefined

    console.log(`[Auth Check] 用户注册状态:`, {
      hasProfile: !!profile,
      hasDisplayName: !!profile?.display_name,
      hasMonthlyIncome: !!profile?.monthly_income,
      hasExpensePercentage: profile?.a_pct !== null && profile?.a_pct !== undefined,
      needsRegistration
    })

    return res.status(200).json({
      authenticated: true,
      needsRegistration,
      user: {
        id: userData.id,
        email: profileData.email,
        name: userData.name,
        branch_code: userData.branch_code,
        profile: profile ? {
          display_name: profile.display_name,
          monthly_income: profile.monthly_income,
          expense_percentage: profile.a_pct
        } : null
      }
    })

  } catch (error) {
    console.error('[Auth Check] 认证检查失败:', error)
    return res.status(500).json({
      authenticated: false,
      error: 'Auth check failed'
    })
  }
}