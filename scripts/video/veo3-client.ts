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
import { getAuthHeaders, getProjectId } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const VEO3_MODEL         = process.env.VEO3_MODEL_ID  ?? 'veo-3.0-fast-generate-001'
const VEO3_LOCATION      = process.env.VEO3_LOCATION  ?? 'us-central1'
// v1 (não v1beta) — publisher models Veo 3 só estão acessíveis na v1
const VERTEX_AI_BASE     = `https://${VEO3_LOCATION}-aiplatform.googleapis.com/v1`
const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 min
const POLL_INTERVAL_MS   = 5_000

// Vertex AI endpoint para Veo 3
async function getVertexEndpoint(): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? await getProjectId()
  return `${VERTEX_AI_BASE}/projects/${projectId}/locations/${VEO3_LOCATION}/publishers/google/models/${VEO3_MODEL}:predictLongRunning`
}

// ── Usage tracking ────────────────────────────────────────────────────────────

interface Veo3UsageMeta {
  promptTokenCount?:     number
  candidatesTokenCount?: number
  totalTokenCount?:      number
  [key: string]: unknown
}

const _sessionUsage = { calls: 0, promptTokens: 0, outputTokens: 0, videoBytes: 0 }

function logUsage(context: string, usage: Veo3UsageMeta | undefined, videoBytes?: number) {
  const prompt = usage?.promptTokenCount     ?? 0
  const output = usage?.candidatesTokenCount ?? 0
  const total  = usage?.totalTokenCount      ?? (prompt + output)
  _sessionUsage.calls        += 1
  _sessionUsage.promptTokens += prompt
  _sessionUsage.outputTokens += output
  if (videoBytes) _sessionUsage.videoBytes += videoBytes

  const parts = [`prompt: ${prompt} | output: ${output} | total: ${total} tokens`]
  if (videoBytes) parts.push(`video: ${(videoBytes / 1024).toFixed(1)} KB`)
  console.log(`  [veo3/usage] ${context} — ${parts.join(' | ')}`)
}

export function getVeo3SessionUsage() {
  return { ..._sessionUsage, model: VEO3_MODEL }
}


// ── Polling de Long-Running Operation ────────────────────────────────────────

// Tanto Vertex AI quanto Gemini API usam fetchPredictLongRunningOperation (POST)
// para consultar operações de vídeo — o GET genérico retorna 403 na Gemini API.
function getModelPath(operationName: string): string | null {
  // Vertex AI: projects/.../publishers/.../models/.../operations/...
  const vertexM = operationName.match(/^(projects\/[^/]+\/locations\/[^/]+\/publishers\/[^/]+\/models\/[^/]+)\/operations\//)
  if (vertexM) return vertexM[1]
  // Gemini API: models/model-name/operations/...
  const geminiM = operationName.match(/^(models\/[^/]+)\/operations\//)
  if (geminiM) return geminiM[1]
  return null
}

async function pollOperation(operationName: string, timeoutMs: number): Promise<{ response: unknown; usage?: Veo3UsageMeta }> {
  const modelPath = getModelPath(operationName)
  const pollEndpoint = modelPath
    ? `${VERTEX_AI_BASE}/${modelPath}:fetchPredictOperation`
    : `${GEMINI_API_BASE}/${operationName}` // fallback Gemini API (não usado no fluxo padrão)
  const pollMethod = modelPath ? 'POST' : 'GET'
  const pollBody   = modelPath ? JSON.stringify({ operationName }) : undefined

  const deadline = Date.now() + timeoutMs
  console.log(`  [veo3] Aguardando operação: ${operationName}`)
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(pollEndpoint, { method: pollMethod, headers: await getAuthHeaders(), body: pollBody })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Erro ao consultar operação Veo 3: ${res.status} — ${body}`)
    }
    const op = await res.json() as { done?: boolean; error?: { message: string }; response?: unknown; metadata?: { usageMetadata?: Veo3UsageMeta } }
    if (op.error) throw new Error(`Veo 3 falhou: ${op.error.message}`)
    if (op.done) {
      const usage = (op.response as any)?.usageMetadata ?? op.metadata?.usageMetadata
      return { response: op.response, usage }
    }
    process.stdout.write('.')
  }
  console.log()
  throw new Error(`Veo 3 timeout após ${timeoutMs / 1000}s — operação: ${operationName}`)
}

// ── Extrair vídeo do response ─────────────────────────────────────────────────

async function extractVideoBuffer(response: unknown, context: string, usage?: Veo3UsageMeta): Promise<Buffer> {
  const r = response as {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: { uri?: string; mimeType?: string }
      }>
    }
    predictions?: Array<{
      bytesBase64Encoded?: string
      mimeType?: string
    }>
  }

  let buf: Buffer | null = null

  // Formato 1: generateVideoResponse (Generative Language API)
  const uri = r?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
  if (uri) {
    const videoRes = await fetch(uri, { headers: await getAuthHeaders() })
    if (!videoRes.ok) throw new Error(`Erro ao baixar vídeo Veo 3: ${videoRes.status}`)
    buf = Buffer.from(await videoRes.arrayBuffer())
  }

  // Formato 2: predictions com base64 (predict API style)
  if (!buf) {
    const prediction = r?.predictions?.[0]
    if (prediction?.bytesBase64Encoded) {
      buf = Buffer.from(prediction.bytesBase64Encoded, 'base64')
    }
  }

  // Formato 3: videos[0].bytesBase64Encoded (Vertex AI publisher model style)
  if (!buf) {
    const rv = response as { videos?: Array<{ bytesBase64Encoded?: string }> }
    const encoded = rv?.videos?.[0]?.bytesBase64Encoded
    if (encoded) buf = Buffer.from(encoded, 'base64')
  }

  if (!buf) throw new Error(`Veo 3: nenhum vídeo retornado. Resposta: ${JSON.stringify(r).slice(0, 500)}`)

  logUsage(context, usage, buf.byteLength)
  return buf
}

// ── Requisição predictLongRunning ─────────────────────────────────────────────

async function predictLongRunning(body: unknown, timeoutMs: number, context: string): Promise<Buffer> {
  const endpoint = await getVertexEndpoint()
  const res = await fetch(endpoint, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Veo 3 predictLongRunning falhou: ${res.status} — ${text}`)
  }

  const op = await res.json() as { name?: string; done?: boolean; error?: { message: string }; response?: unknown; metadata?: { usageMetadata?: Veo3UsageMeta } }

  console.log(`  [veo3] Operação criada: ${op.name ?? '(sem nome)'}`)
  if (op.error) throw new Error(`Veo 3 erro imediato: ${op.error.message}`)
  if (op.done) {
    const usage = (op.response as any)?.usageMetadata ?? op.metadata?.usageMetadata
    return extractVideoBuffer(op.response, context, usage)
  }

  if (!op.name) throw new Error(`Veo 3: operação sem name. Resposta: ${JSON.stringify(op).slice(0, 500)}`)

  const { response, usage } = await pollOperation(op.name, timeoutMs)
  return extractVideoBuffer(response, context, usage)
}

// ── API Pública ───────────────────────────────────────────────────────────────

/**
 * Gera vídeo a partir de texto.
 * O prompt deve incluir a narração embutida para o Veo 3 gerar áudio nativo.
 */
export async function textToVideo(
  prompt: string,
  _durationSeconds: number,
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      sampleCount: 1,
    },
  }
  return predictLongRunning(body, timeoutMs, 'text-to-video')
}

/**
 * Gera vídeo a partir de um frame inicial (imagem) + prompt de cena.
 * Usado para cenas com persona — mantém consistência visual do personagem.
 */
export async function imageToVideo(
  firstFrameBuffer: Buffer,
  prompt: string,
  _durationSeconds: number,
  aspectRatio: '9:16' | '1:1' | '16:9' = '9:16',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const body = {
    instances: [
      {
        prompt,
        image: {
          bytesBase64Encoded: firstFrameBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      },
    ],
    parameters: {
      aspectRatio,
      sampleCount: 1,
    },
  }
  return predictLongRunning(body, timeoutMs, 'image-to-video')
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

    console.log(`Modelo: ${VEO3_MODEL}`)
    console.log(`Gerando vídeo: "${prompt}" (${duration}s)`)
    const buf = await textToVideo(prompt, duration)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(output, buf)
    console.log(`\nVídeo salvo em ${output} (${buf.byteLength} bytes)`)
  })().catch(e => { console.error(e); process.exit(1) })
}
