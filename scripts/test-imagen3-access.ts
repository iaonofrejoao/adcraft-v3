/**
 * Verifica se imagen-3.0-generate-001 está acessível no projeto Vertex AI.
 * Usa um prompt simples sem referência — só para confirmar acesso ao modelo.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { getAuthHeaders, getProjectId } from './video/google-auth'

const LOCATION = process.env.VEO3_LOCATION ?? 'us-central1'

async function testModel(model: string) {
  const projectId = await getProjectId()
  const endpoint  = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${model}:predict`

  console.log(`\nTestando: ${model}`)
  console.log(`Endpoint: ${endpoint}`)

  const body = {
    instances: [{ prompt: 'A red apple on a white table, photorealistic' }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: await getAuthHeaders(),
    body:    JSON.stringify(body),
  })

  if (res.ok) {
    const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> }
    const bytes = data.predictions?.[0]?.bytesBase64Encoded?.length ?? 0
    console.log(`✓ OK — imagem gerada (${bytes} chars base64)`)
  } else {
    const text = await res.text()
    console.log(`✗ ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function main() {
  await testModel('imagen-3.0-generate-001')
  await testModel('imagen-3.0-fast-generate-001')
}

main().catch(console.error)
