// Admin Users API - 安全的用户数据查看
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { search, limit = 10 } = req.query

    if (!search || search.trim().length < 2) {
      return res.status(400).json({ 
        error: '搜索关键词至少需要2个字符' 
      })
    }

    console.log(`[Admin Users] 搜索用户: "${search}"`)

    // 搜索用户（模糊匹配用户名和邮箱）
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        branch_code,
        created_at
      `)
      .or(`username.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(parseInt(limit))

    if (error) {
      throw error
    }

    // 为每个用户获取积分统计
    const usersWithStats = []
    
    for (const user of users || []) {
      // 获取用户积分统计
      const { data: scores } = await supabase
        .from('user_daily_scores')
        .select('total_score, current_streak, ymd')
        .eq('user_id', user.id)
        .order('ymd', { ascending: false })
        .limit(30)

      // 计算统计数据
      const totalScore = scores?.reduce((sum, s) => sum + (s.total_score || 0), 0) || 0
      const maxStreak = Math.max(...(scores?.map(s => s.current_streak || 0) || [0]))
      const recentActivity = scores?.[0]?.ymd || null
      const activeDays = scores?.length || 0

      usersWithStats.push({
        ...user,
        stats: {
          totalScore,
          maxStreak,
          recentActivity,
          activeDays
        }
      })
    }

    console.log(`[Admin Users] 找到 ${usersWithStats.length} 个用户`)

    res.status(200).json({
      users: usersWithStats,
      total: usersWithStats.length,
      searchQuery: search
    })

  } catch (error) {
    console.error('[Admin Users] 错误:', error)
    res.status(500).json({ 
      error: '搜索用户失败',
      details: error.message 
    })
  }
}