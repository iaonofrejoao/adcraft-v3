import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PROJECT  = 'project-54d7f8ac-f04d-48a5-a8f'
const LOCATION = 'us-central1'
const MODEL    = 'veo-3.0-fast-generate-001'
const BASE_V1  = `https://${LOCATION}-aiplatform.googleapis.com/v1`
const BASE_V1B = `https://${LOCATION}-aiplatform.googleapis.com/v1beta`

// Primeiro cria uma operação fresca e depois testa todos os métodos de polling
;(async () => {
  const headers = await getAuthHeaders()

  // Criar operação
  const createUrl = `${BASE_V1}/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`
  console.log('Criando operação...')
  const cr = await fetch(createUrl, {
    method: 'POST', headers,
    body: JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  if (!cr.ok) { console.error('Falha ao criar:', cr.status, await cr.text()); process.exit(1) }
  const op = await cr.json() as any
  const opName    = op.name  // full resource name
  const opId      = opName.split('/').pop()
  const modelPath = opName.split('/operations/')[0]
  console.log('Operação:', opName)
  console.log()

  // Esperar 3s
  await new Promise(r => setTimeout(r, 3000))

  const tests: Array<[string, string, RequestInit]> = [
    // GET {full name} via v1
    ['GET v1/{fullName}', `${BASE_V1}/${opName}`, { headers }],
    // GET via standard operations path
    ['GET v1/projects/.../operations/{id}', `${BASE_V1}/projects/${PROJECT}/locations/${LOCATION}/operations/${opId}`, { headers }],
    // POST fetchPredictLongRunningOperation v1beta
    ['POST v1beta/fetchPredictLongRunningOperation', `${BASE_V1B}/${modelPath}:fetchPredictLongRunningOperation`, { method: 'POST', headers, body: JSON.stringify({ operationName: opName }) }],
    // POST fetchPredictLongRunningOperation v1
    ['POST v1/fetchPredictLongRunningOperation', `${BASE_V1}/${modelPath}:fetchPredictLongRunningOperation`, { method: 'POST', headers, body: JSON.stringify({ operationName: opName }) }],
    // GET via v1beta/{fullName}
    ['GET v1beta/{fullName}', `${BASE_V1B}/${opName}`, { headers }],
    // waitOperation
    ['POST v1/{fullName}:wait', `${BASE_V1}/${opName}:wait`, { method: 'POST', headers, body: JSON.stringify({}) }],
  ]

  for (const [label, url, init] of tests) {
    const r = await fetch(url, init)
    const body = await r.text()
    let result = ''
    if (r.ok) {
      try {
        const j = JSON.parse(body)
        result = `✅ OK — done:${j.done} state:${j.metadata?.state ?? j.state ?? '?'}`
      } catch { result = `✅ OK — ${body.slice(0, 80)}` }
    } else if (body.startsWith('<!')) {
      result = `❌ ${r.status} HTML 404`
    } else {
      try { result = `❌ ${r.status} — ${JSON.parse(body).error?.message?.slice(0,100)}` }
      catch { result = `❌ ${r.status}` }
    }
    console.log(`[${label}]: ${result}`)
  }
})().catch(e => console.error('Erro:', e.message))
