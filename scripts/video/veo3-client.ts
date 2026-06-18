/**
 * scripts/video/veo3-client.ts
 * Cliente para geração de vídeo via Veo 3 (Google AI) usando GEMINI_API_KEY.
 *
 * Uso standalone (teste):
 *   npx tsx scripts/video/veo3-client.ts --test --prompt "Brazilian woman talking to camera" --duration 5
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'
import { parseArgs } from 'node:util'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// TODO: confirmar model ID exato quando disponível no Google AI Studio
const VEO3_MODEL    = process.env.VEO3_MODEL_ID ?? 'veo-3.0-generate-preview'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 min
const POLL_INTERVAL_MS   = 5_000

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
      throw new Error(`Erro ao consultar operação Veo 3: ${res.status} — ${body}`)
    }
    const op = await res.json() as { done?: boolean; error?: { message: string }; response?: unknown }
    if (op.error) throw new Error(`Veo 3 falhou: ${op.error.message}`)
    if (op.done) return op.response
  }
  throw new Error(`Veo 3 timeout após ${timeoutMs / 1000}s — operação: ${operationName}`)
}

// ── Extrair vídeo do response ─────────────────────────────────────────────────

async function extractVideoBuffer(response: unknown): Promise<Buffer> {
  const r = response as { generatedSamples?: Array<{ video?: { uri?: string; mimeType?: string } }> }
  const uri = r?.generatedSamples?.[0]?.video?.uri
  if (!uri) throw new Error('Veo 3: nenhum vídeo retornado na resposta')

  const videoRes = await fetch(uri, { headers: { 'x-goog-api-key': apiKey() } })
  if (!videoRes.ok) throw new Error(`Erro ao baixar vídeo Veo 3: ${videoRes.status}`)
  return Buffer.from(await videoRes.arrayBuffer())
}

// ── API Pública ───────────────────────────────────────────────────────────────

/**
 * Gera vídeo a partir de texto.
 * O prompt deve incluir a narração embutida para o Veo 3 gerar áudio nativo.
 */
export async function textToVideo(
  prompt: string,
  durationSeconds: number,
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const body = {
    model: VEO3_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['video'],
      videoConfig: {
        durationSeconds,
        aspectRatio,
        generateAudio: true,
      },
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${VEO3_MODEL}:generateContent`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Veo 3 textToVideo falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as { name?: string } | unknown
  // Se retornou uma operação assíncrona (Long Running Operation)
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const response = await pollOperation((data as { name: string }).name, timeoutMs)
    return extractVideoBuffer(response)
  }

  // Resposta síncrona (improvável para vídeo, mas tratamos por segurança)
  return extractVideoBuffer(data)
}

/**
 * Gera vídeo a partir de um frame inicial (imagem) + prompt de cena.
 * Usado para cenas com persona — mantém consistência visual do personagem.
 */
export async function imageToVideo(
  firstFrameBuffer: Buffer,
  prompt: string,
  durationSeconds: number,
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const imageBase64 = firstFrameBuffer.toString('base64')

  const body = {
    model: VEO3_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['video'],
      videoConfig: {
        durationSeconds,
        aspectRatio,
        generateAudio: true,
      },
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${VEO3_MODEL}:generateContent`,
    { method: 'POST', headers: headers(), body: JSON.stringify(body) },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Veo 3 imageToVideo falhou: ${res.status} — ${text}`)
  }

  const data = await res.json() as unknown
  if (typeof data === 'object' && data !== null && 'name' in data && typeof (data as { name: string }).name === 'string') {
    const response = await pollOperation((data as { name: string }).name, timeoutMs)
    return extractVideoBuffer(response)
  }

  return extractVideoBuffer(data)
}

// ── CLI de teste ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      test:     { type: 'boolean' },
      prompt:   { type: 'string' },
      duration: { type: 'string' },
      output:   { type: 'string' },
    },
  })

  if (!args.test) {
    console.error('Use --test para rodar em modo standalone')
    process.exit(1)
  }

  ;(async () => {
    const prompt   = args.prompt   ?? 'Brazilian woman, 35 years old, talking to camera, natural light, UGC style'
    const duration = parseInt(args.duration ?? '5', 10)
    const output   = args.output   ?? '/tmp/veo3-test.mp4'

    console.log(`Gerando vídeo: "${prompt}" (${duration}s)`)
    const buf = await textToVideo(prompt, duration)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(output, buf)
    console.log(`Vídeo salvo em ${output} (${buf.byteLength} bytes)`)
  })().catch(e => { console.error(e); process.exit(1) })
}
