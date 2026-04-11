import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Variáveis públicas expostas pelo Next.js baseadas em variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_anon_key'

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
