import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!
const LOCATION = 'us-central1'
const MODEL    = 'veo-3.0-fast-generate-001'
const BASE     = `https://${LOCATION}-aiplatform.googleapis.com/v1`

;(async () => {
  const headers = await getAuthHeaders()
  console.log('Project:', PROJECT)

  // Criar operação
  const cr = await fetch(`${BASE}/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`, {
    method: 'POST', headers,
    body: JSON.stringify({ instances: [{ prompt: 'test woman speaking to camera' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  const op     = await cr.json() as any
  const opName = op.name
  const resourceName = opName.split('/operations/')[0]
  console.log('Operação:', opName)
  console.log()

  await new Promise(r => setTimeout(r, 3000))

  // Endpoint correto: fetchPredictOperation (sem LongRunning)
  const pollUrl = `${BASE}/${resourceName}:fetchPredictOperation`
  console.log('Polling URL:', pollUrl)

  const pr = await fetch(pollUrl, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ operationName: opName }),
  })
  const pb = await pr.text()
  if (pr.ok) {
    const poll = JSON.parse(pb)
    console.log('✅ POLLING FUNCIONOU!')
    console.log('done:', poll.done)
    console.log('state:', poll.metadata?.state ?? poll.metadata?.genericMetadata?.state ?? '(processando)')
  } else if (pb.startsWith('<!')) {
    console.log('❌ 404 HTML')
  } else {
    try { console.log('❌', pr.status, '—', JSON.parse(pb).error?.message?.slice(0,150)) }
    catch { console.log('❌', pr.status, pb.slice(0,200)) }
  }
})().catch(e => console.error('Erro:', e.message))
