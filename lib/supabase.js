import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.SUPABASE_PROJECT_URL

const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('Supabase env not fully configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY)')
}

export const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: { 'x-application-name': 'vercel-telegram-finance-bot' }
  }
})

export default supabase

