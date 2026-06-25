import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: node } = await supabase
    .from('canvas_nodes')
    .select('id, config')
    .eq('id', '7eeacce5-b896-4032-be26-208e2dbebad3')
    .maybeSingle()

  const scenes = (node?.config as any)?.scenes ?? []
  console.log(`Cenas: ${scenes.length}`)
  scenes.forEach((s: any) => {
    console.log(`\n#${s.scene_number} narration: "${s.narration ?? '(null/undefined)'}"`)
    console.log(`  video_prompt (60 chars): "${String(s.video_prompt ?? '').slice(0, 60)}"`)
  })
}

main().catch(console.error)
