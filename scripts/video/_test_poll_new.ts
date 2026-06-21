import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!
const LOCATION = 'us-central1'
const MODEL    = 'veo-3.0-fast-generate-001'
const BASE_V1  = `https://${LOCATION}-aiplatform.googleapis.com/v1`
const BASE_V1B = `https://${LOCATION}-aiplatform.googleapis.com/v1beta`

;(async () => {
  const headers = await getAuthHeaders()
  console.log('Project:', PROJECT)

  // Criar operação com v1
  const cr = await fetch(`${BASE_V1}/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`, {
    method: 'POST', headers,
    body: JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  if (!cr.ok) { console.error('Falha criar:', await cr.text()); process.exit(1) }
  const op     = await cr.json() as any
  const opName = op.name
  const modelPath = opName.split('/operations/')[0]
  console.log('Operação criada:', opName)
  console.log()

  await new Promise(r => setTimeout(r, 3000))

  const tests: Array<[string, string, RequestInit]> = [
    // GET direto v1
    ['GET v1 fullName',            `${BASE_V1}/${opName}`,     { headers }],
    // GET direto v1beta
    ['GET v1beta fullName',        `${BASE_V1B}/${opName}`,    { headers }],
    // POST fetchPredictLongRunning v1beta com o modelPath
    ['POST v1beta fetchPredict',   `${BASE_V1B}/${modelPath}:fetchPredictLongRunningOperation`,
      { method: 'POST', headers, body: JSON.stringify({ operationName: opName }) }],
    // POST fetchPredictLongRunning v1
    ['POST v1 fetchPredict',       `${BASE_V1}/${modelPath}:fetchPredictLongRunningOperation`,
      { method: 'POST', headers, body: JSON.stringify({ operationName: opName }) }],
    // GET operations sem model path
    ['GET v1 /operations/{id}',    `${BASE_V1}/projects/${PROJECT}/locations/${LOCATION}/operations/${opName.split('/').pop()}`,
      { headers }],
  ]

  for (const [label, url, init] of tests) {
    const r    = await fetch(url, init)
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
    console.log(`  ${label}: ${result}`)
  }
})().catch(e => console.error('Erro:', e.message))
