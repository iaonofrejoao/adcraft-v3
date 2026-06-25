import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { getAuthHeaders, getProjectId } from './video/google-auth'

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='

const REGIONS = [
  'us-central1',
  'us-east4',
  'us-east1',
  'us-west1',
  'us-west4',
  'europe-west4',
  'europe-west2',
  'asia-northeast1',
  'asia-southeast1',
]

const MODELS = ['imagen-3.0-capability-002', 'imagen-3.0-capability-001']

async function main() {
  const projectId = await getProjectId()
  const headers   = await getAuthHeaders()

  for (const model of MODELS) {
    console.log(`\n=== ${model} ===`)
    for (const region of REGIONS) {
      const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict`
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          instances: [{
            prompt: 'A person outdoors',
            referenceImages: [{
              referenceType: 'REFERENCE_TYPE_SUBJECT',
              referenceId: 1,
              referenceImage: { bytesBase64Encoded: TINY_PNG },
              subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
            }],
          }],
          parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'allow_adult' },
        }),
      })
      const text = await res.text()
      const snippet = text.slice(0, 120).replace(/\n/g, ' ')
      // 200 = funciona, qualquer outro erro ≠ "unavailable"/"not found" também é interessante
      const tag = res.ok ? '✓ FUNCIONOU' : `✗ ${res.status}`
      console.log(`  ${region.padEnd(20)} ${tag}: ${snippet}`)
    }
  }
}

main().catch(console.error)
