import * as dotenv from 'dotenv'
import * as path from 'path'
import { getBearerToken, getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Testa diferentes formas de polling da LRO Gemini API
// Substitua op_id com uma operação recente criada pelo generate-scenes
const OP_ID   = process.argv[2]!
const MODEL   = 'veo-3.0-fast-generate-001'
const BASE    = 'https://generativelanguage.googleapis.com/v1beta'
const OP_NAME = `models/${MODEL}/operations/${OP_ID}`

if (!OP_ID) {
  console.error('Usage: npx tsx _test_lro_poll.ts <operation_id>')
  process.exit(1)
}

;(async () => {
  const apiKey = process.env.GEMINI_API_KEY
  const token  = await getBearerToken()
  console.log('Operation name:', OP_NAME)
  console.log('API Key defined:', !!apiKey)

  // Tentativa 1: GET com Bearer token
  console.log('\n1) GET com Bearer token')
  const r1 = await fetch(`${BASE}/${OP_NAME}`, { headers: { Authorization: `Bearer ${token}` } })
  console.log('Status:', r1.status, '|', (await r1.text()).slice(0, 200))

  // Tentativa 2: GET com API key
  if (apiKey) {
    console.log('\n2) GET com API key')
    const r2 = await fetch(`${BASE}/${OP_NAME}?key=${apiKey}`)
    console.log('Status:', r2.status, '|', (await r2.text()).slice(0, 200))
  }

  // Tentativa 3: POST waitOperation com Bearer
  console.log('\n3) POST :wait com Bearer token')
  const r3 = await fetch(`${BASE}/${OP_NAME}:wait`, {
    method:  'POST',
    headers: await getAuthHeaders(),
    body:    JSON.stringify({ timeout: '10s' }),
  })
  console.log('Status:', r3.status, '|', (await r3.text()).slice(0, 200))

  // Tentativa 4: POST :wait com API key
  if (apiKey) {
    console.log('\n4) POST :wait com API key')
    const r4 = await fetch(`${BASE}/${OP_NAME}:wait?key=${apiKey}`, {
      method: 'POST',
      body:   JSON.stringify({ timeout: '10s' }),
    })
    console.log('Status:', r4.status, '|', (await r4.text()).slice(0, 200))
  }

  // Tentativa 5: GET /v1beta/operations/{id} (sem model path)
  console.log('\n5) GET /v1beta/operations/{id} com Bearer')
  const r5 = await fetch(`${BASE}/operations/${OP_ID}`, { headers: { Authorization: `Bearer ${token}` } })
  console.log('Status:', r5.status, '|', (await r5.text()).slice(0, 200))
})().catch(e => console.error('Erro:', e.message))
