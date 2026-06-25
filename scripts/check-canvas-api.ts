import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const canvasId = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'

async function main() {
  const res  = await fetch(`http://localhost:3000/api/canvas/${canvasId}`)
  const json = await res.json() as { nodes?: Array<{ id: string; type: string; generation_status: string; canvas_node_outputs?: unknown[] }> }

  const personagem = json.nodes?.find(n => n.type === 'personagem')
  console.log('generation_status:', personagem?.generation_status)
  console.log('outputs count    :', personagem?.canvas_node_outputs?.length ?? 0)
  console.log('outputs          :', JSON.stringify(personagem?.canvas_node_outputs, null, 2))
}

main().catch(console.error)
