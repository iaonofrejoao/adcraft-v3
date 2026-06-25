import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const canvasId = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'

async function main() {
  // Adiciona nocache para evitar cache do Next.js
  const res  = await fetch(`http://localhost:3000/api/canvas/${canvasId}?_t=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  })
  const json = await res.json() as { nodes?: Array<Record<string, unknown>> }

  console.log(`Total nodes: ${json.nodes?.length}`)
  for (const n of json.nodes ?? []) {
    const outputs = (n.canvas_node_outputs as unknown[]) ?? []
    console.log(`  [${String(n.type).padEnd(12)}] id=${n.id} | status=${n.generation_status} | outputs=${outputs.length}`)
  }
}

main().catch(console.error)
