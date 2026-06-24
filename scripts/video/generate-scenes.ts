/**
 * scripts/video/generate-scenes.ts
 * Gera clips individuais por cena usando Nano Banana + Veo 3.
 *
 * Fluxo por cena:
 *   scene_type='persona' → Nano Banana (character board reutilizado) → primeiro frame → Veo 3 image-to-video
 *   scene_type='scene'   → Veo 3 text-to-video direto
 *
 * Se não existir character board para o produto, cria automaticamente antes de gerar.
 * Clips salvos em {VIDEO_OUTPUT_DIR}/videos/{storyboard_tag}/ com nomenclatura padronizada.
 *
 * Uso:
 *   npx tsx scripts/video/generate-scenes.ts \
 *     --final-video-id <uuid> \
 *     [--dry-run]       # exibe plano de execução sem chamar as APIs
 *     [--scene <n>]     # regenera apenas a cena N
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY
 *   VIDEO_OUTPUT_DIR  (padrão: C:\Videos\AdCraft)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'
import { parseArgs } from 'node:util'
import { supabase }  from '../../workers/lib/db'
import { generateCharacterBoard, getNanoBananaSessionUsage } from './nano-banana-client'
import { textToVideo, imageToVideo, getVeo3SessionUsage } from './veo3-client'
import { saveClip, buildFilename, ensureFolder, loadBoardImages, getOutputDir, savePersonaImage } from './local-storage'
import { saveVideoClipToDrive } from './google-drive'
import { run as setupCharacterBoard } from './setup-character-board'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

type SceneType = 'persona' | 'scene'

interface PersonaDef {
  label?:  string
  prompt:  string
}

interface VideoScene {
  scene_number:    number
  section:         string
  scene_type?:     SceneType        // obrigatório em novos artefatos; inferido em legados
  persona_id?:     string           // qual persona aparece; undefined = fluxo legado
  duration_seconds: number
  personas_prompt: string | null
  veo3_prompt_en:  string
  overlay_suggestion: string | null
  drive_filename:  string           // nome do arquivo (convenção de nomenclatura)
}

interface VideoAssets {
  storyboard_tag:            string
  combination_used:          string
  aspect_ratio:              '9:16' | '1:1' | '16:9'
  drive_folder_name:         string
  canonical_personas_prompt: string | null
  personas?:                 Record<string, PersonaDef>  // mapa de personas do storyboard
  scenes:                    VideoScene[]
  production_warnings:       string[]
}

interface PersonaBoard {
  image_url:    string
  prompt?:      string
  generated_at: string
}

interface PersonaAsset {
  id:                           string
  nano_banana_character_board:  { image_urls: string[] } | null  // fluxo legado
  character_boards_by_persona?: Record<string, PersonaBoard>     // novo: por persona_id
  status:                       string
}

interface SceneResult {
  scene_number:  number
  section:       string
  local_path:    string
  drive_filename: string
  drive_url?:    string
  status:        'ok' | 'failed'
  error?:        string
}

// ── Limite Veo 3: 8 segundos fixos por clip ───────────────────────────────────

const MAX_NARRATION_WORDS = 20  // 8s × 2,5 palavras/s — máximo por clip Veo 3

/**
 * Divide a narração em chunks respeitando limites naturais de fala:
 * prioridade 1 → fim de frase (.!?), prioridade 2 → pausa de cláusula (;,),
 * último recurso → corte forçado em maxWords (nunca no meio de uma frase se houver pausa disponível).
 */
function splitAtSpeechBoundaries(narration: string, maxWords: number): string[] {
  const words = narration.trim().split(/\s+/)
  if (words.length <= maxWords) return [narration]

  const chunks: string[] = []
  let start = 0
  const minWords = Math.max(4, Math.floor(maxWords * 0.4))

  while (start < words.length) {
    const remaining = words.slice(start)
    if (remaining.length <= maxWords) {
      chunks.push(remaining.join(' '))
      break
    }

    let splitAt = -1
    const searchEnd = Math.min(maxWords - 1, remaining.length - 1)

    // Prioridade 1: fim de frase (.!?)
    for (let i = searchEnd; i >= minWords - 1; i--) {
      if (/[.!?]$/.test(remaining[i])) { splitAt = i; break }
    }

    // Prioridade 2: pausa de cláusula (;,)
    if (splitAt < 0) {
      for (let i = searchEnd; i >= minWords - 1; i--) {
        if (/[;,]$/.test(remaining[i])) { splitAt = i; break }
      }
    }

    // Último recurso: corte forçado no limite de palavras
    if (splitAt < 0) splitAt = searchEnd

    chunks.push(remaining.slice(0, splitAt + 1).join(' '))
    start += splitAt + 1
  }

  return chunks.filter(c => c.trim().length > 0)
}

/**
 * Expande cenas cuja narração excede MAX_NARRATION_WORDS em múltiplas sub-cenas.
 * Cada sub-cena recebe scene_number = original + idx×0.1 (ex: 4 → 4, 4.1, 4.2).
 * A quebra SEMPRE ocorre em limites naturais de fala (fim de frase ou pausa de cláusula),
 * nunca no meio de uma sentença, garantindo que cada clip começa e termina uma fala completa.
 * Aplicado após o filtro --scene para que --scene 4 gere TODOS os clips da cena 4.
 */
function expandScenes(
  scenes: (VideoScene & { _resolvedType: SceneType })[],
): (VideoScene & { _resolvedType: SceneType })[] {
  const result: (VideoScene & { _resolvedType: SceneType })[] = []

  for (const scene of scenes) {
    const m = scene.veo3_prompt_en.match(/^([\s\S]+?)\s+(Speaking in [^:]+: ")([\s\S]+?)(")$/)
    if (!m) {
      result.push(scene)
      continue
    }

    const [, visualBase, speakPrefix, narration] = m
    const words = narration.trim().split(/\s+/)

    if (words.length <= MAX_NARRATION_WORDS) {
      result.push(scene)
      continue
    }

    const narrationChunks = splitAtSpeechBoundaries(narration, MAX_NARRATION_WORDS)

    console.warn(
      `  [⚠ split] Cena ${scene.scene_number} [${scene.section}]: ` +
      `${words.length} palavras → ${narrationChunks.length} clips (por limite de fala)`,
    )

    for (let idx = 0; idx < narrationChunks.length; idx++) {
      const chunk = narrationChunks[idx]
      const continuationNote = idx > 0 ? ', continuing naturally from previous shot' : ''
      const newPrompt = `${visualBase}${continuationNote} ${speakPrefix}${chunk}"`
      result.push({
        ...scene,
        scene_number:     parseFloat((scene.scene_number + idx * 0.1).toFixed(1)),
        veo3_prompt_en:   newPrompt,
        duration_seconds: 8,
      })
    }
  }

  return result
}

// ── Inferência de scene_type para artefatos legados ───────────────────────────

/**
 * Se scene_type não veio no artefato, infere pelo prompt:
 * Compara o início do veo3_prompt_en com o canonical_personas_prompt —
 * se o prompt começa com a descrição da persona, é cena de persona.
 */
function inferSceneType(scene: VideoScene, canonicalPersonasPrompt: string | null): SceneType {
  if (scene.scene_type) return scene.scene_type
  if (!canonicalPersonasPrompt) return 'scene'

  // Pegar os primeiros 80 chars do prompt canônico como assinatura
  const signature = canonicalPersonasPrompt.slice(0, 80).toLowerCase()
  const promptStart = scene.veo3_prompt_en.slice(0, 100).toLowerCase()

  return promptStart.includes(signature.slice(0, 40)) ? 'persona' : 'scene'
}

// ── Banco de dados ────────────────────────────────────────────────────────────

async function getFinalVideo(finalVideoId: string) {
  const { data, error } = await supabase
    .from('final_videos')
    .select('id, product_id, pipeline_id, copy_combination_id, status, composition_config')
    .eq('id', finalVideoId)
    .single()
  if (error || !data) throw new Error(`final_video não encontrado: ${finalVideoId}`)
  return data
}

async function getVideoAssets(productId: string, pipelineId?: string | null, combinationId?: string | null): Promise<VideoAssets> {
  let query = supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', productId)
    .eq('artifact_type', 'video_assets')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)

  if (combinationId) query = query.eq('copy_combination_id', combinationId)
  else if (pipelineId) query = query.eq('source_pipeline_id', pipelineId)

  const { data, error } = await query.single()
  if (error || !data) throw new Error(`Artefato 'video_assets' não encontrado`)
  return data.artifact_data as VideoAssets
}

async function getPersonaAsset(productId: string): Promise<PersonaAsset | null> {
  const { data } = await supabase
    .from('persona_assets')
    .select('id, nano_banana_character_board, character_boards_by_persona, status')
    .eq('product_id', productId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

async function getProductSku(productId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .select('sku')
    .eq('id', productId)
    .single()
  if (error || !data) throw new Error(`Produto não encontrado: ${productId}`)
  return (data as any).sku as string
}

async function updateFinalVideoStatus(
  finalVideoId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from('final_videos')
    .update({ status, progress_step: status, ...extra })
    .eq('id', finalVideoId)
}

async function saveSceneResults(
  finalVideoId: string,
  results: SceneResult[],
  localFolderPath: string,
): Promise<void> {
  // Busca cenas existentes para fazer merge (suporta --scene N sem apagar outras cenas)
  const { data: current } = await supabase
    .from('final_videos')
    .select('composition_config')
    .eq('id', finalVideoId)
    .single()

  const existing: SceneResult[] = (current?.composition_config as { scenes?: SceneResult[] } | null)?.scenes ?? []
  const newNums = new Set(results.map(r => r.scene_number))
  const merged = [
    ...existing.filter(s => !newNums.has(s.scene_number)),
    ...results,
  ].sort((a, b) => a.scene_number - b.scene_number)

  await supabase
    .from('final_videos')
    .update({
      status:             'ready',
      drive_folder_url:   localFolderPath,
      composition_config: { scenes: merged },
      completed_at:       new Date().toISOString(),
    })
    .eq('id', finalVideoId)
}

// ── Mapa de imagens por persona ───────────────────────────────────────────────

/**
 * Constrói um Map<persona_id, Buffer> com a imagem de referência de cada persona
 * que aparece nas cenas. Gera via Nano Banana somente se ainda não existe no banco.
 *
 * Regras:
 *   - scene.persona_id definido → usa character_boards_by_persona[persona_id]
 *   - scene.persona_id ausente  → usa nano_banana_character_board legado (chave '__legacy__')
 * Cada persona é gerada UMA VEZ e persistida em persona_assets para reuso futuro.
 */
async function buildPersonaImageMap(
  scenes:       (VideoScene & { _resolvedType: SceneType })[],
  videoAssets:  VideoAssets,
  personaAsset: PersonaAsset | null,
  sku:          string,
): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>()

  const personaScenes = scenes.filter(s => s._resolvedType === 'persona')

  // Personas nomeadas (com persona_id)
  const namedIds = [...new Set(
    personaScenes.map(s => s.persona_id).filter((id): id is string => Boolean(id))
  )]

  for (const personaId of namedIds) {
    const existing = personaAsset?.character_boards_by_persona?.[personaId]

    if (existing?.image_url) {
      console.log(`  [persona-map] '${personaId}': carregando imagem existente`)
      const [buf] = await loadBoardImages([existing.image_url])
      map.set(personaId, buf)
      continue
    }

    const def = videoAssets.personas?.[personaId]
    if (!def) throw new Error(`Persona '${personaId}' usada em cena mas não definida em video_assets.personas`)

    console.log(`  [persona-map] '${personaId}': gerando imagem de referência via Nano Banana...`)
    const [buf] = await generateCharacterBoard(def.prompt)

    const imagePath = await savePersonaImage(buf, sku, personaId)
    console.log(`  [persona-map] '${personaId}': salvo em ${imagePath}`)

    if (personaAsset) {
      const boards = { ...(personaAsset.character_boards_by_persona ?? {}) }
      boards[personaId] = { image_url: imagePath, prompt: def.prompt, generated_at: new Date().toISOString() }
      await supabase.from('persona_assets').update({ character_boards_by_persona: boards }).eq('id', personaAsset.id)
      personaAsset.character_boards_by_persona = boards
    }

    map.set(personaId, buf)
  }

  // Fallback legado: cenas sem persona_id usam a chave '__legacy__'
  const hasUntagged = personaScenes.some(s => !s.persona_id)
  if (hasUntagged) {
    const legacyUrls = personaAsset?.nano_banana_character_board?.image_urls
    if (!legacyUrls?.length) throw new Error('Cenas com persona sem persona_id e sem character board legado no persona_asset.')
    const [buf] = await loadBoardImages([legacyUrls[0]])
    map.set('__legacy__', buf)
    console.log(`  [persona-map] '__legacy__': carregado de ${legacyUrls[0]}`)
  }

  return map
}

// ── Geração de cena ───────────────────────────────────────────────────────────

async function generatePersonaScene(
  scene:           VideoScene,
  personaImageMap: Map<string, Buffer>,
  aspectRatio:     '9:16' | '1:1' | '16:9',
): Promise<Buffer> {
  const personaId  = scene.persona_id ?? '__legacy__'
  const firstFrame = personaImageMap.get(personaId)
  if (!firstFrame) throw new Error(`Imagem de referência não encontrada para persona '${personaId}'`)

  console.log(`  [persona:'${personaId}'] Usando imagem de referência (${(firstFrame.byteLength / 1024).toFixed(1)} KB)`)
  console.log(`  [persona:'${personaId}'] Gerando vídeo via Veo 3 image-to-video...`)
  return imageToVideo(firstFrame, scene.veo3_prompt_en, scene.duration_seconds, aspectRatio)
}

async function generateSceneClip(
  scene:       VideoScene,
  aspectRatio: '9:16' | '1:1' | '16:9',
): Promise<Buffer> {
  console.log(`  [scene] Gerando vídeo via Veo 3 text-to-video...`)
  return textToVideo(scene.veo3_prompt_en, scene.duration_seconds, aspectRatio)
}

// ── Fluxo principal ───────────────────────────────────────────────────────────

async function run(args: {
  finalVideoId: string
  dryRun:       boolean
  sceneFilter?: number
}) {
  const { finalVideoId, dryRun, sceneFilter } = args

  console.log(`\n=== Generate Scenes — final_video ${finalVideoId} ===\n`)
  if (dryRun) console.log('[DRY RUN] Nenhuma chamada de API será feita.\n')

  // 1. Carregar dados
  const finalVideo  = await getFinalVideo(finalVideoId)
  const videoAssets = await getVideoAssets(
    finalVideo.product_id,
    finalVideo.pipeline_id,
    finalVideo.copy_combination_id,
  )
  const sku = await getProductSku(finalVideo.product_id)

  const { scenes, storyboard_tag, aspect_ratio, canonical_personas_prompt } = videoAssets

  // Resolver scene_type para cada cena (suporta artefatos legados sem o campo)
  const resolvedScenes = scenes.map(s => ({
    ...s,
    _resolvedType: inferSceneType(s, canonical_personas_prompt ?? null),
  }))

  const filteredScenes = sceneFilter != null
    ? resolvedScenes.filter(s => s.scene_number === sceneFilter)
    : resolvedScenes

  // Expande cenas com narração > 20 palavras em sub-clips de ≤8s cada
  const targetScenes = expandScenes(filteredScenes)

  console.log(`Storyboard: ${storyboard_tag}`)
  console.log(`SKU: ${sku}`)
  console.log(`Cenas: ${targetScenes.length} (total no artefato: ${scenes.length})`)
  console.log(`Aspect ratio: ${aspect_ratio}`)

  // 2. Carregar persona_asset e verificar fallbacks para cenas persona
  const personaScenes = targetScenes.filter(s => s._resolvedType === 'persona')
  let personaAsset    = await getPersonaAsset(finalVideo.product_id)

  if (personaScenes.length > 0) {
    // Cenas sem persona_id precisam do board legado
    const needsLegacy = personaScenes.some(s => !s.persona_id)
    if (needsLegacy && !personaAsset?.nano_banana_character_board) {
      console.log(`\nCenas com persona sem persona_id detectadas. Character board legado não encontrado.`)
      if (dryRun) {
        console.log('[dry-run] Setup de character board seria executado aqui.')
      } else {
        console.log('Criando character board automaticamente...\n')
        await setupCharacterBoard({ productId: finalVideo.product_id, pipelineId: finalVideo.pipeline_id ?? undefined })
        personaAsset = await getPersonaAsset(finalVideo.product_id)
        if (!personaAsset?.nano_banana_character_board) {
          throw new Error('Falha ao criar character board — persona_asset ainda sem board após setup.')
        }
      }
    }

    // Resumo das personas mapeadas
    const namedCount  = new Set(personaScenes.map(s => s.persona_id).filter(Boolean)).size
    const legacyCount = personaScenes.filter(s => !s.persona_id).length
    if (namedCount)  console.log(`Personas nomeadas: ${namedCount}`)
    if (legacyCount) console.log(`Cenas legado (sem persona_id): ${legacyCount}`)
  }

  if (dryRun) {
    console.log('\nPlano de execução:')
    for (const scene of targetScenes) {
      const type     = scene._resolvedType
      const origin   = scene.scene_type ? 'explícito' : 'inferido'
      const personaLabel = type === 'persona'
        ? ` persona='${scene.persona_id ?? '__legacy__'}'`
        : ''
      const flow = type === 'persona' ? 'imagem de referência → Veo 3 image-to-video' : 'Veo 3 text-to-video'
      const isSubClip = !Number.isInteger(scene.scene_number)
      const label = isSubClip ? `${scene.scene_number} [sub-clip]` : scene.scene_number
      console.log(`  Cena ${label} [${scene.section}] (${type}${personaLabel}, ${origin}): ${flow}`)
      console.log(`    Duração: ${scene.duration_seconds}s`)
      console.log(`    Arquivo: ${buildFilename(storyboard_tag, scene.scene_number, scene.section)}`)
      console.log(`    Prompt: "${scene.veo3_prompt_en.slice(0, 80)}..."`)
    }
    return
  }

  // 3. Preparar pasta local
  const outputDir  = getOutputDir()
  const videosRoot = path.join(outputDir, 'videos')
  const folderPath = await ensureFolder(storyboard_tag, videosRoot)

  await updateFinalVideoStatus(finalVideoId, 'generating_scenes')
  console.log(`\nPasta local: ${folderPath}\n`)

  // 4. Construir mapa de imagens por persona (gerado uma vez, reutilizado em todas as cenas)
  let personaImageMap = new Map<string, Buffer>()
  if (personaScenes.length > 0) {
    console.log('Resolvendo imagens de referência por persona...')
    personaImageMap = await buildPersonaImageMap(targetScenes, videoAssets, personaAsset, sku)
    console.log(`Personas prontas: ${[...personaImageMap.keys()].join(', ')}\n`)
  }

  // 5. Processar cenas em sequência
  const results: SceneResult[] = []

  for (const scene of targetScenes) {
    const filename = buildFilename(storyboard_tag, scene.scene_number, scene.section)
    console.log(`→ Cena ${scene.scene_number}/${scenes.length} [${scene.section}] — ${scene._resolvedType}`)

    try {
      const clipBuffer = scene._resolvedType === 'persona'
        ? await generatePersonaScene(scene, personaImageMap, aspect_ratio)
        : await generateSceneClip(scene, aspect_ratio)

      const localPath = await saveClip(clipBuffer, filename, folderPath)
      console.log(`  ✓ Salvo localmente: ${localPath}`)

      console.log(`  ⬆ Subindo para o Drive...`)
      const { directUrl: driveUrl } = await saveVideoClipToDrive(clipBuffer, storyboard_tag, filename)
      console.log(`  ✓ Drive: ${driveUrl}\n`)

      results.push({
        scene_number:   scene.scene_number,
        section:        scene.section,
        local_path:     localPath,
        drive_filename: filename,
        drive_url:      driveUrl,
        status:         'ok',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Erro na cena ${scene.scene_number}: ${message}\n`)
      results.push({
        scene_number:   scene.scene_number,
        section:        scene.section,
        local_path:     '',
        drive_filename: filename,
        status:         'failed',
        error:          message,
      })
    }
  }

  // 6. Salvar resultados
  const successCount = results.filter(r => r.status === 'ok').length
  console.log(`\nConcluído: ${successCount}/${targetScenes.length} cenas geradas com sucesso.`)
  console.log(`Pasta: ${folderPath}`)

  await saveSceneResults(finalVideoId, results, folderPath)
  console.log(`final_video ${finalVideoId} atualizado.`)

  if (results.some(r => r.status === 'failed')) {
    const failed = results.filter(r => r.status === 'failed').map(r => r.scene_number)
    console.warn(`\nCenas com falha: ${failed.join(', ')}. Regere com --scene <n> para tentar novamente.`)
  }

  // Sumário de uso Gemini API
  const nb  = getNanoBananaSessionUsage()
  const veo = getVeo3SessionUsage()
  const totalTokens = nb.promptTokens + nb.outputTokens + veo.promptTokens + veo.outputTokens
  console.log(`\n── Gemini API usage ──────────────────────────────────────`)
  console.log(`  Nano Banana (${nb.model}): ${nb.calls} calls | ${nb.promptTokens} prompt + ${nb.outputTokens} output = ${nb.promptTokens + nb.outputTokens} tokens`)
  console.log(`  Veo 3       (${veo.model}): ${veo.calls} calls | ${veo.promptTokens} prompt + ${veo.outputTokens} output = ${veo.promptTokens + veo.outputTokens} tokens | ${(veo.videoBytes / 1024 / 1024).toFixed(1)} MB video`)
  console.log(`  Total tokens esta sessão: ${totalTokens}`)
  console.log(`──────────────────────────────────────────────────────────\n`)
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'final-video-id': { type: 'string' },
      'dry-run':        { type: 'boolean' },
      'scene':          { type: 'string' },
    },
  })

  const finalVideoId = args['final-video-id']
  if (!finalVideoId) {
    console.error('--final-video-id é obrigatório')
    process.exit(1)
  }

  run({
    finalVideoId,
    dryRun:      args['dry-run'] ?? false,
    sceneFilter: args.scene != null ? parseInt(args.scene, 10) : undefined,
  }).catch(e => { console.error('Erro:', e.message); process.exit(1) })
}
