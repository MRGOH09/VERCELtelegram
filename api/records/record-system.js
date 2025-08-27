import { todayYMD } from '../../lib/time.js'
import supabase from '../../lib/supabase.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'
import { triggerDailySummaryUpdate } from '../../lib/daily-summary.js'
import { onUserRecord, onUserCheckIn } from '../../lib/scoring-system.js'

export default async function handler(req, res) {
  // 强制无缓存 - 确保数据写入操作不被缓存
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Last-Modified', new Date().toUTCString())
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { action, userId, data, recordId } = req.body
    
    if (!action) {
      return res.status(400).json({ 
        ok: false, 
        error: 'action is required',
        availableActions: ['create', 'update', 'delete', 'list', 'get', 'correct', 'batch-create']
      })
    }

    // 根据动作执行相应的功能
    switch (action) {
      case 'create':
        return await handleCreateRecord(req, res, userId, data)
        
      case 'update':
        return await handleUpdateRecord(req, res, userId, recordId, data)
        
      case 'delete':
        return await handleDeleteRecord(req, res, userId, recordId)
        
      case 'list':
        return await handleListRecords(req, res, userId, data)
        
      case 'get':
        return await handleGetRecord(req, res, userId, recordId)
        
      case 'correct':
        return await handleCorrectRecord(req, res, userId, recordId, data)
        
      case 'batch-create':
        return await handleBatchCreate(req, res, userId, data)
        
      default:
        return res.status(400).json({ 
          ok: false, 
          error: `Unknown action: ${action}`,
          availableActions: ['create', 'update', 'delete', 'list', 'get', 'correct', 'batch-create']
        })
    }
    
  } catch (e) {
    console.error('[record-system] 执行失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 创建记录
async function handleCreateRecord(req, res, userId, data) {
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

    // 验证必要字段
    const { category_group, category_code, amount, ymd } = data
    if (!category_group || !category_code || !amount || !ymd) {
      return res.status(400).json({ 
        ok: false, 
        error: 'category_group, category_code, amount, and ymd are required' 
      })
    }

    const recordData = {
      user_id: userId,
      category_group,
      category_code,
      amount: Number(amount),
      ymd,
      note: data.note || ''
    }

    const { data: record, error } = await supabase
      .from('records')
      .insert([recordData])
      .select()
      .single()

    if (error) {
      console.error('[record-system] 创建记录失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to create record' 
      })
    }

    // 异步更新daily summary（不阻塞响应）
    triggerDailySummaryUpdate(record.user_id, record.ymd)
    
    // 积分系统处理 - 区分打卡和记录
    try {
      let scoreResult = null
      const recordDate = new Date(record.ymd + 'T00:00:00')
      
      // 检查是否是Check In记录（amount=0 且 category='daily_checkin'）
      if (record.amount === 0 && record.category_code === 'daily_checkin') {
        scoreResult = await onUserCheckIn(record.user_id, recordDate)
        console.log(`[积分系统] 用户${record.user_id} 打卡获得${scoreResult.total_score}分`)
      } else {
        scoreResult = await onUserRecord(record.user_id, recordDate)
        console.log(`[积分系统] 用户${record.user_id} 记录获得${scoreResult.total_score}分`)
      }
      
      // 将积分信息附加到响应中
      return res.status(200).json({ 
        ok: true, 
        record,
        score: scoreResult ? {
          total_score: scoreResult.total_score,
          base_score: scoreResult.base_score,
          streak_score: scoreResult.streak_score,
          bonus_score: scoreResult.bonus_score,
          current_streak: scoreResult.current_streak,
          bonus_details: scoreResult.bonus_details
        } : null,
        message: 'Record created successfully'
      })
    } catch (scoreError) {
      console.error('[积分系统] 计算失败，但记录已保存:', scoreError)
      // 即使积分计算失败，记录仍然成功保存
      return res.status(200).json({ 
        ok: true, 
        record,
        score: null,
        message: 'Record created successfully (score calculation failed)'
      })
    }
    
  } catch (e) {
    console.error('[record-system] 创建记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 更新记录
async function handleUpdateRecord(req, res, userId, recordId, data) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!recordId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'recordId is required' 
      })
    }

    if (!data) {
      return res.status(400).json({ 
        ok: false, 
        error: 'data is required' 
      })
    }

    // 验证记录所有权
    const { data: existingRecord, error: checkError } = await supabase
      .from('records')
      .select('id, user_id')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single()

    if (checkError || !existingRecord) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Record not found or access denied' 
      })
    }

    const updateData = {
      ...data
    }

    // 如果更新金额，转换为数字
    if (updateData.amount) {
      updateData.amount = Number(updateData.amount)
    }

    const { data: record, error } = await supabase
      .from('records')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single()

    if (error) {
      console.error('[record-system] 更新记录失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to update record' 
      })
    }

    // 异步更新daily summary（不阻塞响应）
    triggerDailySummaryUpdate(record.user_id, record.ymd)

    return res.status(200).json({ 
      ok: true, 
      record,
      message: 'Record updated successfully'
    })
    
  } catch (e) {
    console.error('[record-system] 更新记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 删除记录
async function handleDeleteRecord(req, res, userId, recordId) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!recordId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'recordId is required' 
      })
    }

    // 验证记录所有权并获取ymd用于daily summary更新
    const { data: existingRecord, error: checkError } = await supabase
      .from('records')
      .select('id, user_id, ymd')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single()

    if (checkError || !existingRecord) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Record not found or access denied' 
      })
    }

    // 软删除：标记为已作废
    const { error } = await supabase
      .from('records')
      .update({ 
        is_voided: true
      })
      .eq('id', recordId)

    if (error) {
      console.error('[record-system] 删除记录失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to delete record' 
      })
    }

    // 异步更新daily summary（不阻塞响应）
    triggerDailySummaryUpdate(userId, existingRecord.ymd)

    return res.status(200).json({ 
      ok: true, 
      message: 'Record deleted successfully'
    })
    
  } catch (e) {
    console.error('[record-system] 删除记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 列出记录
async function handleListRecords(req, res, userId, data) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    const { yyyymm, category_group, limit = 50, offset = 0 } = data || {}
    
    let query = supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_voided', false)
      .order('ymd', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (yyyymm) {
      query = query.gte('ymd', `${yyyymm}-01`).lte('ymd', `${yyyymm}-31`)
    }

    if (category_group) {
      query = query.eq('category_group', category_group)
    }

    const { data: records, error } = await query

    if (error) {
      console.error('[record-system] 获取记录列表失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get records list' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      records,
      count: records.length,
      pagination: { limit, offset }
    })
    
  } catch (e) {
    console.error('[record-system] 获取记录列表失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 获取单个记录
async function handleGetRecord(req, res, userId, recordId) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!recordId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'recordId is required' 
      })
    }

    const { data: record, error } = await supabase
      .from('records')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', userId)
      .eq('is_voided', false)
      .single()

    if (error) {
      console.error('[record-system] 获取记录失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to get record' 
      })
    }

    if (!record) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Record not found' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      record 
    })
    
  } catch (e) {
    console.error('[record-system] 获取记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 修正记录
async function handleCorrectRecord(req, res, userId, recordId, data) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!recordId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'recordId is required' 
      })
    }

    if (!data) {
      return res.status(400).json({ 
        ok: false, 
        error: 'data is required' 
      })
    }

    // 验证记录所有权
    const { data: existingRecord, error: checkError } = await supabase
      .from('records')
      .select('id, user_id, amount, category_group, category_code')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single()

    if (checkError || !existingRecord) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Record not found or access denied' 
      })
    }

    // 创建修正记录
    const correctionData = {
      user_id: userId,
      original_record_id: recordId,
      original_amount: existingRecord.amount,
      original_category_group: existingRecord.category_group,
      original_category_code: existingRecord.category_code,
      corrected_amount: Number(data.amount || existingRecord.amount),
      corrected_category_group: data.category_group || existingRecord.category_group,
      corrected_category_code: data.category_code || existingRecord.category_code,
      correction_reason: data.reason || '',
      corrected_at: new Date().toISOString()
    }

    const { data: correction, error: correctionError } = await supabase
      .from('record_corrections')
      .insert([correctionData])
      .select()
      .single()

    if (correctionError) {
      console.error('[record-system] 创建修正记录失败:', correctionError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to create correction record' 
      })
    }

    // 更新原记录
    const updateData = {
      amount: correctionData.corrected_amount,
      category_group: correctionData.corrected_category_group,
      category_code: correctionData.corrected_category_code
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from('records')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single()

    if (updateError) {
      console.error('[record-system] 更新原记录失败:', updateError)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to update original record' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      correction,
      updatedRecord,
      message: 'Record corrected successfully'
    })
    
  } catch (e) {
    console.error('[record-system] 修正记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
}

// 批量创建记录
async function handleBatchCreate(req, res, userId, data) {
  try {
    if (!userId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'userId is required' 
      })
    }

    if (!data || !Array.isArray(data.records)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'data.records array is required' 
      })
    }

    const records = data.records
    if (records.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Records array cannot be empty' 
      })
    }

    // 验证每条记录
    const validRecords = []
    const errors = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const { category_group, category_code, amount, ymd } = record
      
      if (!category_group || !category_code || !amount || !ymd) {
        errors.push(`Record ${i + 1}: Missing required fields`)
        continue
      }

      validRecords.push({
        user_id: userId,
        category_group,
        category_code,
        amount: Number(amount),
        ymd,
        note: record.note || '',
      })
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Validation failed',
        details: errors
      })
    }

    // 批量插入
    const { data: insertedRecords, error } = await supabase
      .from('records')
      .insert(validRecords)
      .select()

    if (error) {
      console.error('[record-system] 批量创建记录失败:', error)
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to create records' 
      })
    }

    return res.status(200).json({ 
      ok: true, 
      records: insertedRecords,
      count: insertedRecords.length,
      message: `Successfully created ${insertedRecords.length} records`
    })
    
  } catch (e) {
    console.error('[record-system] 批量创建记录失败:', e)
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e) 
    })
  }
} 