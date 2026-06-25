import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NODE_ID = 'dbf0eb8d-10c5-469f-ba1d-914599ba5e07'

async function main() {
  // Reset para idle antes de testar
  await sb.from('canvas_nodes').update({ generation_status: 'idle', error_message: null }).eq('id', NODE_ID)

  console.log('Disparando POST /api/canvas/nodes/' + NODE_ID + '/generate...')
  const res = await fetch(`http://localhost:3000/api/canvas/nodes/${NODE_ID}/generate`, { method: 'POST' })
  console.log('Resposta:', res.status, await res.text())

  // Poll a cada 5s por até 60s
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const { data } = await sb
      .from('canvas_nodes')
      .select('generation_status, error_message')
      .eq('id', NODE_ID)
      .single()
    console.log(`[${(i+1)*5}s] status=${data?.generation_status}${data?.error_message ? ' | ERRO: ' + data.error_message : ''}`)
    if (data?.generation_status === 'done' || data?.generation_status === 'error') break
  }
}

main().catch(console.error)
