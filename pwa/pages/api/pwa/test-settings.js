import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// 验证JWT token
function verifyToken(req) {
  try {
    const authHeader = req.headers.authorization
    const cookieToken = req.cookies?.auth_token
    const token = authHeader?.replace('Bearer ', '') || cookieToken
    
    console.log('[test-settings] 检查token:', {
      hasAuthHeader: !!authHeader,
      hasCookieToken: !!cookieToken,
      tokenExists: !!token,
      jwtSecret: !!process.env.JWT_SECRET
    })
    
    if (!token) {
      console.log('[test-settings] 未找到token')
      return null
    }
    
    if (!process.env.JWT_SECRET) {
      console.error('[test-settings] JWT_SECRET未设置')
      return null
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('[test-settings] Token验证成功:', decoded)
    return decoded
  } catch (error) {
    console.error('[test-settings] Token验证失败:', error.message)
    console.error('[test-settings] Token内容:', token?.substring(0, 50) + '...')
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // 验证用户身份
    const userPayload = verifyToken(req)
    if (!userPayload) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const { action, tableName, fieldName, value } = req.body
    const userId = userPayload.user_id

    console.log(`[test-settings] 用户 ${userId} 请求: ${action}`)

    switch (action) {
      case 'get_user_data':
        return await getUserData(res, userId)
      
      case 'update_field':
        return await updateField(res, userId, tableName, fieldName, value)
      
      case 'test_db':
        // 测试数据库连接
        return await testDatabaseConnection(res)
      
      default:
        return res.status(400).json({ ok: false, error: 'Invalid action' })
    }

  } catch (error) {
    console.error('[test-settings] 错误:', error)
    return res.status(500).json({
      ok: false,
      error: error.message || '操作失败'
    })
  }
}

// 获取用户数据 - 抄袭Telegram的数据结构
async function getUserData(res, userId) {
  console.log(`[test-settings] 获取用户数据: ${userId}`)

  try {
    // 1. 获取用户基本信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, branch_code, telegram_id, created_at')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('[test-settings] 用户不存在:', userError)
      return res.status(404).json({ ok: false, error: '用户不存在' })
    }

    // 2. 获取用户资料
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select(`
        display_name,
        phone_e164,
        email,
        monthly_income,
        a_pct,
        travel_budget_annual,
        annual_medical_insurance,
        annual_car_insurance,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .single()

    // 如果没有profile记录，创建一个默认的
    if (profileError && profileError.code === 'PGRST116') {
      console.log('[test-settings] 创建默认用户资料')
      const { data: newProfile, error: createError } = await supabase
        .from('user_profile')
        .insert([{ 
          user_id: userId,
          display_name: user.name || 'User',
          monthly_income: 0,
          a_pct: 70,
          travel_budget_annual: 0,
          annual_medical_insurance: 0,
          annual_car_insurance: 0
        }])
        .select()
        .single()
      
      if (createError) {
        console.error('[test-settings] 创建用户资料失败:', createError)
        return res.status(500).json({ ok: false, error: '创建用户资料失败' })
      }
      
      console.log('[test-settings] 用户资料创建成功')
      return res.status(200).json({
        ok: true,
        data: {
          user: user,
          profile: newProfile
        }
      })
    } else if (profileError) {
      console.error('[test-settings] 获取用户资料失败:', profileError)
      return res.status(500).json({ ok: false, error: '获取用户资料失败' })
    }

    console.log(`[test-settings] 用户数据获取成功: ${user.name}`)

    return res.status(200).json({
      ok: true,
      data: {
        user: user,
        profile: profile
      }
    })

  } catch (error) {
    console.error('[test-settings] 获取用户数据失败:', error)
    return res.status(500).json({
      ok: false,
      error: '获取用户数据失败'
    })
  }
}

// 更新字段值 - 抄袭Telegram的更新逻辑
async function updateField(res, userId, tableName, fieldName, value) {
  console.log(`[test-settings] 更新字段: 表=${tableName}, 字段=${fieldName}, 值=${value}`)

  try {
    // 验证表名和字段名（安全检查）
    const allowedTables = ['users', 'user_profile']
    const allowedFields = {
      'users': ['branch_code'],
      'user_profile': [
        'display_name',
        'phone_e164', 
        'email',
        'monthly_income',
        'a_pct',
        'travel_budget_annual',
        'annual_medical_insurance',
        'annual_car_insurance'
      ]
    }

    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ ok: false, error: '不支持的表名' })
    }

    if (!allowedFields[tableName].includes(fieldName)) {
      return res.status(400).json({ ok: false, error: '不支持的字段名' })
    }

    // 构建更新条件
    const updateData = { [fieldName]: value }
    const whereCondition = tableName === 'users' ? { id: userId } : { user_id: userId }

    console.log(`[test-settings] 执行更新:`, { tableName, updateData, whereCondition })

    // 执行更新
    const { data, error, count } = await supabase
      .from(tableName)
      .update(updateData)
      .match(whereCondition)
      .select()

    if (error) {
      console.error(`[test-settings] 更新失败:`, error)
      return res.status(500).json({ 
        ok: false, 
        error: `更新失败: ${error.message}` 
      })
    }

    console.log(`[test-settings] 更新成功: ${fieldName} = ${value}, 影响行数: ${count}`)

    return res.status(200).json({
      ok: true,
      message: '更新成功',
      data: {
        tableName,
        fieldName,
        value,
        affectedRows: count,
        result: data
      }
    })

  } catch (error) {
    console.error('[test-settings] 更新字段失败:', error)
    return res.status(500).json({
      ok: false,
      error: `更新字段失败: ${error.message}`
    })
  }
}

// 测试数据库连接
async function testDatabaseConnection(res) {
  console.log('[test-settings] 测试数据库连接')
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1)
    
    if (error) {
      console.error('[test-settings] 数据库连接失败:', error)
      return res.status(500).json({
        ok: false,
        error: '数据库连接失败',
        details: error
      })
    }
    
    return res.status(200).json({
      ok: true,
      message: '数据库连接正常',
      data: data
    })
    
  } catch (error) {
    console.error('[test-settings] 数据库测试异常:', error)
    return res.status(500).json({
      ok: false,
      error: '数据库测试异常',
      details: error.message
    })
  }
}