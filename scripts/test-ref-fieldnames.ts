/**
 * Testa variações de nome do campo reference images na instância.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { getAuthHeaders, getProjectId } from './video/google-auth'

const LOCATION  = 'us-central1'
const MODEL     = 'imagen-3.0-capability-001'
const TINY_PNG  = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='
const PROMPT    = 'A person walking outdoors'
const PARAMS    = { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'allow_adult' }

async function post(label: string, instance: Record<string, unknown>) {
  const projectId = await getProjectId()
  const endpoint  = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`
  const res = await fetch(endpoint, {
    method: 'POST', headers: await getAuthHeaders(),
    body: JSON.stringify({ instances: [instance], parameters: PARAMS }),
  })
  const text = await res.text()
  const snippet = text.slice(0, 160).replace(/\n/g, ' ')
  console.log(`[${label}] ${res.status}: ${snippet}`)
}

async function main() {
  // 1. camelCase — atual
  await post('referenceImages (camel)', {
    prompt: PROMPT,
    referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: TINY_PNG, mimeType: 'image/png' } }],
  })

  // 2. snake_case
  await post('reference_images (snake)', {
    prompt: PROMPT,
    reference_images: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: TINY_PNG, mimeType: 'image/png' } }],
  })

  // 3. referenceImage (singular)
  await post('referenceImage (singular)', {
    prompt: PROMPT,
    referenceImage: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: TINY_PNG, mimeType: 'image/png' } }],
  })

  // 4. Sem referenceImages — só prompt (deve funcionar)
  await post('sem referência (baseline)', { prompt: PROMPT })

  // 5. referenceImages mas com image como string (errado de propósito — ver se muda o erro)
  await post('image como string', {
    prompt: PROMPT,
    referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', image: 'base64string' }],
  })

  // 6. referenceImages com image vazio
  await post('image vazio {}', {
    prompt: PROMPT,
    referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', image: {} }],
  })
}

main().catch(console.error)
