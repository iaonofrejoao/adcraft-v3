/**
 * scripts/video/generate-scenes.ts
 * Gera clips individuais por cena usando Nano Banana + Veo 3.
 *
 * Fluxo por cena:
 *   scene_type='persona' → Nano Banana (character board reutilizado) → primeiro frame → Veo 3 image-to-video
 *   scene_type='scene'   → Veo 3 text-to-video direto
 *   Cada clip salvo no Google Drive com nomenclatura padronizada.
 *
 * Uso:
 *   npx tsx scripts/video/generate-scenes.ts \
 *     --final-video-id <uuid> \
 *     [--dry-run]       # exibe plano de execução sem chamar as APIs
 *     [--scene <n>]     # regenera apenas a cena N
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY
 *   GOOGLE_DRIVE_FOLDER_ID (pasta raiz dos vídeos no Drive)
 *   GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_PATH
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'
import { parseArgs } from 'node:util'
import { supabase }  from '../../workers/lib/db'
import { generateFirstFrame } from './nano-banana-client'
import { textToVideo, imageToVideo } from './veo3-client'
import { saveClip, buildFilename, ensureFolder } from './google-drive'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

type SceneType = 'persona' | 'scene'

interface VideoScene {
  scene_number:    number
  section:         string
  scene_type:      SceneType
  duration_seconds: number
  personas_prompt: string | null
  veo3_prompt_en:  string
  overlay_suggestion: string | null
  drive_filename:  string
}

interface VideoAssets {
  storyboard_tag:         string
  combination_used:       string
  aspect_ratio:           '9:16' | '1:1' | '16:9'
  drive_folder_name:      string
  canonical_personas_prompt: string | null
  scenes:                 VideoScene[]
  production_warnings:    string[]
}

interface PersonaAsset {
  id:                          string
  nano_banana_character_board: { image_urls: string[] } | null
  status:                      string
}

interface SceneResult {
  scene_number: number
  section:      string
  drive_url:    string
  drive_filename: string
  status:       'ok' | 'failed'
  error?:       string
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
    .select('data')
    .eq('product_id', productId)
    .eq('artifact_type', 'video_assets')
    .order('created_at', { ascending: false })
    .limit(1)

  if (combinationId) query = query.eq('copy_combination_id', combinationId)
  else if (pipelineId) query = query.eq('pipeline_id', pipelineId)

  const { data, error } = await query.single()
  if (error || !data) throw new Error(`Artefato 'video_assets' não encontrado`)
  return data.data as VideoAssets
}

async function getPersonaAsset(productId: string): Promise<PersonaAsset | null> {
  const { data } = await supabase
    .from('persona_assets')
    .select('id, nano_banana_character_board, status')
    .eq('product_id', productId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
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
  driveFolderUrl: string,
): Promise<void> {
  await supabase
    .from('final_videos')
    .update({
      status: 'ready',
      drive_folder_url: driveFolderUrl,
      composition_config: { scenes: results },
      completed_at: new Date().toISOString(),
    })
    .eq('id', finalVideoId)
}

// ── Carregar character board do Supabase Storage ──────────────────────────────

async function loadBoardImages(boardUrls: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  for (const url of boardUrls) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Erro ao baixar imagem do board: ${url} — ${res.status}`)
    buffers.push(Buffer.from(await res.arrayBuffer()))
  }
  return buffers
}

// ── Geração de cena ───────────────────────────────────────────────────────────

async function generatePersonaScene(
  scene:        VideoScene,
  boardImages:  Buffer[],
  aspectRatio:  '9:16' | '1:1' | '16:9',
): Promise<Buffer> {
  console.log(`  [persona] Gerando primeiro frame via Nano Banana...`)
  const firstFrame = await generateFirstFrame(boardImages, scene.veo3_prompt_en)

  console.log(`  [persona] Gerando vídeo via Veo 3 image-to-video...`)
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
  const personaAsset = await getPersonaAsset(finalVideo.product_id)

  const { scenes, storyboard_tag, aspect_ratio, drive_folder_name } = videoAssets
  const targetScenes = sceneFilter != null
    ? scenes.filter(s => s.scene_number === sceneFilter)
    : scenes

  console.log(`Storyboard: ${storyboard_tag}`)
  console.log(`Cenas: ${targetScenes.length} (total no artefato: ${scenes.length})`)
  console.log(`Aspect ratio: ${aspect_ratio}`)

  // Verificar character board para cenas persona
  const personaScenes = targetScenes.filter(s => s.scene_type === 'persona')
  if (personaScenes.length > 0 && !personaAsset?.nano_banana_character_board) {
    throw new Error(
      `Cenas com persona encontradas (${personaScenes.length}), mas character board não existe. ` +
      `Execute setup-character-board.ts primeiro.`,
    )
  }

  if (dryRun) {
    console.log('\nPlano de execução:')
    for (const scene of targetScenes) {
      const flow = scene.scene_type === 'persona'
        ? 'Nano Banana (first frame) → Veo 3 image-to-video'
        : 'Veo 3 text-to-video'
      console.log(`  Cena ${scene.scene_number} [${scene.section}] (${scene.scene_type}): ${flow}`)
      console.log(`    Duração: ${scene.duration_seconds}s`)
      console.log(`    Drive: ${scene.drive_filename}`)
      console.log(`    Prompt: "${scene.veo3_prompt_en.slice(0, 80)}..."`)
    }
    return
  }

  // 2. Preparar pasta no Drive
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID não definida')

  await updateFinalVideoStatus(finalVideoId, 'generating_scenes')

  console.log(`\nCriando pasta no Drive: ${drive_folder_name}`)
  const driveFolderId = await ensureFolder(drive_folder_name, rootFolderId)
  console.log(`Pasta: ${driveFolderId}\n`)

  // 3. Carregar character board (uma vez, reutilizado)
  let boardImages: Buffer[] = []
  if (personaScenes.length > 0 && personaAsset?.nano_banana_character_board) {
    console.log('Carregando character board do Supabase Storage...')
    boardImages = await loadBoardImages(personaAsset.nano_banana_character_board.image_urls)
    console.log(`${boardImages.length} imagens carregadas.\n`)
  }

  // 4. Processar cenas em sequência
  const results: SceneResult[] = []
  let driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`

  for (const scene of targetScenes) {
    console.log(`→ Cena ${scene.scene_number}/${scenes.length} [${scene.section}] — ${scene.scene_type}`)

    try {
      const clipBuffer = scene.scene_type === 'persona'
        ? await generatePersonaScene(scene, boardImages, aspect_ratio)
        : await generateSceneClip(scene, aspect_ratio)

      console.log(`  Fazendo upload para o Drive: ${scene.drive_filename}`)
      const driveUrl = await saveClip(clipBuffer, scene.drive_filename, driveFolderId)
      console.log(`  ✓ ${driveUrl}\n`)

      results.push({
        scene_number:   scene.scene_number,
        section:        scene.section,
        drive_url:      driveUrl,
        drive_filename: scene.drive_filename,
        status:         'ok',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Erro na cena ${scene.scene_number}: ${message}\n`)
      results.push({
        scene_number:   scene.scene_number,
        section:        scene.section,
        drive_url:      '',
        drive_filename: scene.drive_filename,
        status:         'failed',
        error:          message,
      })
    }
  }

  // 5. Salvar resultados no banco
  const successCount = results.filter(r => r.status === 'ok').length
  console.log(`\nConcluído: ${successCount}/${targetScenes.length} cenas geradas com sucesso.`)

  await saveSceneResults(finalVideoId, results, driveFolderUrl)
  console.log(`final_video ${finalVideoId} atualizado — drive_folder_url: ${driveFolderUrl}`)

  if (results.some(r => r.status === 'failed')) {
    const failed = results.filter(r => r.status === 'failed').map(r => r.scene_number)
    console.warn(`\nCenas com falha: ${failed.join(', ')}. Regere com --scene <n> para tentar novamente.`)
  }
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
