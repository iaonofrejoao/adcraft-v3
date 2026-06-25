import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const canvasId = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'

// Testa com service key (como a API route usa)
const sbService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Testa com anon key (caso a API route esteja usando a chave errada)
const sbAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

async function queryNodes(label: string, client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from('canvas_nodes')
    .select(`
      id, type, generation_status,
      canvas_node_outputs(id, output_type, drive_url, is_active)
    `)
    .eq('canvas_id', canvasId)
    .eq('type', 'personagem')

  if (error) { console.log(`[${label}] ERRO:`, error.message); return }
  const node = data?.[0]
  const outputs = (node as any)?.canvas_node_outputs ?? []
  console.log(`[${label}] outputs.length =`, outputs.length, '| status =', node?.generation_status)
  if (outputs.length > 0) console.log(`  drive_url: ${outputs[0].drive_url}`)
}

async function main() {
  console.log('=== Service key ===')
  await queryNodes('service', sbService)

  console.log('\n=== Anon key ===')
  await queryNodes('anon', sbAnon)
}

main().catch(console.error)
