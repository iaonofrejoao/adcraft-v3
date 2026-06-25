import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const canvasId = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'

async function main() {
  const res  = await fetch(`http://localhost:3000/api/canvas/${canvasId}`)
  const json = await res.json() as { nodes?: Array<Record<string, unknown>> }

  for (const n of json.nodes ?? []) {
    const outputs = (n.canvas_node_outputs as unknown[]) ?? []
    if (n.type === 'personagem' || outputs.length > 0) {
      console.log(JSON.stringify({ id: n.id, type: n.type, generation_status: n.generation_status, outputs_count: outputs.length }, null, 2))
    }
  }

  // também mostra contagem total de nodes por tipo
  const counts: Record<string, number> = {}
  for (const n of json.nodes ?? []) {
    counts[n.type as string] = (counts[n.type as string] ?? 0) + 1
  }
  console.log('\nNodes por tipo:', JSON.stringify(counts))
}

main().catch(console.error)
