import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: nodes } = await sb
    .from('canvas_nodes')
    .select('id, type, generation_status, error_message, updated_at, canvas_node_outputs(id)')
    .eq('canvas_id', '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31')
    .eq('type', 'frame')
    .order('updated_at', { ascending: false })

  for (const n of nodes ?? []) {
    const outputs = (n as any).canvas_node_outputs?.length ?? 0
    console.log(`[${n.id}] status=${n.generation_status} | outputs=${outputs} | updated=${n.updated_at}`)
    if (n.error_message) console.log(`  ERRO: ${n.error_message}`)
  }
}

main().catch(console.error)
