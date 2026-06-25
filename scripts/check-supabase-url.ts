import * as dotenv from 'dotenv'
import * as path from 'path'

// Carrega APENAS o .env.local do frontend (como a API route do Next.js faz)
const result = dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })
const frontendEnv: Record<string, string> = {}
for (const [k, v] of Object.entries(result.parsed ?? {})) frontendEnv[k] = v

// Carrega APENAS o root .env (para comparação)
const result2 = dotenv.config({ path: path.join(process.cwd(), '.env'), override: false })
const rootEnv: Record<string, string> = {}
for (const [k, v] of Object.entries(result2.parsed ?? {})) rootEnv[k] = v

const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

for (const k of keys) {
  const fe  = frontendEnv[k]?.slice(0, 50) ?? 'AUSENTE'
  const r   = rootEnv[k]?.slice(0, 50) ?? 'AUSENTE'
  const same = frontendEnv[k] === rootEnv[k]
  console.log(`${k}`)
  console.log(`  frontend : ${fe}`)
  console.log(`  root     : ${r}`)
  console.log(`  iguais?  : ${same}\n`)
}
