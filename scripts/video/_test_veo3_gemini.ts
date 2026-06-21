import * as dotenv from 'dotenv'
import * as path from 'path'
import { getBearerToken } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Testa se Veo 3 está acessível via Gemini API (generativelanguage.googleapis.com)
// com o mesmo service account que funciona para Nano Banana
;(async () => {
  const token = await getBearerToken()
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

  // Listar modelos disponíveis para ver se veo está acessível
  const listRes = await fetch(`${GEMINI_BASE}/models?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listBody = await listRes.text()
  console.log('List models status:', listRes.status)

  if (listRes.ok) {
    const models = JSON.parse(listBody)
    const veoModels = (models.models || []).filter((m: any) => m.name?.includes('veo'))
    console.log('Veo models encontrados:', veoModels.map((m: any) => m.name))
  } else {
    console.log('Erro ao listar modelos:', listBody.slice(0, 300))
  }

  // Tentar chamada direta de geração de vídeo via Gemini API
  const model = 'veo-3.0-fast-generate-001'
  const endpoint = `${GEMINI_BASE}/models/${model}:generateVideo`
  console.log('\nTestando endpoint:', endpoint)

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ prompt: 'test', aspectRatio: '9:16', personGeneration: 'allow_adult' }),
  })

  const body = await res.text()
  console.log('Status:', res.status)
  console.log('Body:', body.slice(0, 600))
})().catch(e => console.error('Erro:', e.message))
