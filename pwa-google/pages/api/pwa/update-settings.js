import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 创建或更新月度自动记录
async function createMonthlyAutoRecords(userId, fieldName, value) {
  const today = new Date()
  const ymd = `${today.toISOString().slice(0,7)}-01`
  
  // 根据字段名确定要更新的记录
  let recordConfig = null
  
  if (fieldName === 'travel_budget_annual') {
    recordConfig = {
      group: 'B',
      code: 'travel_auto',
      amount: Math.round((value / 12) * 100) / 100
    }
  } else if (fieldName === 'annual_medical_insurance') {
    recordConfig = {
      group: 'C',
      code: 'ins_med_auto',
      amount: Math.round((value / 12) * 100) / 100
    }
  } else if (fieldName === 'annual_car_insurance') {
    recordConfig = {
      group: 'C',
      code: 'ins_car_auto',
      amount: Math.round((value / 12) * 100) / 100
    }
  }
  
  if (!recordConfig) return
  
  // 检查是否已存在
  const { data: existing } = await supabase
    .from('records')
    .select('id')
    .eq('user_id', userId)
    .eq('ymd', ymd)
    .eq('category_code', recordConfig.code)
    .eq('is_voided', false)
    .maybeSingle()
  
  if (recordConfig.amount > 0) {
    if (!existing) {
      // 创建新记录
      await supabase.from('records').insert([{
        user_id: userId,
        category_group: recordConfig.group,
        category_code: recordConfig.code,
        amount: recordConfig.amount,
        note: 'Auto-generated monthly',
        ymd: ymd
      }])
      
      console.log(`[update-settings] 创建自动记录: ${recordConfig.code} = ${recordConfig.amount}`)
    } else {
      // 更新现有记录
      await supabase
        .from('records')
        .update({ amount: recordConfig.amount })
        .eq('id', existing.id)
      
      console.log(`[update-settings] 更新自动记录: ${recordConfig.code} = ${recordConfig.amount}`)
    }
  } else if (existing) {
    // 如果金额为0且记录存在，删除记录
    await supabase
      .from('records')
      .update({ is_voided: true })
      .eq('id', existing.id)
    
    console.log(`[update-settings] 删除自动记录: ${recordConfig.code}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // 验证JWT token
    const token = req.cookies.pwa_auth_token
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const userId = decoded.userId
    
    const { action, fieldName, value, tableName = 'user_profile' } = req.body
    
    if (action === 'update_field') {
      // 更新用户资料字段
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [fieldName]: value })
        .eq('user_id', userId)
      
      if (updateError) {
        console.error('[update-settings] 更新失败:', updateError)
        return res.status(500).json({ error: '更新失败', details: updateError.message })
      }
      
      // 如果是年度开销相关字段，创建/更新月度记录
      const annualFields = ['travel_budget_annual', 'annual_medical_insurance', 'annual_car_insurance']
      if (annualFields.includes(fieldName)) {
        await createMonthlyAutoRecords(userId, fieldName, value)
      }
      
      return res.json({ 
        ok: true, 
        message: `${fieldName} 已更新`,
        value: value 
      })
    }
    
    return res.status(400).json({ error: 'Invalid action' })
    
  } catch (error) {
    console.error('[update-settings] 错误:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}