/**
 * Debug granular do subject reference — imprime body exato e testa variações de formato.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { getAuthHeaders, getProjectId } from './video/google-auth'
import * as https from 'https'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const LOCATION = 'us-central1'

async function post(endpoint: string, body: object) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) }
}

async function main() {
  const projectId = await getProjectId()
  console.log('Project ID:', projectId)

  // Carrega imagem de referência (reduzida)
  const { data: output } = await sb
    .from('canvas_node_outputs')
    .select('drive_url')
    .eq('node_id', 'df909972-9e19-4b15-b9f5-f4331b9f829d')
    .eq('is_active', true)
    .maybeSingle()

  const proxyRes = await fetch(`http://localhost:3000/api/drive-image?url=${encodeURIComponent(output!.drive_url!)}`)
  const imgBuf = Buffer.from(await proxyRes.arrayBuffer())
  console.log(`Imagem: ${imgBuf.length} bytes`)

  // Reduz via resize simples (pega só os primeiros 200KB para testar limite de tamanho)
  const refB64Full = imgBuf.toString('base64')
  // Também testa com imagem menor — usa apenas 100KB da imagem original
  const smallBuf = imgBuf.subarray(0, Math.min(imgBuf.length, 100_000))
  const refB64Small = smallBuf.toString('base64')

  const prompt = 'Woman in kitchen holding phone, UGC selfie, photorealistic'
  const base = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models`

  // Variação 1: formato padrão com imagem completa
  console.log('\n--- Var 1: imagen-3.0-capability-001 + imagem completa ---')
  const r1 = await post(`${base}/imagen-3.0-capability-001:predict`, {
    instances: [{ prompt, referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: refB64Full } }] }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  })
  console.log(r1.status, r1.ok ? 'OK' : r1.body)

  // Variação 2: sem subjectImageConfig
  console.log('\n--- Var 2: sem subjectImageConfig ---')
  const r2 = await post(`${base}/imagen-3.0-capability-001:predict`, {
    instances: [{ prompt, referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', image: { bytesBase64Encoded: refB64Full } }] }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  })
  console.log(r2.status, r2.ok ? 'OK' : r2.body)

  // Variação 3: mimeType explícito
  console.log('\n--- Var 3: com mimeType: image/png ---')
  const r3 = await post(`${base}/imagen-3.0-capability-001:predict`, {
    instances: [{ prompt, referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: refB64Full, mimeType: 'image/png' } }] }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  })
  console.log(r3.status, r3.ok ? 'OK' : r3.body)

  // Variação 4: imagem como gcsUri placeholder (para ver se o erro muda)
  console.log('\n--- Var 4: referenceType RAW (sem referência de subject) ---')
  const r4 = await post(`${base}/imagen-3.0-capability-001:predict`, {
    instances: [{ prompt, referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_RAW', image: { bytesBase64Encoded: refB64Full } }] }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  })
  console.log(r4.status, r4.ok ? 'OK' : r4.body)

  // Variação 5: body exato impresso para inspecionar
  const bodyToLog = {
    instances: [{ prompt, referenceImages: [{ referenceId: 1, referenceType: 'REFERENCE_TYPE_SUBJECT', subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' }, image: { bytesBase64Encoded: 'BASE64_TRUNCATED' } }] }],
    parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
  }
  console.log('\n--- Body exato enviado (com base64 truncado) ---')
  console.log(JSON.stringify(bodyToLog, null, 2))
}

main().catch(console.error)
