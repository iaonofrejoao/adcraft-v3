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
  const canvasId = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'

  const { data: nodes } = await sb
    .from('canvas_nodes')
    .select('id, type, generation_status, canvas_node_outputs(id, drive_url, is_active)')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: true })

  for (const n of nodes ?? []) {
    const outputs = (n as any).canvas_node_outputs ?? []
    console.log(`[${n.type.padEnd(12)}] id=${n.id} | status=${n.generation_status} | outputs=${outputs.length}`)
  }

  // Também verifica o node df909972 que o teste atualizou
  const { data: testNode } = await sb
    .from('canvas_nodes')
    .select('id, canvas_id, type, generation_status, canvas_node_outputs(id, drive_url)')
    .eq('id', 'df909972-9e19-4b15-b9f5-f4331b9f829d')
    .single()

  console.log('\nNó do teste:')
  console.log('  canvas_id:', (testNode as any)?.canvas_id)
  console.log('  type     :', (testNode as any)?.type)
  console.log('  status   :', (testNode as any)?.generation_status)
  console.log('  outputs  :', ((testNode as any)?.canvas_node_outputs ?? []).length)
}

main().catch(console.error)
