/**
 * Recria o canvas de uma copy combination com a nova estrutura de storyboard.
 * Uso: npx tsx scripts/recreate-canvas-storyboard.ts --canvas-id <uuid> --combo-id <uuid>
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { parseArgs } from 'node:util'

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const { values } = parseArgs({
  options: {
    'canvas-id': { type: 'string' },
    'combo-id':  { type: 'string' },
    'dry-run':   { type: 'boolean', default: false },
  },
  strict: false,
})

const CANVAS_ID = values['canvas-id'] as string | undefined
const COMBO_ID  = values['combo-id']  as string | undefined
const DRY_RUN   = values['dry-run'] as boolean

if (!CANVAS_ID || !COMBO_ID) {
  console.error('Uso: npx tsx scripts/recreate-canvas-storyboard.ts --canvas-id <uuid> --combo-id <uuid> [--dry-run]')
  process.exit(1)
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CharacterEntry {
  character_id?:    string
  character_name?:  string
  name?:            string
  image_prompt_en?: string
  physical_description?: { age_appearance?: string; gender?: string }
}
interface CharacterArtifact {
  characters?: CharacterEntry[] | Record<string, CharacterEntry>
  primary_character_id?: string
}
interface RawKeyframe {
  scene_number?:    number
  section?:         string
  scene_type?:      string
  character_id?:    string
  character_name?:  string
  narration?:       string
  frame_prompt?:    string
  video_prompt?:    string
  personas_prompt?: string
  veo3_prompt_en?:  string
}

function getCharacterEntry(charData: CharacterArtifact | null, charId: string): CharacterEntry | null {
  if (!charData?.characters) return null
  if (Array.isArray(charData.characters)) {
    return charData.characters.find(c => c.character_id === charId) ?? null
  }
  return (charData.characters as Record<string, CharacterEntry>)[charId] ?? null
}

function resolveCharacterName(charData: CharacterArtifact | null, charId: string): string {
  const char = getCharacterEntry(charData, charId)
  if (char?.character_name) return char.character_name
  if (char?.name) return char.name
  const pd = char?.physical_description
  if (pd?.gender) {
    const g = pd.gender.toLowerCase()
    if (g.includes('woman') || g.includes('female') || g.includes('mulher')) {
      return charId === 'A' ? 'Ana' : 'Clara'
    }
    return charId === 'A' ? 'Carlos' : 'Miguel'
  }
  return charId === 'A' ? 'Personagem A' : 'Personagem B'
}

function extractNarration(prompt?: string): string {
  if (!prompt) return ''
  const match = prompt.match(/Speaking[^:]*:\s*"([^"]+)"/)
  return match?.[1] ?? ''
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Canvas: ${CANVAS_ID}`)
  console.log(`Combo:  ${COMBO_ID}`)
  console.log(`Dry run: ${DRY_RUN}\n`)

  // 1. Dados do canvas/combo
  const { data: canvas } = await supabase
    .from('creative_canvases').select('id, product_id').eq('id', CANVAS_ID).maybeSingle()
  if (!canvas) { console.error('Canvas não encontrado'); process.exit(1) }

  const PRODUCT_ID = canvas.product_id

  // 2. Keyframes (por combo, depois fallback por produto)
  let kfRow: { artifact_data: unknown } | null = null
  const { data: kfByCombo } = await supabase
    .from('product_knowledge').select('artifact_data')
    .eq('copy_combination_id', COMBO_ID)
    .eq('artifact_type', 'keyframes').eq('status', 'fresh')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (kfByCombo?.artifact_data) kfRow = kfByCombo

  if (!kfRow) {
    const { data: kfByProduct } = await supabase
      .from('product_knowledge').select('artifact_data')
      .eq('product_id', PRODUCT_ID)
      .eq('artifact_type', 'keyframes').eq('status', 'fresh')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (kfByProduct?.artifact_data) kfRow = kfByProduct
  }
  if (!kfRow) { console.error('Keyframes não encontrados'); process.exit(1) }

  const kfData = kfRow.artifact_data as { keyframes?: unknown[]; scenes?: unknown[] }
  const rawFrames = (kfData.keyframes ?? kfData.scenes ?? []) as RawKeyframe[]
  console.log(`Cenas encontradas: ${rawFrames.length}`)

  // 3. Artefato character
  const { data: charRow } = await supabase
    .from('product_knowledge').select('artifact_data')
    .eq('product_id', PRODUCT_ID).eq('artifact_type', 'character').eq('status', 'fresh')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const charData = (charRow?.artifact_data ?? null) as CharacterArtifact | null

  // 4. Normalizar cenas
  const scenes = rawFrames.map((kf, idx) => {
    const charId = kf.character_id ?? 'A'
    return {
      scene_number:   kf.scene_number   ?? idx + 1,
      section:        kf.section        ?? 'hook',
      scene_type:     kf.scene_type     ?? 'persona',
      character_id:   charId,
      character_name: kf.character_name ?? resolveCharacterName(charData, charId),
      narration:      kf.narration      ?? extractNarration(kf.video_prompt ?? kf.veo3_prompt_en),
      frame_prompt:   kf.frame_prompt   ?? kf.personas_prompt ?? '',
      video_prompt:   kf.video_prompt   ?? kf.veo3_prompt_en  ?? '',
    }
  })

  console.log('\nCenas normalizadas (preview):')
  scenes.forEach(s => console.log(` #${s.scene_number} [${s.character_name}] ${s.section} | narration: "${s.narration.slice(0, 50)}"`))

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Nenhuma alteração feita.')
    return
  }

  // 5. Apagar nós e edges existentes
  console.log('\nApagando nós e edges existentes...')
  const { data: existingNodes } = await supabase
    .from('canvas_nodes').select('id').eq('canvas_id', CANVAS_ID)
  const existingIds = (existingNodes ?? []).map(n => n.id)

  if (existingIds.length > 0) {
    await supabase.from('canvas_node_outputs').delete().in('node_id', existingIds)
    await supabase.from('canvas_nodes').delete().eq('canvas_id', CANVAS_ID)
  }
  await supabase.from('canvas_edges').delete().eq('canvas_id', CANVAS_ID)
  console.log(`Apagados ${existingIds.length} nós.`)

  // 6. Criar novos nós
  const uniqueCharIds = [...new Set(scenes.map(s => s.character_id))]
  const SCENE_GAP = 300
  const totalH   = scenes.length * SCENE_GAP
  const centerY  = Math.floor(totalH / 2) - 110

  type NodeRow = {
    canvas_id:   string
    type:        string
    label:       string
    position_x:  number
    position_y:  number
    prompt?:     string
    config:      Record<string, unknown>
  }

  const nodes: NodeRow[] = []

  nodes.push({ canvas_id: CANVAS_ID, type: 'storyboard', label: 'Storyboard', position_x: 0, position_y: 0, config: {} })

  uniqueCharIds.forEach((charId, i) => {
    const charEntry = getCharacterEntry(charData, charId)
    nodes.push({
      canvas_id:  CANVAS_ID,
      type:       'personagem',
      label:      resolveCharacterName(charData, charId),
      position_x: 480,
      position_y: Math.max(0, centerY + i * 320),
      prompt:     charEntry?.image_prompt_en ?? '',
      config:     { count: 1, aspect_ratio: '9:16', character_id: charId },
    })
  })

  scenes.forEach((scene, i) => {
    nodes.push({
      canvas_id:  CANVAS_ID,
      type:       'frame',
      label:      `Frame ${i + 1}`,
      position_x: 840,
      position_y: i * SCENE_GAP,
      prompt:     scene.frame_prompt,
      config:     { count: 1, aspect_ratio: '9:16', scene_index: i + 1, character_id: scene.character_id },
    })
  })

  scenes.forEach((scene, i) => {
    nodes.push({
      canvas_id:  CANVAS_ID,
      type:       'video',
      label:      `Vídeo ${i + 1}`,
      position_x: 1160,
      position_y: i * SCENE_GAP,
      prompt:     scene.video_prompt,
      config:     { aspect_ratio: '9:16', scene_index: i + 1 },
    })
  })

  const { data: insertedNodes, error: nodesErr } = await supabase
    .from('canvas_nodes').insert(nodes).select('id, type, label, config')
  if (nodesErr) { console.error('Erro ao inserir nós:', nodesErr.message); process.exit(1) }

  const storyboardNode  = insertedNodes!.find(n => n.type === 'storyboard')
  const personagemNodes = insertedNodes!.filter(n => n.type === 'personagem')
  const frameNodes      = insertedNodes!.filter(n => n.type === 'frame')
    .sort((a, b) => ((a.config as any).scene_index - (b.config as any).scene_index))
  const videoNodes      = insertedNodes!.filter(n => n.type === 'video')
    .sort((a, b) => ((a.config as any).scene_index - (b.config as any).scene_index))

  // 7. Atualizar storyboard config com IDs dos nós filhos
  const storyboardScenes = scenes.map((scene, i) => ({
    ...scene,
    frame_node_id: frameNodes[i]?.id,
    video_node_id: videoNodes[i]?.id,
  }))
  await supabase.from('canvas_nodes').update({ config: { scenes: storyboardScenes } }).eq('id', storyboardNode!.id)

  // 8. Edges
  const edges: Array<{ canvas_id: string; source_node_id: string; target_node_id: string }> = []
  for (const frameNode of frameNodes) {
    const charId = (frameNode.config as any).character_id ?? 'A'
    const personagemNode = personagemNodes.find(n => (n.config as any).character_id === charId)
    if (personagemNode) edges.push({ canvas_id: CANVAS_ID, source_node_id: personagemNode.id, target_node_id: frameNode.id })
  }
  for (let i = 0; i < frameNodes.length && i < videoNodes.length; i++) {
    edges.push({ canvas_id: CANVAS_ID, source_node_id: frameNodes[i].id, target_node_id: videoNodes[i].id })
  }
  if (edges.length > 0) {
    const { error: edgesErr } = await supabase.from('canvas_edges').insert(edges)
    if (edgesErr) { console.error('Erro ao inserir edges:', edgesErr.message); process.exit(1) }
  }

  console.log(`\n✓ Canvas recriado com sucesso:`)
  console.log(` - Storyboard: ${storyboardNode!.id}`)
  console.log(` - Personagens: ${personagemNodes.map(n => n.label).join(', ')}`)
  console.log(` - Frames: ${frameNodes.length}`)
  console.log(` - Vídeos: ${videoNodes.length}`)
  console.log(` - Edges: ${edges.length}`)
  console.log(` - Cenas no storyboard: ${storyboardScenes.length}`)
}

main().catch(console.error)
