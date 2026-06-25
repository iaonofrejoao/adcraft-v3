import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const svc1 = process.env.SUPABASE_SERVICE_KEY
const svc2 = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('SUPABASE_SERVICE_KEY      :', svc1 ? `definida (${svc1.slice(0, 25)}...)` : 'AUSENTE')
console.log('SUPABASE_SERVICE_ROLE_KEY :', svc2 ? `definida (${svc2.slice(0, 25)}...)` : 'AUSENTE')
console.log('ANON_KEY (primeiros 25)   :', anon?.slice(0, 25))

// Compara se a service key é diferente da anon key
if (svc1 && anon && svc1.slice(0, 30) === anon.slice(0, 30)) {
  console.log('\n⚠️  ATENÇÃO: SUPABASE_SERVICE_KEY parece ser igual à anon key!')
}
