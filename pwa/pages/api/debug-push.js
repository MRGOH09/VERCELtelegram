import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  try {
    // 检查环境变量
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NEXT_PUBLIC_FCM_VAPID_KEY: !!process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY
    }

    // 检查数据库连接
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['push_subscriptions', 'push_logs', 'users'])

    // 检查表是否存在
    const tableCheck = {
      push_subscriptions: tables?.some(t => t.table_name === 'push_subscriptions') || false,
      push_logs: tables?.some(t => t.table_name === 'push_logs') || false,
      users: tables?.some(t => t.table_name === 'users') || false
    }

    return res.json({
      environment: envCheck,
      database: {
        connected: !tablesError,
        error: tablesError?.message,
        tables: tableCheck,
        allTables: tables?.map(t => t.table_name)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Debug Push] 错误:', error)
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}