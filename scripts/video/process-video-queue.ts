/**
 * scripts/video/process-video-queue.ts
 * Orquestrador da fila de vídeos: pega final_videos com status 'queued'
 * e executa o pipeline completo para cada um.
 *
 * Pipeline por vídeo:
 *   1. Verificar / criar persona_assets (setup-persona.ts se necessário)
 *   2. generate-scenes.ts  → gera clips individuais
 *   3. compose-final.ts    → monta, legenda, exporta
 *
 * Uso:
 *   npx tsx scripts/video/process-video-queue.ts \
 *     --product-id <uuid> \
 *     [--limit <n>]           # máx de vídeos a processar (default: 5)
 *     [--final-video-id <id>] # processa apenas este ID específico
 *     [--word-timestamps]     # passa para compose-final (faster-whisper)
 *     [--no-music]            # compõe sem trilha sonora
 *     [--concurrency <n>]     # vídeos em paralelo (default: 1, máx: 3)
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

interface PersonaStatus {
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

async function checkPersonaStatus(productId: string): Promise<PersonaStatus> {
  const { data } = await supabase
    .from('persona_assets')
    .select('id, status')
    .eq('product_id', productId)
    .maybeSingle()

  if (!data) return { exists: false, ready: false }
  return { exists: true, ready: data.status === 'ready', id: data.id }
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

async function processVideo(
  video:           QueuedVideo,
  opts: {
    wordTimestamps: boolean
    noMusic:        boolean
  },
): Promise<{ success: boolean; reason?: string }> {
  const { id: finalVideoId, product_id } = video
  const scriptDir = path.resolve(__dirname)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[fila] Processando vídeo ${finalVideoId}`)
  console.log(`[fila] Produto: ${product_id}`)
  console.log(`[fila] Combinação: ${video.copy_combination_id}`)

  // ── Passo 1: Persona ──
  console.log('\n[PASSO 1] Verificando persona_assets…')
  const persona = await checkPersonaStatus(product_id)

  if (!persona.exists || !persona.ready) {
    if (!persona.exists) {
      console.log('  persona_assets não encontrada — executando setup-persona…')
    } else {
      console.log('  persona_assets com status não-ready — executando setup-persona…')
    }

    const setupResult = runScript(
      path.join(scriptDir, 'setup-persona.ts'),
      ['--product-id', product_id],
    )

    if (!setupResult.success) {
      const reason = `setup-persona falhou: ${setupResult.output.slice(-500)}`
      console.error(`  ✗ ${reason}`)
      return { success: false, reason }
    }
    console.log('  ✓ Persona pronta')
  } else {
    console.log(`  ✓ Persona já existe (id: ${persona.id})`)
  }

  // ── Passo 2: generate-scenes ──
  console.log('\n[PASSO 2] Gerando clips de cenas…')

  const scenesResult = runScript(
    path.join(scriptDir, 'generate-scenes.ts'),
    ['--final-video-id', finalVideoId],
  )

  if (!scenesResult.success) {
    const reason = `generate-scenes falhou: ${scenesResult.output.slice(-500)}`
    console.error(`  ✗ ${reason}`)
    await markVideoFailed(finalVideoId, reason)
    return { success: false, reason }
  }
  console.log('  ✓ Clips gerados')

  // ── Passo 3: compose-final ──
  console.log('\n[PASSO 3] Compondo vídeo final…')

  const composeArgs = ['--final-video-id', finalVideoId]
  if (opts.wordTimestamps) composeArgs.push('--word-timestamps')
  if (opts.noMusic)        composeArgs.push('--no-music')

  const composeResult = runScript(
    path.join(scriptDir, 'compose-final.ts'),
    composeArgs,
  )

  if (!composeResult.success) {
    const reason = `compose-final falhou: ${composeResult.output.slice(-500)}`
    console.error(`  ✗ ${reason}`)
    await markVideoFailed(finalVideoId, reason)
    return { success: false, reason }
  }

  console.log(`  ✓ Vídeo final pronto`)
  return { success: true }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id':      { type: 'string'  },
      'final-video-id':  { type: 'string'  },
      'limit':           { type: 'string'  },
      'word-timestamps': { type: 'boolean' },
      'no-music':        { type: 'boolean' },
      'concurrency':     { type: 'string'  },
    },
  })

  const productId     = values['product-id']
  const singleVideoId = values['final-video-id']
  const limit         = parseInt(values['limit']       ?? '5',  10)
  const concurrency   = Math.min(parseInt(values['concurrency'] ?? '1', 10), 3)
  const wordTimestamps = values['word-timestamps'] ?? false
  const noMusic       = values['no-music']        ?? false

  if (!productId && !singleVideoId) {
    throw new Error('--product-id ou --final-video-id é obrigatório')
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('[process-video-queue] Iniciando orquestrador')
  if (productId)     console.log(`  Produto:     ${productId}`)
  if (singleVideoId) console.log(`  Vídeo único: ${singleVideoId}`)
  console.log(`  Concorrência: ${concurrency}`)
  console.log(`  Limite:       ${limit}`)

  let queue: QueuedVideo[]

  if (singleVideoId) {
    const video = await getSingleVideo(singleVideoId)
    // Permite reprocessar vídeos failed além de queued
    if (!['queued', 'failed'].includes(video.status)) {
      throw new Error(`Vídeo ${singleVideoId} tem status '${video.status}' — apenas 'queued' ou 'failed' podem ser reprocessados.`)
    }
    // Resetar para queued se era failed
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

  // Processar em lotes de 'concurrency'
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(video =>
        processVideo(video, { wordTimestamps, noMusic })
          .then(r => ({ id: video.id, ...r }))
          .catch(err => ({
            id:      video.id,
            success: false,
            reason:  (err as Error).message,
          }))
      )
    )

    results.push(...batchResults)
  }

  // ── Sumário ──
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
