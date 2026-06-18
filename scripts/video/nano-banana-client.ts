/**
 * scripts/video/nano-banana-client.ts
 * Cliente para Nano Banana (Google AI) via GEMINI_API_KEY.
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

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// TODO: confirmar model ID exato do Nano Banana quando disponível no Google AI Studio
const NANO_BANANA_MODEL = process.env.NANO_BANANA_MODEL_ID ?? 'nano-banana-generate-preview'
const GEMINI_API_BASE   = 'https://generativelanguage.googleapis.com/v1beta'
const POLL_INTERVAL_MS  = 3_000
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 min

// Número de imagens geradas para o character board (poses distintas para consistência)
const CHARACTER_BOARD_COUNT = 4

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY não definida')
  return key
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey(),
  }
}

// ── Polling de Long-Running Operation ────────────────────────────────────────

async function pollOperation(operationName: string, timeoutMs: number): Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(`${GEMINI_API_BASE}/${operationName}`, { headers: headers() })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Erro ao consultar operação Nano Banana: ${res.status} — ${body}`)
    }
    const op = await res.json() as { done?: boolean; error?: { message: string }; response?: unknown }
    if (op.error) throw new Error(`Nano Banana falhou: ${op.error.message}`)
    if (op.done) return op.response
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
      const res = await fetch(part.fileData.fileUri, { headers: { 'x-goog-api-key': apiKey() } })
      if (!res.ok) throw new Error(`Erro ao baixar imagem Nano Banana: ${res.status}`)
      buffers.push(Buffer.from(await res.arrayBuffer()))
    }
  }

  if (buffers.length === 0) throw new Error('Nano Banana: nenhuma imagem retornada na resposta')
  return buffers
}

async function generateImages(prompt: string, count: number, timeoutMs: number): Promise<Buffer[]> {
  const body = {
    model: NANO_BANANA_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['image'],
      imageConfig: {
        numberOfImages: count,
        aspectRatio: '2:3',
        outputMimeType: 'image/png',
      },
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${NANO_BANANA_MODEL}:generateContent`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nano Banana generateImages falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as unknown

  // Long Running Operation
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const response = await pollOperation((data as { name: string }).name, timeoutMs)
    return extractImageBuffers(response)
  }

  return extractImageBuffers(data)
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
Generate ${CHARACTER_BOARD_COUNT} reference images of the same character for video production consistency.
The character must look IDENTICAL across all images — same person, same appearance, same style.

Character description:
${personasPrompt}

Image requirements:
- Image 1: Frontal view, neutral expression, looking at camera
- Image 2: 3/4 angle, slight smile, natural expression
- Image 3: Close-up face, emotional expression (empathetic / surprised)
- Image 4: Full body or medium shot, natural posture

Style: UGC style, photorealistic, natural lighting, no filters, authentic
CRITICAL: All 4 images must depict the SAME PERSON with consistent appearance.
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
      imageConfig: {
        numberOfImages: 1,
        aspectRatio: '9:16',
        outputMimeType: 'image/png',
      },
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${NANO_BANANA_MODEL}:generateContent`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nano Banana generateFirstFrame falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as unknown

  let buffers: Buffer[]
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const response = await pollOperation((data as { name: string }).name, timeoutMs)
    buffers = await extractImageBuffers(response)
  } else {
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
