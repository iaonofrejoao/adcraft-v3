import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { getAuthHeaders, getProjectId } from './video/google-auth'

const LOCATION = 'us-central1'
const MODEL    = 'imagen-3.0-capability-002'
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='

async function post(label: string, body: object) {
  const projectId = await getProjectId()
  const endpoint  = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`
  const res  = await fetch(endpoint, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) })
  const text = await res.text()
  console.log(`[${label}] ${res.status}: ${text.slice(0, 200)}`)
}

async function main() {
  const projectId = await getProjectId()
  console.log('Project:', projectId, '| Model:', MODEL)

  // 1. Geração simples (sem referência) — baseline
  console.log('\n--- 1. Baseline sem referência ---')
  await post('baseline', {
    instances: [{ prompt: 'A red apple on a table, photorealistic' }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  })

  // 2. Subject reference com PNG mínimo
  console.log('\n--- 2. Subject reference ---')
  await post('subject-ref', {
    instances: [{
      prompt: 'A person walking outdoors, UGC style, photorealistic',
      referenceImages: [{
        referenceId: 1,
        referenceType: 'REFERENCE_TYPE_SUBJECT',
        subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        image: { bytesBase64Encoded: TINY_PNG, mimeType: 'image/png' },
      }],
    }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  })
}

main().catch(console.error)
