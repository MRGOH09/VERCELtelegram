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

    if (action === 'check_schema') {
      console.log('[Schema Check] 开始检查数据库模式')
      
      // 检查users表结构
      const { data: usersSchema, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1)
      
      if (usersError) {
        console.error('Users表查询错误:', usersError)
      }

      // 检查user_profile表结构  
      const { data: profileSchema, error: profileError } = await supabase
        .from('user_profile')
        .select('*')
        .limit(1)
        
      if (profileError) {
        console.error('User_profile表查询错误:', profileError)
      }

      // 尝试检查字段是否存在
      const checkUserFields = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, telegram_id, email, google_id, phone_e164, name, branch_code, status, created_at')
            .limit(1)
          
          return { 
            success: !error, 
            error: error?.message,
            fields: data ? Object.keys(data[0] || {}) : []
          }
        } catch (e) {
          return { success: false, error: e.message }
        }
      }

      const checkProfileFields = async () => {
        try {
          const { data, error } = await supabase
            .from('user_profile') 
            .select('user_id, display_name, phone_e164, email, avatar_url, language')
            .limit(1)
            
          return { 
            success: !error, 
            error: error?.message,
            fields: data ? Object.keys(data[0] || {}) : []
          }
        } catch (e) {
          return { success: false, error: e.message }
        }
      }

      const usersFields = await checkUserFields()
      const profileFields = await checkProfileFields()

      return res.status(200).json({
        users_table: {
          ...usersFields,
          sample_data: usersSchema?.slice(0, 1) || []
        },
        user_profile_table: {
          ...profileFields,
          sample_data: profileSchema?.slice(0, 1) || []
        },
        required_fields: {
          users: ['id', 'email', 'google_id', 'phone_e164', 'name', 'branch_code', 'status'],
          user_profile: ['user_id', 'email', 'avatar_url']
        },
        recommendations: []
      })
    }

    return res.status(400).json({ error: 'Invalid action' })

  } catch (error) {
    console.error('[Schema Check] 错误:', error)
    return res.status(500).json({ 
      error: 'Schema check failed', 
      message: error.message 
    })
  }
}