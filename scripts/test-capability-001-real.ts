import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { getAuthHeaders, getProjectId } from './video/google-auth'
import { uploadToCanvasFolder } from '../workers/lib/canvas/drive-upload'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const LOCATION = 'us-central1'
const MODEL    = 'imagen-3.0-capability-001'

async function main() {
  const projectId = await getProjectId()
  const endpoint  = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`

  // Carrega imagem real do personagem
  console.log('Carregando imagem do personagem...')
  const { data: output } = await sb
    .from('canvas_node_outputs')
    .select('drive_url')
    .eq('node_id', 'df909972-9e19-4b15-b9f5-f4331b9f829d')
    .eq('is_active', true)
    .maybeSingle()

  const proxyRes = await fetch(`http://localhost:3000/api/drive-image?url=${encodeURIComponent(output!.drive_url!)}`)
  const refBuf   = Buffer.from(await proxyRes.arrayBuffer())
  const refB64   = refBuf.toString('base64')
  console.log(`✓ Imagem carregada: ${refBuf.length} bytes`)

  const prompt = 'White American woman, early 40s, wavy brown hair, sage green sweatshirt, sitting at kitchen table looking worried at phone, UGC selfie style, photorealistic, vertical frame'

  console.log(`\nGerando frame com subject reference via ${MODEL}...`)
  const start = Date.now()

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      instances: [{
        prompt,
        referenceImages: [{
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: 1,
          referenceImage: { bytesBase64Encoded: refB64 },
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        }],
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '9:16',
        personGeneration: 'allow_adult',
        safetySetting: 'block_few',
      },
    }),
  })

  const text = await res.text()

  if (!res.ok) {
    console.error(`✗ ${res.status}: ${text.slice(0, 400)}`)
    return
  }

  const data   = JSON.parse(text)
  const b64    = data.predictions?.[0]?.bytesBase64Encoded
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✓ Imagem gerada em ${elapsed}s — ${b64?.length} chars base64`)

  // Salva no banco para visualizar no canvas
  const imgBuf = Buffer.from(b64, 'base64')
  const { data: canvas } = await sb.from('creative_canvases').select('copy_combination_id, products(sku)').eq('id', '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31').single()
  const sku = (canvas as any)?.products?.sku ?? 'SUEA'
  const comboId = (canvas as any)?.copy_combination_id

  const { fileId, driveUrl } = await uploadToCanvasFolder(imgBuf, `frame_ref_${Date.now()}.png`, 'image/png', sku, comboId, 'frames')
  console.log(`✓ Drive URL: ${driveUrl}`)

  // Busca um frame node sem output ainda
  const { data: frames } = await sb
    .from('canvas_nodes')
    .select('id, canvas_node_outputs(id)')
    .eq('canvas_id', '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31')
    .eq('type', 'frame')

  const emptyFrame = (frames as any[])?.find(f => f.canvas_node_outputs?.length === 0)
  if (emptyFrame) {
    await sb.from('canvas_node_outputs').insert({ node_id: emptyFrame.id, output_type: 'image', drive_file_id: fileId, drive_url: driveUrl, is_active: true })
    await sb.from('canvas_nodes').update({ generation_status: 'done', error_message: null, updated_at: new Date().toISOString() }).eq('id', emptyFrame.id)
    console.log(`✓ Salvo no frame ${emptyFrame.id}`)
  }

  console.log('\n✅ Sucesso! Recarregue o canvas para ver o frame gerado com referência do personagem.')
}

main().catch(console.error)
