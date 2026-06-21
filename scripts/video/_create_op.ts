import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { getAuthHeaders } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

;(async () => {
  const BASE  = 'https://generativelanguage.googleapis.com/v1beta'
  const MODEL = 'veo-3.0-fast-generate-001'
  const imgBuf = fs.readFileSync('C:/Videos/AdCraft/personas/SUEA/board-1.png')

  const body = {
    instances: [{
      prompt: 'test woman speaking to camera',
      image:  { bytesBase64Encoded: imgBuf.toString('base64'), mimeType: 'image/png' },
    }],
    parameters: { aspectRatio: '9:16', sampleCount: 1 },
  }

  const res = await fetch(`${BASE}/models/${MODEL}:predictLongRunning`, {
    method:  'POST',
    headers: await getAuthHeaders(),
    body:    JSON.stringify(body),
  })
  const data = await res.json() as any
  console.log('Status:', res.status)
  console.log('Operation:', JSON.stringify(data))
  if (data.name) {
    const opId = data.name.split('/').pop()
    console.log('\nOperation ID:', opId)
    console.log('\nRode: npx tsx --env-file=.env scripts/video/_test_lro_poll.ts', opId)
  }
})().catch(e => console.error('Erro:', e.message))
