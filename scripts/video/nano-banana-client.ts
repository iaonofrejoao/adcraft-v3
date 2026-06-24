/**
 * scripts/video/nano-banana-client.ts
 * Cliente para Nano Banana (Google AI) via service account (Bearer token).
 *
 * Responsabilidades:
 *   1. generateCharacterBoard — gera imagens de referência do personagem (poses + expressões)
 *   2. generateFirstFrame    — gera o primeiro frame de uma cena usando o character board como referência
 *
 * O character board é gerado UMA VEZ por produto/pipeline e reutilizado em todas as
 * cenas com persona do mesmo vídeo.
 *
 * Uso standalone (teste):
 *   npx tsx scripts/video/nano-banana-client.ts --test --prompt "Brazilian woman 40yo white t-shirt kitchen"
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'
import { parseArgs } from 'node:util'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const NANO_BANANA_MODEL = process.env.NANO_BANANA_MODEL_ID ?? 'gemini-3.1-flash-image'
const GEMINI_API_BASE   = 'https://generativelanguage.googleapis.com/v1beta'
const POLL_INTERVAL_MS  = 3_000
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 min

// Uma única imagem de referência para o character board (reutilizada em todas as cenas)
const CHARACTER_BOARD_COUNT = 1

// ── Usage tracking ────────────────────────────────────────────────────────────

interface UsageMeta {
  promptTokenCount?:     number
  candidatesTokenCount?: number
  totalTokenCount?:      number
}

const _sessionUsage = { calls: 0, promptTokens: 0, outputTokens: 0 }

function logUsage(context: string, usage: UsageMeta | undefined) {
  const prompt = usage?.promptTokenCount     ?? 0
  const output = usage?.candidatesTokenCount ?? 0
  const total  = usage?.totalTokenCount      ?? (prompt + output)
  _sessionUsage.calls        += 1
  _sessionUsage.promptTokens += prompt
  _sessionUsage.outputTokens += output
  console.log(`  [nano-banana/usage] ${context} — prompt: ${prompt} | output: ${output} | total: ${total} tokens`)
}

export function getNanoBananaSessionUsage() {
  return { ..._sessionUsage, model: NANO_BANANA_MODEL }
}


// ── Polling de Long-Running Operation ────────────────────────────────────────

async function pollOperation(operationName: string, timeoutMs: number): Promise<{ response: unknown; _usage?: UsageMeta }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(`${GEMINI_API_BASE}/${operationName}`, { headers: await getAuthHeaders() })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Erro ao consultar operação Nano Banana: ${res.status} — ${body}`)
    }
    const op = await res.json() as { done?: boolean; error?: { message: string }; response?: unknown; metadata?: { usageMetadata?: UsageMeta } }
    if (op.error) throw new Error(`Nano Banana falhou: ${op.error.message}`)
    if (op.done) {
      const usage = (op.response as any)?.usageMetadata ?? op.metadata?.usageMetadata
      return { response: op.response, _usage: usage }
    }
  }
  throw new Error(`Nano Banana timeout após ${timeoutMs / 1000}s — operação: ${operationName}`)
}

// ── Extrair imagens do response ───────────────────────────────────────────────

async function extractImageBuffers(response: unknown): Promise<Buffer[]> {
  const r = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data: string; mimeType: string }
          fileData?: { fileUri: string }
        }>
      }
    }>
  }

  const parts = r?.candidates?.flatMap(c => c.content?.parts ?? []) ?? []
  const buffers: Buffer[] = []

  for (const part of parts) {
    if (part.inlineData?.data) {
      buffers.push(Buffer.from(part.inlineData.data, 'base64'))
    } else if (part.fileData?.fileUri) {
      const res = await fetch(part.fileData.fileUri, { headers: await getAuthHeaders() })
      if (!res.ok) throw new Error(`Erro ao baixar imagem Nano Banana: ${res.status}`)
      buffers.push(Buffer.from(await res.arrayBuffer()))
    }
  }

  if (buffers.length === 0) throw new Error('Nano Banana: nenhuma imagem retornada na resposta')
  return buffers
}

async function generateOneImage(prompt: string, timeoutMs: number, context = 'generateImage'): Promise<Buffer> {
  const body = {
    model: NANO_BANANA_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['image'],
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${NANO_BANANA_MODEL}:generateContent`,
    { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nano Banana generateImages falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as unknown

  let buffers: Buffer[]
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const opResult = await pollOperation((data as { name: string }).name, timeoutMs)
    logUsage(context, opResult._usage)
    buffers = await extractImageBuffers(opResult.response)
  } else {
    const usage = (data as any)?.usageMetadata as UsageMeta | undefined
    logUsage(context, usage)
    buffers = await extractImageBuffers(data)
  }

  return buffers[0]
}

// Gera count imagens com chamadas sequenciais (a API não suporta múltiplas por request)
async function generateImages(prompt: string, count: number, timeoutMs: number): Promise<Buffer[]> {
  const results: Buffer[] = []
  for (let i = 0; i < count; i++) {
    console.log(`  [nano-banana] Gerando imagem ${i + 1}/${count}...`)
    results.push(await generateOneImage(prompt, timeoutMs, `character-board img ${i + 1}/${count}`))
  }
  return results
}

// ── API Pública ───────────────────────────────────────────────────────────────

/**
 * Gera um character board: conjunto de imagens de referência do personagem
 * em poses e expressões distintas para garantir consistência visual entre cenas.
 *
 * @param personasPrompt Descrição detalhada do personagem (gerada pelo keyframe-generator)
 * @returns Array de Buffers PNG com as imagens de referência
 */
export async function generateCharacterBoard(
  personasPrompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer[]> {
  const prompt = `
Generate a single reference image of this character for video production.
This image will be used as the visual anchor for all scenes — it must be photorealistic and faithful to the description.

Character description:
${personasPrompt}

Requirements: frontal view, neutral expression, looking directly at camera, upper body visible (from waist up), natural lighting, UGC style, no filters, authentic, photorealistic.
Output: 9:16 vertical aspect ratio (portrait orientation, tall frame), PNG format.
The character must fill the full height of the frame with headroom at the top and waist visible at the bottom.
`.trim()

  return generateImages(prompt, CHARACTER_BOARD_COUNT, timeoutMs)
}

/**
 * Gera o primeiro frame de uma cena usando o character board como referência.
 * O Veo 3 usará este frame como ponto de partida (image-to-video).
 *
 * @param characterBoard Array de Buffers do character board (output de generateCharacterBoard)
 * @param scenePrompt Prompt da cena (veo3_prompt_en do keyframe)
 */
export async function generateFirstFrame(
  characterBoard: Buffer[],
  scenePrompt: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const referenceImages = characterBoard.map(buf => ({
    inlineData: {
      mimeType: 'image/png',
      data: buf.toString('base64'),
    },
  }))

  const body = {
    model: NANO_BANANA_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          ...referenceImages,
          {
            text: `These are reference images of the same character.
Generate the FIRST FRAME of a video scene featuring this exact character.
The character's appearance must match the reference images exactly.

Scene to portray:
${scenePrompt}

Output: Single photorealistic image, 9:16 aspect ratio, PNG format.
The image should capture the opening moment of this scene.`.trim(),
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['image'],
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${NANO_BANANA_MODEL}:generateContent`,
    { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nano Banana generateFirstFrame falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as unknown

  let buffers: Buffer[]
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const opResult = await pollOperation((data as { name: string }).name, timeoutMs)
    logUsage('first-frame', opResult._usage)
    buffers = await extractImageBuffers(opResult.response)
  } else {
    const usage = (data as any)?.usageMetadata as UsageMeta | undefined
    logUsage('first-frame', usage)
    buffers = await extractImageBuffers(data)
  }

  return buffers[0]
}

// ── CLI de teste ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      test:   { type: 'boolean' },
      prompt: { type: 'string' },
      output: { type: 'string' },
    },
  })

  if (!args.test) {
    console.error('Use --test para rodar em modo standalone')
    process.exit(1)
  }

  ;(async () => {
    const prompt = args.prompt ?? 'Brazilian woman, 38 years old, dark hair, white t-shirt, modern kitchen, natural lighting, photorealistic'
    const outputDir = args.output ?? '/tmp'

    console.log('Gerando character board...')
    const board = await generateCharacterBoard(prompt)
    console.log(`Character board gerado: ${board.length} imagens`)

    const { writeFile } = await import('node:fs/promises')
    for (let i = 0; i < board.length; i++) {
      const file = `${outputDir}/nano-banana-board-${i + 1}.png`
      await writeFile(file, board[i])
      console.log(`  → ${file} (${board[i].byteLength} bytes)`)
    }

    console.log('\nGerando primeiro frame de uma cena de exemplo...')
    const scenePrompt = 'Brazilian woman looking directly at camera with wide expressive eyes, close-up, UGC style'
    const firstFrame = await generateFirstFrame(board, scenePrompt)

    const frameFile = `${outputDir}/nano-banana-first-frame.png`
    await writeFile(frameFile, firstFrame)
    console.log(`Primeiro frame salvo em ${frameFile} (${firstFrame.byteLength} bytes)`)
  })().catch(e => { console.error(e); process.exit(1) })
}
