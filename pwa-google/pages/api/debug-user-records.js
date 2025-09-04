// Debug User Records API - 调试用户记录
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { userId } = req.query
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' })
  }

  try {
    // 获取用户基本信息
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    // 获取用户所有记录
    const { data: records } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('ymd', { ascending: false })

    // 获取用户积分记录
    const { data: scores } = await supabase
      .from('user_daily_scores')
      .select('*')
      .eq('user_id', userId)
      .order('ymd', { ascending: false })

    res.status(200).json({
      user,
      records: records || [],
      scores: scores || [],
      recordsCount: records?.length || 0,
      scoresCount: scores?.length || 0,
      analysis: {
        allRecords: records?.map(r => ({
          ymd: r.ymd,
          category_code: r.category_code,
          description: r.description,
          amount: r.amount
        })) || [],
        validRecords: records?.filter(record => {
          // 签到记录是有效的
          if (record.category_code === 'daily_checkin') return true
          
          // 排除自动生成的测试数据
          if (record.description?.includes('自动生成')) return false
          if (record.description?.includes('测试') && record.description?.includes('自动')) return false
          
          // 有金额的记录也是有效的（财务记录）
          if (record.amount && record.amount !== 0) return true
          
          return false
        }).map(r => ({
          ymd: r.ymd,
          category_code: r.category_code,
          description: r.description,
          amount: r.amount
        })) || []
      }
    })

  } catch (error) {
    console.error('[Debug User Records] 错误:', error)
    res.status(500).json({
      error: '查询用户记录失败',
      details: error.message
    })
  }
}