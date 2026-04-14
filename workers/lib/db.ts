import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as schema from '../../frontend/lib/schema/index';
import * as path from 'path';

// Carrega dot env local da raiz da aplicação (só tem efeito quando rodando como worker)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Drizzle — lazy singleton ──────────────────────────────────────────────────
// Criação adiada para evitar crash durante import pelo webpack do Next.js,
// que não tem DATABASE_URL no contexto de compilação (antes de next.config.mjs
// injetar as vars da raiz no process.env).

let _queryClient: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getQueryClient(): ReturnType<typeof postgres> {
  if (_queryClient) return _queryClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não está definida no ambiente');
  _queryClient = postgres(url, {
    // Garante que o driver não depende do client_encoding padrão do servidor.
    // Necessário em ambientes Windows onde o terminal pode reportar encodings
    // não-UTF8, causando corrupção de caracteres CJK e emoji.
    connection: { client_encoding: 'UTF8' },
  });
  return _queryClient;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;
  _db = drizzle(getQueryClient(), { schema });
  return _db;
}

// Proxy mantém compatibilidade com callers existentes (db.select(...), db.insert(...)).
// O mesmo padrão já usado para `supabase` abaixo.
export const queryClient = new Proxy({} as ReturnType<typeof postgres>, {
  get: (_target, prop) => (getQueryClient() as any)[prop],
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

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
