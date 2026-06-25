/**
 * Testa subject reference com imagem PNG mínima gerada localmente.
 * Se funcionar → problema era com a imagem do Drive.
 * Se falhar com mesmo erro → problema é de permissão/API no projeto.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { getAuthHeaders, getProjectId } from './video/google-auth'

const LOCATION = 'us-central1'

// PNG 4x4 pixels vermelho sólido (válido, mínimo)
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='

async function post(model: string, body: object) {
  const projectId = await getProjectId()
  const endpoint  = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${model}:predict`
  const res = await fetch(endpoint, {
    method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body),
  })
  const text = await res.text()
  if (res.ok) {
    const data = JSON.parse(text)
    return `✓ OK — ${data.predictions?.[0]?.bytesBase64Encoded?.length ?? 0} chars`
  }
  return `✗ ${res.status}: ${text.slice(0, 200)}`
}

async function main() {
  console.log('=== Teste com PNG mínimo local (4x4 px) ===\n')

  // Teste 1: capability-001 + PNG mínimo
  console.log('[1] imagen-3.0-capability-001 + REFERENCE_TYPE_SUBJECT + PNG mínimo:')
  console.log(await post('imagen-3.0-capability-001', {
    instances: [{
      prompt: 'A person walking outdoors, UGC style',
      referenceImages: [{
        referenceId: 1,
        referenceType: 'REFERENCE_TYPE_SUBJECT',
        subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        image: { bytesBase64Encoded: TINY_PNG_B64, mimeType: 'image/png' },
      }],
    }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  }))

  // Teste 2: generate-001 + RAW + PNG mínimo (mais permissivo)
  console.log('\n[2] imagen-3.0-generate-001 + REFERENCE_TYPE_RAW + PNG mínimo:')
  console.log(await post('imagen-3.0-generate-001', {
    instances: [{
      prompt: 'A red apple on a table',
      referenceImages: [{
        referenceId: 1,
        referenceType: 'REFERENCE_TYPE_RAW',
        image: { bytesBase64Encoded: TINY_PNG_B64, mimeType: 'image/png' },
      }],
    }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  }))

  // Teste 3: verifica content-type da imagem do proxy Drive
  console.log('\n=== Verificando content-type da imagem no proxy Drive ===')
  const proxyRes = await fetch('http://localhost:3000/api/drive-image?url=' + encodeURIComponent('https://drive.google.com/uc?export=view&id=1gRDguLfVXWtKFSKkScC_tqpobKG4V0z6'), { method: 'HEAD' })
  console.log('Content-Type:', proxyRes.headers.get('content-type'))
  console.log('Content-Length:', proxyRes.headers.get('content-length'))
}

main().catch(console.error)
