import * as dotenv from 'dotenv'
import * as path from 'path'
import { GoogleAuth } from 'google-auth-library'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const SA_FILE   = path.resolve(process.cwd(), '.secrets/adcraft/gen-lang-client-0451612038-e5334eaf892b.json')
const PROJECT   = 'gen-lang-client-0451612038'
const LOCATION  = 'us-central1'
const MODEL     = 'veo-3.0-fast-generate-001'

;(async () => {
  const auth   = new GoogleAuth({ keyFile: SA_FILE, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const token  = (await client.getAccessToken()).token!

  console.log('=== Teste Vertex AI — gen-lang-client-0451612038 ===')
  console.log('SA file:', SA_FILE)
  console.log()

  // 1. Vertex AI API habilitada?
  console.log('1) Testando Vertex AI API...')
  const r1 = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const b1 = await r1.text()
  if (r1.ok) {
    console.log('  ✅ Vertex AI API acessível')
    try {
      const m = JSON.parse(b1)
      const veo = (m.publisherModels || []).filter((x: any) => x.name?.includes('veo'))
      console.log('  Modelos Veo:', veo.length ? veo.map((x: any) => x.name.split('/').pop()).join(', ') : '(nenhum visível)')
    } catch { console.log('  (resposta não-JSON)') }
  } else {
    console.log('  ❌ Status:', r1.status)
    console.log('  Detalhe:', b1.slice(0, 300))
  }
  console.log()

  // 2. Veo 3 predictLongRunning
  console.log('2) Testando Veo 3 predictLongRunning...')
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1beta/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`
  const r2 = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ instances: [{ prompt: 'test woman speaking to camera, 5 seconds' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  const b2 = await r2.text()
  if (r2.ok) {
    const op = JSON.parse(b2)
    console.log('  ✅ Operação criada:', op.name)

    // 3. Polling com fetchPredictLongRunningOperation
    console.log('\n3) Testando polling (fetchPredictLongRunningOperation)...')
    const modelPath = `projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}`
    const pollEndpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1beta/${modelPath}:fetchPredictLongRunningOperation`
    const r3 = await fetch(pollEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ operationName: op.name }),
    })
    const b3 = await r3.text()
    if (r3.ok) {
      const poll = JSON.parse(b3)
      console.log('  ✅ Polling funciona! done:', poll.done, '— status:', poll.metadata?.state ?? 'processando')
    } else {
      console.log('  ❌ Polling status:', r3.status, b3.slice(0, 200))
    }
  } else {
    console.log('  ❌ Status:', r2.status)
    console.log('  Detalhe:', b2.slice(0, 400))
  }
})().catch(e => console.error('Erro:', e.message))
