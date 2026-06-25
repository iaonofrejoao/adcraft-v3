/**
 * Extrai narrações do video_prompt e salva no campo narration das cenas.
 * Uso: npx tsx scripts/fix-storyboard-narrations.ts --node-id <uuid> [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { parseArgs } from 'node:util'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const { values } = parseArgs({
  options: {
    'node-id': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: false,
})

const NODE_ID = values['node-id'] as string | undefined
const DRY_RUN = values['dry-run'] as boolean

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function extractNarration(prompt: string): string {
  const m = prompt.match(/Speaking[^:]*:\s*"([\s\S]+?)"(?:\s|$)/)
  return m?.[1]?.trim() ?? ''
}

interface Scene {
  scene_number:   number
  section:        string
  character_name: string
  narration:      string
  video_prompt:   string
  [key: string]: unknown
}

async function fixNode(nodeId: string) {
  const { data: node } = await supabase
    .from('canvas_nodes').select('id, config').eq('id', nodeId).maybeSingle()

  if (!node) { console.log(`Nó ${nodeId} não encontrado`); return }

  const cfg    = node.config as { scenes?: Scene[] }
  const scenes = cfg?.scenes ?? []
  console.log(`\nStoryboard ${nodeId}: ${scenes.length} cenas`)

  let changed = false
  const updated = scenes.map((scene) => {
    if (scene.narration) {
      console.log(`  #${scene.scene_number} [${scene.character_name}] — já preenchida: "${scene.narration.slice(0, 50)}…"`)
      return scene
    }

    const extracted = extractNarration(scene.video_prompt ?? '')
    if (!extracted) {
      console.log(`  #${scene.scene_number} [${scene.character_name}] — Speaking não encontrado no video_prompt`)
      return scene
    }

    changed = true
    console.log(`  #${scene.scene_number} [${scene.character_name}] ✓ "${extracted.slice(0, 60)}…"`)
    return { ...scene, narration: extracted }
  })

  if (!changed) { console.log('\nNenhuma cena precisou de atualização.'); return }

  if (DRY_RUN) { console.log('\n[DRY RUN] Nenhuma alteração feita.'); return }

  const { error } = await supabase
    .from('canvas_nodes')
    .update({ config: { ...cfg, scenes: updated } })
    .eq('id', nodeId)

  if (error) { console.error('Erro:', error.message) }
  else        { console.log('\n✓ Narrações salvas no banco.') }
}

async function main() {
  if (NODE_ID) {
    await fixNode(NODE_ID)
    return
  }

  // Sem --node-id: percorre todos os storyboards
  const { data: nodes } = await supabase
    .from('canvas_nodes').select('id').eq('type', 'storyboard')

  console.log(`Storyboard nodes encontrados: ${nodes?.length ?? 0}`)
  for (const n of nodes ?? []) await fixNode(n.id)
}

main().catch(console.error)
