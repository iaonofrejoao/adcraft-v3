// GET  /api/products/[sku]/canvas — lista canvases do produto
// POST /api/products/[sku]/canvas — cria + inicializa canvas a partir de keyframes

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

interface CharacterEntry {
  character_id?:    string
  character_name?:  string
  name?:            string
  image_prompt_en?: string
  physical_description?: { age_appearance?: string; gender?: string }
}
// characters pode vir como array (formato atual do agente) ou Record legado
interface CharacterArtifact {
  characters?: CharacterEntry[] | Record<string, CharacterEntry>
  primary_character_id?: string
}

function getCharacterEntry(charData: CharacterArtifact | null, charId: string): CharacterEntry | null {
  if (!charData?.characters) return null
  if (Array.isArray(charData.characters)) {
    return charData.characters.find(c => c.character_id === charId) ?? null
  }
  return (charData.characters as Record<string, CharacterEntry>)[charId] ?? null
}

interface RawKeyframe {
  scene_number?:   number
  section?:        string
  scene_type?:     string
  character_id?:   string
  character_name?: string
  narration?:      string
  // Novos campos
  frame_prompt?:   string
  video_prompt?:   string
  // Campos legados (backward compat)
  personas_prompt?: string
  veo3_prompt_en?:  string
}

interface NormalizedScene {
  scene_number:   number
  section:        string
  scene_type:     string
  character_id:   string
  character_name: string
  narration:      string
  frame_prompt:   string
  video_prompt:   string
}

function extractNarration(videoPrompt?: string): string {
  if (!videoPrompt) return ''
  const match = videoPrompt.match(/Speaking[^:]*:\s*"([^"]+)"/)
  return match?.[1] ?? ''
}

function resolveCharacterName(charData: CharacterArtifact | null, charId: string): string {
  const char = getCharacterEntry(charData, charId)
  if (char?.character_name) return char.character_name
  if (char?.name) return char.name
  const pd = char?.physical_description
  if (pd?.gender) {
    const gender = pd.gender.toLowerCase()
    if (gender.includes('woman') || gender.includes('female') || gender.includes('mulher')) {
      return charId === 'A' ? 'Ana' : 'Clara'
    }
    return charId === 'A' ? 'Carlos' : 'Miguel'
  }
  return charId === 'A' ? 'Personagem A' : 'Personagem B'
}

function normalizeScene(kf: RawKeyframe, idx: number, charData: CharacterArtifact | null): NormalizedScene {
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
}

export async function GET(
  _req: Request,
  { params }: { params: { sku: string } },
) {
  const { sku } = params
  const supabase = getServiceClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product)     return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const { data: canvases, error } = await supabase
    .from('creative_canvases')
    .select('id, copy_combination_id, created_at')
    .eq('product_id', product.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ canvases: canvases ?? [] })
}

export async function POST(
  req: Request,
  { params }: { params: { sku: string } },
) {
  const { sku } = params
  const supabase = getServiceClient()

  const body = await req.json() as { copy_combination_id: string }
  const { copy_combination_id } = body
  if (!copy_combination_id) {
    return NextResponse.json({ error: 'copy_combination_id obrigatório' }, { status: 400 })
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, sku')
    .eq('sku', sku)
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product)     return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  // Buscar keyframes — primeiro pela combinação específica, depois fallback pelo produto
  let kfRow: { artifact_data: unknown } | null = null

  const { data: kfByCombo } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('copy_combination_id', copy_combination_id)
    .eq('artifact_type', 'keyframes')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (kfByCombo?.artifact_data) {
    kfRow = kfByCombo
  } else {
    const { data: kfByProduct } = await supabase
      .from('product_knowledge')
      .select('artifact_data')
      .eq('product_id', product.id)
      .eq('artifact_type', 'keyframes')
      .eq('status', 'fresh')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (kfByProduct?.artifact_data) kfRow = kfByProduct
  }

  if (!kfRow?.artifact_data) {
    return NextResponse.json({ status: 'no_storyboard' })
  }

  const kfData     = kfRow.artifact_data as { keyframes?: unknown[]; scenes?: unknown[] }
  const rawFrames  = (kfData.keyframes ?? kfData.scenes ?? []) as RawKeyframe[]

  // Buscar artefato character (para nomes dos personagens)
  const { data: charRow } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', product.id)
    .eq('artifact_type', 'character')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const charData = (charRow?.artifact_data ?? null) as CharacterArtifact | null

  // Normalizar cenas
  const scenes = rawFrames.map((kf, idx) => normalizeScene(kf, idx, charData))

  // Criar canvas
  const { data: canvas, error: canvasError } = await supabase
    .from('creative_canvases')
    .insert({ product_id: product.id, copy_combination_id })
    .select('id')
    .single()

  if (canvasError) {
    if (canvasError.code === '23505') {
      const { data: existing } = await supabase
        .from('creative_canvases')
        .select('id')
        .eq('copy_combination_id', copy_combination_id)
        .single()
      return NextResponse.json({ canvas_id: existing?.id, status: 'existing' })
    }
    return NextResponse.json({ error: canvasError.message }, { status: 500 })
  }

  const canvasId   = canvas.id
  const sceneCount = scenes.length

  // Personagens únicos
  const uniqueCharIds = [...new Set(scenes.map(s => s.character_id))]

  // Layout vertical — mesma lógica de computeVerticalLayout no CanvasBoard
  const SCENE_GAP_X = 360
  const ROW_GAP_Y   = 380
  const totalW      = Math.max(sceneCount - 1, 0) * SCENE_GAP_X
  const centerX     = totalW / 2

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

  // Storyboard — topo, centralizado
  nodes.push({
    canvas_id:  canvasId,
    type:       'storyboard',
    label:      'Storyboard',
    position_x: Math.round(centerX - 160),
    position_y: 0,
    config:     {},
  })

  // Personagem — linha 1 (ROW_GAP_Y), centralizado
  uniqueCharIds.forEach((charId, i) => {
    const charEntry = getCharacterEntry(charData, charId)
    const spread    = (uniqueCharIds.length - 1) * 320
    nodes.push({
      canvas_id:  canvasId,
      type:       'personagem',
      label:      resolveCharacterName(charData, charId),
      position_x: Math.round(centerX - spread / 2 + i * 320),
      position_y: ROW_GAP_Y,
      prompt:     charEntry?.image_prompt_en ?? '',
      config:     { count: 1, aspect_ratio: '9:16', character_id: charId },
    })
  })

  // Frame N — linha 2
  for (let i = 0; i < sceneCount; i++) {
    nodes.push({
      canvas_id:  canvasId,
      type:       'frame',
      label:      `Frame ${i + 1}`,
      position_x: i * SCENE_GAP_X,
      position_y: 2 * ROW_GAP_Y,
      prompt:     scenes[i].frame_prompt,
      config:     { count: 1, aspect_ratio: '9:16', scene_index: i + 1, character_id: scenes[i].character_id },
    })
  }

  // Vídeo N — linha 3
  for (let i = 0; i < sceneCount; i++) {
    nodes.push({
      canvas_id:  canvasId,
      type:       'video',
      label:      `Vídeo ${i + 1}`,
      position_x: i * SCENE_GAP_X,
      position_y: 3 * ROW_GAP_Y,
      prompt:     scenes[i].video_prompt,
      config:     { aspect_ratio: '9:16', scene_index: i + 1 },
    })
  }

  const { data: insertedNodes, error: nodesError } = await supabase
    .from('canvas_nodes')
    .insert(nodes)
    .select('id, type, label, config')

  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 })

  // Indexar nós
  const storyboardNode   = insertedNodes.find(n => n.type === 'storyboard')
  const personagemNodes  = insertedNodes.filter(n => n.type === 'personagem')
  const frameNodes       = insertedNodes
    .filter(n => n.type === 'frame')
    .sort((a, b) => ((a.config as { scene_index?: number }).scene_index ?? 0) - ((b.config as { scene_index?: number }).scene_index ?? 0))
  const videoNodes       = insertedNodes
    .filter(n => n.type === 'video')
    .sort((a, b) => ((a.config as { scene_index?: number }).scene_index ?? 0) - ((b.config as { scene_index?: number }).scene_index ?? 0))

  // Atualizar storyboard com scene data + IDs dos nós filhos
  if (storyboardNode) {
    const storyboardScenes = scenes.map((scene, i) => ({
      ...scene,
      frame_node_id: frameNodes[i]?.id,
      video_node_id: videoNodes[i]?.id,
    }))
    await supabase
      .from('canvas_nodes')
      .update({ config: { scenes: storyboardScenes } })
      .eq('id', storyboardNode.id)
  }

  // Edges
  const edges: Array<{ canvas_id: string; source_node_id: string; target_node_id: string }> = []

  // Personagem → Frame (por character_id)
  for (const frameNode of frameNodes) {
    const charId = (frameNode.config as { character_id?: string }).character_id ?? 'A'
    const personagemNode = personagemNodes.find(
      n => (n.config as { character_id?: string }).character_id === charId,
    )
    if (personagemNode) {
      edges.push({ canvas_id: canvasId, source_node_id: personagemNode.id, target_node_id: frameNode.id })
    }
  }

  // Frame → Vídeo
  for (let i = 0; i < frameNodes.length && i < videoNodes.length; i++) {
    edges.push({ canvas_id: canvasId, source_node_id: frameNodes[i].id, target_node_id: videoNodes[i].id })
  }

  if (edges.length > 0) {
    const { error: edgesError } = await supabase.from('canvas_edges').insert(edges)
    if (edgesError) return NextResponse.json({ error: edgesError.message }, { status: 500 })
  }

  return NextResponse.json({ canvas_id: canvasId, status: 'created' }, { status: 201 })
}
