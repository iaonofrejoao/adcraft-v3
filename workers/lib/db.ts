import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as schema from '../../frontend/lib/schema/index';
import * as path from 'path';

// Carrega dot env local da raiz da aplicação (só tem efeito quando rodando como worker)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const queryClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(queryClient, { schema });

// ── Supabase — lazy singleton ─────────────────────────────────────────────────
// Criação adiada para evitar crash durante import pelo webpack do Next.js,
// que não tem SUPABASE_SERVICE_ROLE_KEY no contexto de compilação.

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) devem estar definidos no ambiente');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

// Proxy mantém compatibilidade com callers existentes (supabase.from(...))
// sem criar o client no top-level.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => (getSupabase() as any)[prop],
});
