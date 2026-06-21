import * as dotenv from 'dotenv'
import * as path from 'path'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const OP_ID   = process.argv[2]!
const MODEL   = 'veo-3.0-fast-generate-001'
const BASE    = 'https://generativelanguage.googleapis.com/v1beta'
const OP_NAME = `models/${MODEL}/operations/${OP_ID}`

if (!OP_ID) { console.error('Usage: ... <op_id>'); process.exit(1) }

;(async () => {
  const headers = await getAuthHeaders()

  const tests: Array<[string, string, RequestInit]> = [
    // SDK @google/genai usa generateVideosOperation
    [`GET ${BASE}/models/${MODEL}:generateVideosOperation?operationName=${OP_NAME}`, `${BASE}/models/${MODEL}:generateVideosOperation?operationName=${OP_NAME}`, { headers }],
    // Variante POST
    [`POST generateVideosOperation`, `${BASE}/models/${MODEL}:generateVideosOperation`, { method: 'POST', headers, body: JSON.stringify({ operationName: OP_NAME }) }],
    // Tentar /v1 em vez de /v1beta
    [`GET v1 path`, `https://generativelanguage.googleapis.com/v1/${OP_NAME}`, { headers }],
    // Tentar projects/ prefix
    [`GET projects path`, `${BASE}/projects/project-54d7f8ac-f04d-48a5-a8f/${OP_NAME}`, { headers }],
    // Tentar sem model prefix
    [`GET only operations/id`, `${BASE}/operations/${OP_ID}`, { headers }],
  ]

  for (const [label, url, init] of tests) {
    const r = await fetch(url, init)
    const body = await r.text()
    console.log(`[${r.status}] ${label}`)
    if (r.ok || r.status !== 404) console.log('  Body:', body.slice(0, 150))
    console.log()
  }
})().catch(e => console.error('Erro:', e.message))
