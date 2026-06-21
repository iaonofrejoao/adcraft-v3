import * as dotenv from 'dotenv'
import * as path from 'path'
import { getBearerToken } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

;(async () => {
  const token = await getBearerToken()
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
  const model = 'veo-3.0-fast-generate-001'

  // Checar métodos suportados pelo modelo
  const modelRes = await fetch(`${GEMINI_BASE}/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const modelBody = await modelRes.json() as any
  console.log('supportedGenerationMethods:', modelBody.supportedGenerationMethods)
  console.log('description:', modelBody.description?.slice(0, 100))

  // Tentar predictLongRunning via Gemini API base URL
  console.log('\n--- Testando :predictLongRunning via Gemini API ---')
  const r1 = await fetch(`${GEMINI_BASE}/models/${model}:predictLongRunning`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  const b1 = await r1.text()
  console.log('Status:', r1.status, '| Body:', b1.slice(0, 300))

  // Tentar generateContent com video config
  console.log('\n--- Testando :generateContent com video modalities ---')
  const r2 = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      contents: [{ parts: [{ text: 'test short video' }] }],
      generationConfig: { responseModalities: ['video'], videoDuration: '5s' },
    }),
  })
  const b2 = await r2.text()
  console.log('Status:', r2.status, '| Body:', b2.slice(0, 300))

  // Tentar :generateVideo com formato correto (contents)
  console.log('\n--- Testando :generateVideo com contents ---')
  const r3 = await fetch(`${GEMINI_BASE}/models/${model}:generateVideo`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      prompt: { text: 'a person walking in a park' },
      generationConfig: { aspectRatio: '9:16' },
    }),
  })
  const b3 = await r3.text()
  console.log('Status:', r3.status, '| Body:', b3.slice(0, 300))
})().catch(e => console.error('Erro:', e.message))
