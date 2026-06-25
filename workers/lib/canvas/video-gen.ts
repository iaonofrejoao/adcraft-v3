/**
 * workers/lib/canvas/video-gen.ts
 * Lib pura de geração de vídeo via Veo 3 (Vertex AI).
 * Sem dotenv, sem parseArgs — pronta para ser chamada de API routes.
 */

import { getAuthHeaders, getProjectId } from '../../../scripts/video/google-auth'

const VEO3_MODEL     = process.env.VEO3_MODEL_ID ?? 'veo-3.0-fast-generate-001'
const VEO3_LOCATION  = process.env.VEO3_LOCATION ?? 'us-central1'
const VERTEX_AI_BASE = `https://${VEO3_LOCATION}-aiplatform.googleapis.com/v1`
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const POLL_INTERVAL_MS   = 5_000

async function getVertexEndpoint(): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? await getProjectId()
  return `${VERTEX_AI_BASE}/projects/${projectId}/locations/${VEO3_LOCATION}/publishers/google/models/${VEO3_MODEL}:predictLongRunning`
}

function getModelPath(operationName: string): string | null {
  const vertexM = operationName.match(/^(projects\/[^/]+\/locations\/[^/]+\/publishers\/[^/]+\/models\/[^/]+)\/operations\//)
  if (vertexM) return vertexM[1]
  return null
}

async function pollOperation(operationName: string, timeoutMs: number): Promise<unknown> {
  const modelPath  = getModelPath(operationName)
  const pollEndpoint = modelPath
    ? `${VERTEX_AI_BASE}/${modelPath}:fetchPredictOperation`
    : `https://generativelanguage.googleapis.com/v1beta/${operationName}`
  const pollMethod = modelPath ? 'POST' : 'GET'
  const pollBody   = modelPath ? JSON.stringify({ operationName }) : undefined

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(pollEndpoint, { method: pollMethod, headers: await getAuthHeaders(), body: pollBody })
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

async function extractVideoBuffer(response: unknown): Promise<Buffer> {
  const r = response as {
    generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> }
    predictions?: Array<{ bytesBase64Encoded?: string }>
    videos?: Array<{ bytesBase64Encoded?: string }>
  }

  const uri = r?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
  if (uri) {
    const videoRes = await fetch(uri, { headers: await getAuthHeaders() })
    if (!videoRes.ok) throw new Error(`Erro ao baixar vídeo Veo 3: ${videoRes.status}`)
    return Buffer.from(await videoRes.arrayBuffer())
  }

  const base64 = r?.predictions?.[0]?.bytesBase64Encoded ?? r?.videos?.[0]?.bytesBase64Encoded
  if (base64) return Buffer.from(base64, 'base64')

  throw new Error(`Veo 3: nenhum vídeo retornado. Resposta: ${JSON.stringify(r).slice(0, 500)}`)
}

async function predictLongRunning(body: unknown, timeoutMs: number): Promise<Buffer> {
  const endpoint = await getVertexEndpoint()
  const res = await fetch(endpoint, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Veo 3 predictLongRunning falhou: ${res.status} — ${text}`)
  }

  const op = await res.json() as { name?: string; done?: boolean; error?: { message: string }; response?: unknown }
  if (op.error) throw new Error(`Veo 3 erro imediato: ${op.error.message}`)
  if (op.done) return extractVideoBuffer(op.response)
  if (!op.name) throw new Error(`Veo 3: operação sem name. Resposta: ${JSON.stringify(op).slice(0, 500)}`)

  const response = await pollOperation(op.name, timeoutMs)
  return extractVideoBuffer(response)
}

/**
 * Gera vídeo a partir de texto ou imagem (image-to-video quando firstFrameBuffer é fornecido).
 */
export async function generateVideo(
  prompt: string,
  options: {
    duration?: number
    aspectRatio?: '9:16' | '1:1' | '16:9'
    firstFrameBuffer?: Buffer
  } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  const aspectRatio = options.aspectRatio ?? '9:16'

  if (options.firstFrameBuffer) {
    const body = {
      instances: [{
        prompt,
        image: {
          bytesBase64Encoded: options.firstFrameBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      }],
      parameters: { aspectRatio, sampleCount: 1 },
    }
    return predictLongRunning(body, timeoutMs)
  }

  const body = {
    instances: [{ prompt }],
    parameters: { aspectRatio, sampleCount: 1 },
  }
  return predictLongRunning(body, timeoutMs)
}
