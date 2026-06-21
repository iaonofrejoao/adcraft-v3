import * as dotenv from 'dotenv'
import * as path from 'path'
import { GoogleAuth } from 'google-auth-library'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Testa os dois SA files em múltiplas regiões e versões da API
const SA_FILES = [
  { file: '.secrets/adcraft/gen-lang-client-0451612038-e5334eaf892b.json', project: 'gen-lang-client-0451612038' },
  { file: '.secrets/adcraft/my-first-project-sa.json.json', project: 'project-54d7f8ac-f04d-48a5-a8f' },
]
const LOCATIONS = ['us-central1', 'us-east1', 'us-east4', 'us-west1', 'europe-west4', 'global']
const MODEL = 'veo-3.0-fast-generate-001'

;(async () => {
  for (const { file, project } of SA_FILES) {
    const resolvedFile = path.resolve(process.cwd(), file)
    const auth   = new GoogleAuth({ keyFile: resolvedFile, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = (await client.getAccessToken()).token!

    console.log(`\n=== SA: ${file.split('/').pop()} | project: ${project} ===`)

    for (const loc of LOCATIONS) {
      if (loc === 'global') continue // skip for now
      const url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${project}/locations/${loc}/publishers/google/models/${MODEL}`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const body = await r.text()
      let detail = ''
      if (r.ok) {
        detail = '✅ FUNCIONOU'
      } else if (body.startsWith('<!')) {
        detail = '❌ 404 HTML (API não habilitada ou projeto inexistente)'
      } else {
        try {
          const err = JSON.parse(body)
          detail = `❌ ${r.status} — ${err.error?.message?.slice(0,100)}`
        } catch { detail = `❌ ${r.status}` }
      }
      console.log(`  ${loc}: ${detail}`)
      if (r.ok) break
    }

    // Testar também a URL de list de modelos do projeto
    const listUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-central1/models?pageSize=1`
    const rl = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })
    const bl = await rl.text()
    if (rl.ok) {
      console.log(`  [list-models] ✅ Vertex AI API habilitada no projeto`)
    } else if (bl.startsWith('<!')) {
      console.log(`  [list-models] ❌ API não habilitada (HTML 404)`)
    } else {
      try {
        const err = JSON.parse(bl)
        console.log(`  [list-models] ${rl.status} — ${err.error?.message?.slice(0,120)}`)
      } catch { console.log(`  [list-models] ❌ ${rl.status}`) }
    }
  }
})().catch(e => console.error('Erro:', e.message))
