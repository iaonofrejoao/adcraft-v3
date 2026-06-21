import * as dotenv from 'dotenv'
import * as path from 'path'
import { getBearerToken, getProjectId } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

;(async () => {
  const token     = await getBearerToken()
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || await getProjectId()
  console.log('Project:', projectId)

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-001:predictLongRunning`
  console.log('Endpoint:', endpoint)

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })

  const body = await res.text()
  console.log('Status:', res.status)
  console.log('Body:', body.slice(0, 800))
})().catch(e => console.error('Erro:', e.message))
