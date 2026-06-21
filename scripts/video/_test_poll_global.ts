import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PROJECT  = 'project-54d7f8ac-f04d-48a5-a8f'
const LOCATION = 'us-central1'
const MODEL    = 'veo-3.0-fast-generate-001'

;(async () => {
  const headers = await getAuthHeaders()

  // Criar operação fresca
  const createUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`
  const cr = await fetch(createUrl, {
    method: 'POST', headers,
    body: JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  if (!cr.ok) { console.error('Falha criar:', cr.status); process.exit(1) }
  const op = await cr.json() as any
  const opName = op.name
  const opId   = opName.split('/').pop()
  console.log('Operação:', opName)

  await new Promise(r => setTimeout(r, 2000))

  const tests: Array<[string, string]> = [
    // Endpoint global (sem região no host)
    ['global  v1 GET fullName',   `https://aiplatform.googleapis.com/v1/${opName}`],
    ['global  v1 GET ops/{id}',   `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/operations/${opId}`],
    // Endpoint regional com número do projeto (não string)
    ['regional v1 GET fullName (project number)', `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/533101246050/locations/${LOCATION}/publishers/google/models/${MODEL}/operations/${opId}`],
    // Sem o publishers/google/models no path de GET
    ['regional v1 GET sem publishers', `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/operations/${opId}`],
    // com project number na operação
    ['regional v1 full GET num proj', `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/533101246050/locations/${LOCATION}/publishers/google/models/${MODEL}/operations/${opId}`],
  ]

  for (const [label, url] of tests) {
    const r = await fetch(url, { headers })
    const body = await r.text()
    let result = ''
    if (r.ok) {
      try { const j = JSON.parse(body); result = `✅ done:${j.done} state:${j.metadata?.state ?? '?'}` }
      catch { result = '✅ ' + body.slice(0,60) }
    } else if (body.startsWith('<!')) {
      result = `❌ ${r.status} HTML`
    } else {
      try { result = `❌ ${r.status} — ${JSON.parse(body).error?.message?.slice(0,90)}` }
      catch { result = `❌ ${r.status}` }
    }
    console.log(`  ${label}: ${result}`)
  }
})().catch(e => console.error('Erro:', e.message))
