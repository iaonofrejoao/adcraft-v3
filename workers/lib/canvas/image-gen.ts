/**
 * workers/lib/canvas/image-gen.ts
 * Geração de imagens via Vertex AI.
 *
 * - Com referência de personagem → imagen-3.0-capability-001
 *   (campo: referenceImage, tipo: REFERENCE_TYPE_SUBJECT)
 * - Sem referência              → env NANO_BANANA_MODEL_ID ou imagen-3.0-generate-001
 */

import { getAuthHeaders, getProjectId } from '../../../scripts/video/google-auth'

const IMAGE_MODEL     = process.env.NANO_BANANA_MODEL_ID ?? 'imagen-3.0-generate-001'
const REFERENCE_MODEL = 'imagen-3.0-capability-001'
const IMAGE_LOCATION  = process.env.NANO_BANANA_LOCATION ?? process.env.VEO3_LOCATION ?? 'us-central1'
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

async function getEndpoint(model: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? await getProjectId()
  return `https://${IMAGE_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${IMAGE_LOCATION}/publishers/google/models/${model}:predict`
}

interface ImagenPrediction {
  bytesBase64Encoded?: string
  mimeType?:           string
}

async function callImagen(
  instance: Record<string, unknown>,
  aspectRatio: string,
  model: string,
): Promise<Buffer> {
  const body = {
    instances: [instance],
    parameters: {
      sampleCount:      1,
      aspectRatio:      aspectRatio,
      personGeneration: 'allow_adult',
      safetySetting:    'block_few',
    },
  }

  const endpoint = await getEndpoint(model)
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: await getAuthHeaders(),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vertex AI Imagen falhou [${model}]: ${res.status} — ${text}`)
  }

  const data = await res.json() as { predictions?: ImagenPrediction[] }
  const b64  = data.predictions?.[0]?.bytesBase64Encoded

  if (!b64) {
    throw new Error(`Imagen: nenhuma imagem retornada. Resposta: ${JSON.stringify(data).slice(0, 400)}`)
  }

  return Buffer.from(b64, 'base64')
}

async function generateOneImage(
  prompt: string,
  aspectRatio: string,
  referenceImageBuffer?: Buffer,
): Promise<Buffer> {
  if (referenceImageBuffer) {
    // Subject reference: imagen-3.0-capability-001
    // Campo obrigatório: referenceImage (singular), não "image"
    return callImagen(
      {
        prompt,
        referenceImages: [{
          referenceType:      'REFERENCE_TYPE_SUBJECT',
          referenceId:        1,
          referenceImage:     { bytesBase64Encoded: referenceImageBuffer.toString('base64') },
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        }],
      },
      aspectRatio,
      REFERENCE_MODEL,
    )
  }

  return callImagen({ prompt }, aspectRatio, IMAGE_MODEL)
}

/**
 * Gera `count` imagens para o prompt dado.
 * Quando referenceImageBuffer é fornecido, usa REFERENCE_TYPE_SUBJECT para
 * manter a aparência do personagem consistente entre frames.
 */
export async function generateImage(
  prompt: string,
  options: { count?: number; aspectRatio?: string; referenceImageBuffer?: Buffer } = {},
  _timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer[]> {
  const count       = options.count ?? 1
  const aspectRatio = options.aspectRatio ?? '9:16'
  const results: Buffer[] = []

  for (let i = 0; i < count; i++) {
    results.push(await generateOneImage(prompt, aspectRatio, options.referenceImageBuffer))
  }

  return results
}

/**
 * Gera imagem de referência do personagem (character board).
 * Mantida para compatibilidade com setup-character-board.ts.
 */
export async function generateCharacterBoard(
  personasPrompt: string,
  _timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer[]> {
  const prompt = `
Generate a single reference image of this character for video production.
This image will be used as the visual anchor for all scenes — it must be photorealistic and faithful to the description.

Character description:
${personasPrompt}

Requirements: frontal view, neutral expression, looking directly at camera, upper body visible (from waist up), natural lighting, UGC style, no filters, authentic, photorealistic.
`.trim()

  return generateImage(prompt, { count: 1 })
}
