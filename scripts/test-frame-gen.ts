/**
 * Testa geração de imagem para um nó frame — igual ao test-image-gen.ts para personagem.
 * Reproduz exatamente o que a rota POST /api/canvas/nodes/[nodeId]/generate faz.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { generateImage } from '../workers/lib/canvas/image-gen'
import { uploadToCanvasFolder } from '../workers/lib/canvas/drive-upload'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Primeiro frame do canvas
const CANVAS_ID   = '10c46ff7-e816-4ed9-8ffd-f0a7538b5c31'
const PERSONAGEM_NODE_ID = 'df909972-9e19-4b15-b9f5-f4331b9f829d'

async function main() {
  // 1. Busca o primeiro frame node
  const { data: nodes } = await sb
    .from('canvas_nodes')
    .select('id, type, prompt, config')
    .eq('canvas_id', CANVAS_ID)
    .eq('type', 'frame')
    .order('created_at', { ascending: true })
    .limit(1)

  const frame = nodes?.[0]
  if (!frame) { console.error('Nenhum frame encontrado'); process.exit(1) }

  console.log(`Frame ID  : ${frame.id}`)
  console.log(`Prompt    : ${String(frame.prompt ?? '(vazio)').slice(0, 120)}`)
  console.log(`Config    : ${JSON.stringify(frame.config)}`)

  // 2. Busca imagem do personagem como referência
  let referenceImageBuffer: Buffer | undefined
  console.log('\n── Buscando imagem de referência do personagem ──')

  const { data: personOutput } = await sb
    .from('canvas_node_outputs')
    .select('drive_url')
    .eq('node_id', PERSONAGEM_NODE_ID)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (personOutput?.drive_url) {
    console.log(`Drive URL personagem: ${personOutput.drive_url}`)
    const proxyUrl = `http://localhost:3000/api/drive-image?url=${encodeURIComponent(personOutput.drive_url)}`
    console.log(`Proxy URL: ${proxyUrl}`)
    const res = await fetch(proxyUrl)
    if (res.ok) {
      referenceImageBuffer = Buffer.from(await res.arrayBuffer())
      console.log(`✓ Referência carregada: ${referenceImageBuffer.length} bytes`)
    } else {
      console.log(`⚠ Proxy falhou: ${res.status} ${res.statusText}`)
      const text = await res.text()
      console.log(`  Body: ${text.slice(0, 300)}`)
    }
  } else {
    console.log('⚠ Nenhuma output ativa do personagem — gerando sem referência')
  }

  // 3. Gera a imagem
  const config = (frame.config ?? {}) as { count?: number; aspect_ratio?: string }
  const prompt = (frame.prompt as string | null) ?? ''
  const aspectRatio = config.aspect_ratio ?? '9:16'

  if (!prompt) { console.error('\n✗ Frame sem prompt — adicione um prompt antes de gerar'); process.exit(1) }

  console.log('\n── Gerando imagem do frame via Vertex AI ──')
  console.log(`Aspect ratio: ${aspectRatio}`)
  console.log(`Com referência: ${!!referenceImageBuffer}`)

  const start = Date.now()
  let buffers: Buffer[]
  try {
    buffers = await generateImage(prompt, { count: 1, aspectRatio, referenceImageBuffer })
    console.log(`✓ Imagem gerada em ${((Date.now() - start) / 1000).toFixed(1)}s — ${buffers[0].length} bytes`)
  } catch (err) {
    console.error(`\n✗ ERRO na geração: ${(err as Error).message}`)
    process.exit(1)
  }

  // 4. Busca info do canvas para upload
  const { data: canvas } = await sb
    .from('creative_canvases')
    .select('copy_combination_id, products(sku)')
    .eq('id', CANVAS_ID)
    .single()

  const sku           = (canvas as { products?: { sku?: string } })?.products?.sku ?? 'SUEA'
  const combinationId = (canvas as { copy_combination_id?: string })?.copy_combination_id ?? ''

  // 5. Upload Drive
  console.log('\n⏳ Upload para o Drive…')
  const filename = `frame_test_${Date.now()}.png`
  const { fileId, driveUrl } = await uploadToCanvasFolder(buffers[0], filename, 'image/png', sku, combinationId, 'frames')
  console.log(`✓ Drive URL: ${driveUrl}`)

  // 6. Salva no banco
  await sb.from('canvas_node_outputs').insert({
    node_id:       frame.id,
    output_type:   'image',
    drive_file_id: fileId,
    drive_url:     driveUrl,
    is_active:     true,
  })
  await sb.from('canvas_nodes').update({
    generation_status: 'done',
    error_message:     null,
    updated_at:        new Date().toISOString(),
  }).eq('id', frame.id)

  console.log(`\n✅ Frame ${frame.id} gerado com sucesso! Recarregue o canvas.`)
}

main().catch(err => { console.error('\n✗ ERRO inesperado:', err); process.exit(1) })
