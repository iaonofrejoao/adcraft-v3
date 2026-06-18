/**
 * scripts/video/process-video-queue.ts
 * Orquestrador da fila de vídeos: pega final_videos com status 'queued'
 * e executa o pipeline Nano Banana + Veo 3 para cada um.
 *
 * Pipeline por vídeo:
 *   1. Verificar / criar character board (setup-character-board.ts se necessário)
 *   2. generate-scenes.ts → gera clips via Nano Banana + Veo 3, salva no Drive
 *
 * Uso:
 *   npx tsx scripts/video/process-video-queue.ts \
 *     --product-id <uuid> \
 *     [--limit <n>]            # máx de vídeos a processar (default: 5)
 *     [--final-video-id <id>]  # processa apenas este ID específico
 *     [--concurrency <n>]      # vídeos em paralelo (default: 1, máx: 3)
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY
 *   GOOGLE_DRIVE_FOLDER_ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_PATH
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv  from 'dotenv'
import * as path    from 'path'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { supabase }  from '../../workers/lib/db'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueuedVideo {
  id:                  string
  product_id:          string
  copy_combination_id: string
  status:              string
}

interface CharacterBoardStatus {
  exists: boolean
  ready:  boolean
  id?:    string
}

// ── Helpers de banco ──────────────────────────────────────────────────────────

async function getQueuedVideos(productId: string, limit: number): Promise<QueuedVideo[]> {
  const { data, error } = await supabase
    .from('final_videos')
    .select('id, product_id, copy_combination_id, status')
    .eq('product_id', productId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as QueuedVideo[]
}

async function getSingleVideo(finalVideoId: string): Promise<QueuedVideo> {
  const { data, error } = await supabase
    .from('final_videos')
    .select('id, product_id, copy_combination_id, status')
    .eq('id', finalVideoId)
    .single()

  if (error) throw error
  if (!data) throw new Error(`final_video ${finalVideoId} não encontrado`)
  return data as QueuedVideo
}

async function checkCharacterBoardStatus(productId: string): Promise<CharacterBoardStatus> {
  const { data } = await supabase
    .from('persona_assets')
    .select('id, status, nano_banana_character_board')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { exists: false, ready: false }
  const hasBoard = data.nano_banana_character_board != null
  return { exists: true, ready: data.status === 'ready' && hasBoard, id: data.id }
}

async function markVideoFailed(finalVideoId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('final_videos')
    .update({ status: 'failed', progress_step: `Erro: ${reason.substring(0, 200)}` })
    .eq('id', finalVideoId)
  if (error) console.warn(`[DB] Falha ao marcar video ${finalVideoId} como failed: ${error.message}`)
}

// ── Execução de scripts filhos ────────────────────────────────────────────────

function runScript(scriptPath: string, args: string[]): { success: boolean; output: string } {
  const result = spawnSync(
    'npx',
    ['tsx', scriptPath, ...args],
    {
      encoding: 'utf8',
      timeout:  60 * 60 * 1000, // 60 minutos por script
      env:      process.env,
    },
  )

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

  if (result.error) return { success: false, output: result.error.message }
  if (result.status !== 0) return { success: false, output }
  return { success: true, output }
}

// ── Pipeline por vídeo ────────────────────────────────────────────────────────

async function processVideo(video: QueuedVideo): Promise<{ success: boolean; reason?: string }> {
  const { id: finalVideoId, product_id } = video
  const scriptDir = path.resolve(__dirname)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[fila] Processando vídeo ${finalVideoId}`)
  console.log(`[fila] Produto: ${product_id}`)
  console.log(`[fila] Combinação: ${video.copy_combination_id}`)

  // ── Passo 1: Character Board ──
  console.log('\n[PASSO 1] Verificando character board (Nano Banana)…')
  const boardStatus = await checkCharacterBoardStatus(product_id)

  if (!boardStatus.ready) {
    const reason = boardStatus.exists
      ? `  persona_asset existe mas sem character board válido — executando setup-character-board…`
      : `  Nenhum persona_asset encontrado — executando setup-character-board…`
    console.log(reason)

    const setupResult = runScript(
      path.join(scriptDir, 'setup-character-board.ts'),
      ['--product-id', product_id],
    )

    if (!setupResult.success) {
      const msg = `setup-character-board falhou: ${setupResult.output.slice(-500)}`
      console.error(`  ✗ ${msg}`)
      await markVideoFailed(finalVideoId, msg)
      return { success: false, reason: msg }
    }
    console.log('  ✓ Character board pronto')
  } else {
    console.log(`  ✓ Character board já existe (persona_asset: ${boardStatus.id})`)
  }

  // ── Passo 2: Gerar cenas ──
  console.log('\n[PASSO 2] Gerando cenas (Nano Banana + Veo 3 → Drive)…')

  const scenesResult = runScript(
    path.join(scriptDir, 'generate-scenes.ts'),
    ['--final-video-id', finalVideoId],
  )

  if (!scenesResult.success) {
    const msg = `generate-scenes falhou: ${scenesResult.output.slice(-500)}`
    console.error(`  ✗ ${msg}`)
    await markVideoFailed(finalVideoId, msg)
    return { success: false, reason: msg }
  }

  console.log('  ✓ Cenas geradas e salvas no Drive')
  return { success: true }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id':     { type: 'string' },
      'final-video-id': { type: 'string' },
      'limit':          { type: 'string' },
      'concurrency':    { type: 'string' },
    },
  })

  const productId     = values['product-id']
  const singleVideoId = values['final-video-id']
  const limit         = parseInt(values['limit']       ?? '5', 10)
  const concurrency   = Math.min(parseInt(values['concurrency'] ?? '1', 10), 3)

  if (!productId && !singleVideoId) {
    throw new Error('--product-id ou --final-video-id é obrigatório')
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('[process-video-queue] Iniciando orquestrador (Nano Banana + Veo 3)')
  if (productId)     console.log(`  Produto:      ${productId}`)
  if (singleVideoId) console.log(`  Vídeo único:  ${singleVideoId}`)
  console.log(`  Concorrência: ${concurrency}`)
  console.log(`  Limite:       ${limit}`)

  let queue: QueuedVideo[]

  if (singleVideoId) {
    const video = await getSingleVideo(singleVideoId)
    if (!['queued', 'failed'].includes(video.status)) {
      throw new Error(
        `Vídeo ${singleVideoId} tem status '${video.status}' — apenas 'queued' ou 'failed' podem ser reprocessados.`,
      )
    }
    if (video.status === 'failed') {
      await supabase
        .from('final_videos')
        .update({ status: 'queued', progress_step: null, error_message: null })
        .eq('id', singleVideoId)
      video.status = 'queued'
    }
    queue = [video]
  } else {
    queue = await getQueuedVideos(productId!, limit)
  }

  if (queue.length === 0) {
    console.log('\n[fila] Nenhum vídeo na fila. Encerrando.')
    return
  }

  console.log(`\n[fila] ${queue.length} vídeo(s) a processar`)

  const results: Array<{ id: string; success: boolean; reason?: string }> = []

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(video =>
        processVideo(video)
          .then(r => ({ id: video.id, ...r }))
          .catch(err => ({
            id:      video.id,
            success: false,
            reason:  (err as Error).message,
          }))
      ),
    )

    results.push(...batchResults)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('[process-video-queue] Sumário:')
  const successful = results.filter(r => r.success)
  const failed     = results.filter(r => !r.success)

  console.log(`  ✓ Concluídos: ${successful.length}`)
  if (failed.length > 0) {
    console.log(`  ✗ Falharam:   ${failed.length}`)
    failed.forEach(r => console.log(`    - ${r.id}: ${r.reason}`))
  }

  if (failed.length > 0) process.exit(1)
}

main().catch(err => {
  console.error('\n[process-video-queue] ERRO FATAL:', err.message)
  process.exit(1)
})
