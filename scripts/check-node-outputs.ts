import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const nodeId = 'df909972-9e19-4b15-b9f5-f4331b9f829d'

  const { data: node } = await supabase
    .from('canvas_nodes')
    .select('id, generation_status, error_message, canvas_node_outputs(id, output_type, drive_url, is_active, created_at)')
    .eq('id', nodeId)
    .single()

  console.log('generation_status:', node?.generation_status)
  console.log('error_message    :', node?.error_message ?? '(nenhum)')
  const outputs = (node as any)?.canvas_node_outputs ?? []
  console.log('outputs count    :', outputs.length)
  outputs.forEach((o: any, i: number) => {
    console.log(`\nOutput #${i + 1}:`)
    console.log('  id        :', o.id)
    console.log('  is_active :', o.is_active)
    console.log('  drive_url :', o.drive_url)
  })
}

main().catch(console.error)
