/**
 * scripts/video/setup-character-board.ts
 * Gera o character board (Nano Banana) para um produto e salva em persona_assets.
 *
 * O character board é um conjunto de imagens de referência do personagem gerado
 * pelo Nano Banana. É criado UMA VEZ por produto/pipeline e reutilizado em todas
 * as cenas com persona do mesmo vídeo (garante consistência visual sem HeyGen).
 *
 * Uso:
 *   npx tsx scripts/video/setup-character-board.ts \
 *     --product-id <uuid> \
 *     [--pipeline-id <uuid>]   # opcional — vincula ao pipeline ativo
 *     [--dry-run]              # gera e exibe o board mas não salva no banco
 *     [--force]                # regenera mesmo se já existir board válido
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'
import * as fs     from 'node:fs/promises'
import * as os     from 'node:os'
import { parseArgs } from 'node:util'
import { supabase }  from '../../workers/lib/db'
import { generateCharacterBoard } from './nano-banana-client'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

interface CharacterData {
  characters: Array<{
    physical_description: {
      age_appearance: string
      gender:         string
      ethnicity:      string
      hair:           string
      style:          string
    }
    visual_anchors: {
      clothing_color:  string
      primary_setting: string
      lighting:        string
    }
    character_role: string
    image_prompt_en: string
  }>
  primary_character_id?: string
}

// ── Banco de dados ────────────────────────────────────────────────────────────

async function getOrCreatePersonaAsset(productId: string, pipelineId?: string) {
  const { data, error } = await supabase
    .from('persona_assets')
    .select('id, status, nano_banana_character_board')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (data) return data

  const { data: created, error: createErr } = await supabase
    .from('persona_assets')
    .insert({ product_id: productId, pipeline_id: pipelineId ?? null, status: 'creating' })
    .select('id, status, nano_banana_character_board')
    .single()

  if (createErr) throw createErr
  return created!
}

async function getCharacterArtifact(productId: string, pipelineId?: string): Promise<CharacterData> {
  let query = supabase
    .from('product_knowledge')
    .select('data')
    .eq('product_id', productId)
    .eq('artifact_type', 'character')
    .order('created_at', { ascending: false })
    .limit(1)

  if (pipelineId) query = query.eq('pipeline_id', pipelineId)

  const { data, error } = await query.single()
  if (error || !data) throw new Error(`Artefato 'character' não encontrado para product_id=${productId}`)
  return data.data as CharacterData
}

async function saveCharacterBoard(
  personaAssetId: string,
  boardUrls: string[],
): Promise<void> {
  const { error } = await supabase
    .from('persona_assets')
    .update({
      nano_banana_character_board: { image_urls: boardUrls, generated_at: new Date().toISOString() },
      status: 'ready',
      completed_at: new Date().toISOString(),
    })
    .eq('id', personaAssetId)

  if (error) throw error
}

async function markFailed(personaAssetId: string, message: string): Promise<void> {
  await supabase
    .from('persona_assets')
    .update({ status: 'failed', error_message: message })
    .eq('id', personaAssetId)
}

// ── Upload das imagens do board para Supabase Storage ────────────────────────

async function uploadBoardImages(
  productId: string,
  images: Buffer[],
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < images.length; i++) {
    const filename = `character-board/${productId}/board-${i + 1}.png`
    const { error } = await supabase.storage
      .from('video-clips')
      .upload(filename, images[i], { contentType: 'image/png', upsert: true })

    if (error) throw new Error(`Erro ao fazer upload da imagem ${i + 1} do board: ${error.message}`)

    const { data: urlData } = supabase.storage.from('video-clips').getPublicUrl(filename)
    urls.push(urlData.publicUrl)
  }

  return urls
}

// ── Construir personas_prompt a partir do artefato character ──────────────────

function buildPersonasPrompt(character: CharacterData): string {
  const primary = character.characters.find(
    c => c.character_role === 'testimonial' || c.character_role === 'narrator',
  ) ?? character.characters[0]

  if (!primary) throw new Error('Nenhum personagem encontrado no artefato character')

  // Se já existe um image_prompt_en bem formado, preferi-lo
  if (primary.image_prompt_en && primary.image_prompt_en.length >= 30) {
    return primary.image_prompt_en
  }

  const { physical_description: pd, visual_anchors: va } = primary
  return [
    pd.age_appearance, pd.gender,
    pd.ethnicity,
    pd.hair,
    `wearing ${va.clothing_color} clothing`,
    va.primary_setting,
    va.lighting,
    'photorealistic, UGC style, authentic, no filters',
  ].filter(Boolean).join(', ')
}

// ── Fluxo principal ───────────────────────────────────────────────────────────

async function run(args: {
  productId: string
  pipelineId?: string
  dryRun?: boolean
  force?: boolean
}) {
  const { productId, pipelineId, dryRun, force } = args

  console.log(`\n=== Setup Character Board — produto ${productId} ===\n`)

  // 1. Verificar/criar persona_asset
  const asset = await getOrCreatePersonaAsset(productId, pipelineId)
  console.log(`persona_asset: ${asset.id} (status: ${asset.status})`)

  if (!force && asset.nano_banana_character_board && asset.status === 'ready') {
    console.log('Character board já existe e status=ready. Use --force para regenerar.')
    return asset
  }

  // 2. Carregar artefato character
  const characterData = await getCharacterArtifact(productId, pipelineId)
  const personasPrompt = buildPersonasPrompt(characterData)
  console.log(`\nPersonas prompt:\n  "${personasPrompt}"\n`)

  // 3. Gerar character board via Nano Banana
  console.log('Gerando character board via Nano Banana...')
  const boardImages = await generateCharacterBoard(personasPrompt)
  console.log(`Character board gerado: ${boardImages.length} imagens`)

  if (dryRun) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adcraft-board-'))
    for (let i = 0; i < boardImages.length; i++) {
      const file = path.join(tmpDir, `board-${i + 1}.png`)
      await fs.writeFile(file, boardImages[i])
      console.log(`  [dry-run] Salvo em ${file} (${boardImages[i].byteLength} bytes)`)
    }
    console.log('\n[dry-run] Board gerado mas NÃO salvo no banco.')
    return null
  }

  // 4. Upload para Supabase Storage
  console.log('Fazendo upload das imagens para Supabase Storage...')
  const boardUrls = await uploadBoardImages(productId, boardImages)
  console.log(`Upload concluído: ${boardUrls.length} URLs`)

  // 5. Salvar no banco
  await saveCharacterBoard(asset.id, boardUrls)
  console.log(`\npersona_asset ${asset.id} atualizado — status: ready`)
  console.log(`Character board URLs:\n${boardUrls.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}`)

  return { ...asset, nano_banana_character_board: { image_urls: boardUrls } }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id':  { type: 'string' },
      'pipeline-id': { type: 'string' },
      'dry-run':     { type: 'boolean' },
      'force':       { type: 'boolean' },
    },
  })

  const productId = args['product-id']
  if (!productId) {
    console.error('--product-id é obrigatório')
    process.exit(1)
  }

  run({
    productId,
    pipelineId: args['pipeline-id'],
    dryRun:    args['dry-run'],
    force:     args['force'],
  }).catch(async e => {
    console.error('Erro:', e.message)
    // Tentar marcar como failed se temos um asset (best-effort)
    try {
      const asset = await getOrCreatePersonaAsset(productId)
      if (asset?.id) await markFailed(asset.id, e.message)
    } catch {}
    process.exit(1)
  })
}
