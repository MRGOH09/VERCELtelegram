import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action } = req.body

    switch (action) {
      case 'get_stats':
        return await getBranchStats(res)
      
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }

  } catch (error) {
    console.error('[branch-stats] 错误:', error)
    return res.status(500).json({
      error: error.message || '操作失败'
    })
  }
}

async function getBranchStats(res) {
  console.log('[branch-stats] 获取分院统计数据')

  try {
    // 获取所有用户的分院统计
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('branch_code')
      .not('branch_code', 'is', null)

    if (usersError) {
      console.error('获取用户分院数据失败:', usersError)
      return res.status(500).json({ error: '获取数据失败' })
    }

    // 统计各分院人数
    const branchCounts = {}
    users.forEach(user => {
      const branch = user.branch_code || '未分配'
      branchCounts[branch] = (branchCounts[branch] || 0) + 1
    })

    // 转换为数组格式并排序
    const stats = Object.entries(branchCounts)
      .map(([branch_code, count]) => ({
        branch_code,
        count
      }))
      .sort((a, b) => b.count - a.count)

    console.log(`[branch-stats] 返回 ${stats.length} 个分院统计`, stats)

    return res.status(200).json({
      ok: true,
      stats: stats,
      total: users.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[branch-stats] 统计计算失败:', error)
    return res.status(500).json({ 
      error: '统计计算失败',
      details: error.message 
    })
  }
}