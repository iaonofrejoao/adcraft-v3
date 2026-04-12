import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Variáveis públicas expostas pelo Next.js baseadas em variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_anon_key'

// Singleton — evita múltiplas instâncias GoTrueClient em componentes client
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

export function createClient() {
  return supabase
}
