import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!
const LOCATION = 'us-central1'
const MODEL    = 'veo-3.0-fast-generate-001'
const BASE     = `https://${LOCATION}-aiplatform.googleapis.com`

;(async () => {
  const headers = await getAuthHeaders()

  // Criar operação
  const cr = await fetch(`${BASE}/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`, {
    method: 'POST', headers,
    body: JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  const op     = await cr.json() as any
  const opName = op.name
  const opId   = opName.split('/').pop()
  console.log('Operação:', opName)
  console.log()
  await new Promise(r => setTimeout(r, 3000))

  const tests: Array<[string, string, RequestInit?]> = [
    // Operations sob publishers/google (sem model)
    [`GET publishers/google/operations/{id}`,
      `${BASE}/v1/publishers/google/operations/${opId}`, { headers }],
    // Operations globais no aiplatform.googleapis.com
    [`GET global aiplatform v1`,
      `https://aiplatform.googleapis.com/v1/${opName}`, { headers }],
    // Operation sob o projeto, sem publishers
    [`GET projects ops sem publishers`,
      `${BASE}/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/operations/${opId}`, { headers }],
    // Usando o operation name completo como path em v1
    [`GET v1 opName path completo`,
      `${BASE}/v1/${opName}`, { headers }],
    // POST fetchPredictLongRunning direto no modelo (v1)
    [`POST v1 modelo direto:fetchPredict`,
      `${BASE}/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:fetchPredictLongRunningOperation`,
      { method: 'POST', headers, body: JSON.stringify({ operationName: opName }) }],
    // waitOperation via aiplatform
    [`POST v1 /{name}:wait`,
      `${BASE}/v1/${opName}:wait`,
      { method: 'POST', headers, body: '{}' }],
  ]

  for (const [label, url, init] of tests) {
    const r    = await fetch(url, init ?? { headers })
    const body = await r.text()
    let result = ''
    if (r.ok) {
      try { const j = JSON.parse(body); result = `✅ done:${j.done} state:${j.metadata?.state ?? '?'}` }
      catch { result = '✅ ' + body.slice(0, 80) }
    } else if (body.startsWith('<!')) {
      result = `❌ ${r.status} HTML`
    } else {
      try { result = `❌ ${r.status} — ${JSON.parse(body).error?.message?.slice(0, 100)}` }
      catch { result = `❌ ${r.status}` }
    }
    console.log(`[${label}]: ${result}`)
  }
})().catch(e => console.error('Erro:', e.message))
