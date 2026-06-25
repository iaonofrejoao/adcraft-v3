import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: nodes } = await supabase
    .from('canvas_nodes')
    .select('id, label, type, prompt, config, canvas_id')
    .eq('type', 'personagem')
    .order('created_at', { ascending: false })
    .limit(5)

  for (const n of nodes ?? []) {
    console.log(`\n── ${n.label} (${n.id.slice(0,8)})`)
    console.log(`   canvas_id: ${n.canvas_id}`)
    console.log(`   prompt: ${(n.prompt ?? '').slice(0, 300)}`)
  }
}

main().catch(console.error)
