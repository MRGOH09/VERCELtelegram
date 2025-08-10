import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('Supabase env not fully configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE')
}

export const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: { 'x-application-name': 'vercel-telegram-finance-bot' }
  }
})

export default supabase

