import * as dotenv from 'dotenv'
import * as path from 'path'
import { GoogleAuth } from 'google-auth-library'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const SA_FILES = [
  { file: '.secrets/adcraft/gen-lang-client-0451612038-e5334eaf892b.json', project: 'gen-lang-client-0451612038' },
  { file: '.secrets/adcraft/my-first-project-sa.json.json', project: 'project-54d7f8ac-f04d-48a5-a8f' },
]
const LOCATION = 'us-central1'
const MODELS   = ['veo-3.0-fast-generate-001', 'veo-3.0-generate-001', 'veo-2.0-generate-001']
const VERSIONS = ['v1', 'v1beta']

;(async () => {
  for (const { file, project } of SA_FILES) {
    const resolvedFile = path.resolve(process.cwd(), file)
    const auth   = new GoogleAuth({ keyFile: resolvedFile, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = (await client.getAccessToken()).token!

    console.log(`\n=== ${project} ===`)

    for (const ver of VERSIONS) {
      for (const model of MODELS) {
        const url = `https://${LOCATION}-aiplatform.googleapis.com/${ver}/projects/${project}/locations/${LOCATION}/publishers/google/models/${model}:predictLongRunning`
        const r = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
        })
        const body = await r.text()
        let result = ''
        if (r.ok) {
          result = '✅ FUNCIONOU: ' + body.slice(0, 80)
        } else if (body.startsWith('<!')) {
          result = '❌ 404 HTML'
        } else {
          try { result = `❌ ${r.status} — ${JSON.parse(body).error?.message?.slice(0,100)}` }
          catch { result = `❌ ${r.status}` }
        }
        console.log(`  ${ver}/${model}: ${result}`)
        if (r.ok) break
      }
    }
  }
})().catch(e => console.error('Erro:', e.message))
