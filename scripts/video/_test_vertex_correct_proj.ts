import * as dotenv from 'dotenv'
import * as path from 'path'
import { GoogleAuth } from 'google-auth-library'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Projeto com billing confirmado no screenshot
const CORRECT_PROJECT = 'gen-lang-client-0171026476'
const LOCATION        = 'us-central1'
const MODEL           = 'veo-3.0-fast-generate-001'

const SA_FILES = [
  '.secrets/adcraft/gen-lang-client-0451612038-e5334eaf892b.json',
  '.secrets/adcraft/my-first-project-sa.json.json',
]

;(async () => {
  console.log(`Testando projeto com billing: ${CORRECT_PROJECT}\n`)

  for (const saFile of SA_FILES) {
    const resolvedFile = path.resolve(process.cwd(), saFile)
    const auth   = new GoogleAuth({ keyFile: resolvedFile, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = (await client.getAccessToken()).token!

    console.log(`SA: ${saFile.split('/').pop()}`)

    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${CORRECT_PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
    })
    const body = await r.text()
    if (r.ok) {
      const op = JSON.parse(body)
      console.log(`  ✅ Operação criada: ${op.name}`)

      // Testar polling imediatamente
      await new Promise(res => setTimeout(res, 2000))
      const modelPath = op.name.split('/operations/')[0]
      const pollUrl   = `https://${LOCATION}-aiplatform.googleapis.com/v1/${modelPath}:fetchPredictLongRunningOperation`
      const pr = await fetch(pollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ operationName: op.name }),
      })
      const pb = await pr.text()
      if (pr.ok) {
        const poll = JSON.parse(pb)
        console.log(`  ✅ POLLING OK — done:${poll.done} state:${poll.metadata?.state ?? 'processando'}`)
      } else if (pb.startsWith('<!')) {
        console.log(`  ❌ Polling 404 HTML`)
      } else {
        console.log(`  ❌ Polling ${pr.status} — ${JSON.parse(pb).error?.message?.slice(0,100)}`)
      }
    } else if (body.startsWith('<!')) {
      console.log(`  ❌ 404 HTML`)
    } else {
      try { console.log(`  ❌ ${r.status} — ${JSON.parse(body).error?.message?.slice(0,100)}`) }
      catch { console.log(`  ❌ ${r.status}`) }
    }
    console.log()
  }
})().catch(e => console.error('Erro:', e.message))
