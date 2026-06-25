// POST /api/canvas/nodes/[nodeId]/generate
// Dispara geração de imagem (Nano Banana) ou vídeo (Veo 3) para um nó.
// Roda de forma fire-and-forget: seta status 'generating' e retorna 202.
// A lib de geração atualiza status e cria outputs ao concluir.

export const runtime = 'nodejs'
export const maxDuration = 900 // 15 min

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateImage } from '../../../../../../../workers/lib/canvas/image-gen'
import { generateVideo } from '../../../../../../../workers/lib/canvas/video-gen'
import { uploadToCanvasFolder } from '../../../../../../../workers/lib/canvas/drive-upload'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

const IMAGE_TYPES = new Set(['personagem', 'cenario', 'produto', 'adicional', 'frame'])

async function runGeneration(nodeId: string) {
  const supabase = getServiceClient()

  // Buscar nó + canvas
  const { data: node } = await supabase
    .from('canvas_nodes')
    .select('id, canvas_id, type, prompt, config')
    .eq('id', nodeId)
    .single()

  if (!node) throw new Error('Nó não encontrado')

  const { data: canvas } = await supabase
    .from('creative_canvases')
    .select('id, copy_combination_id, product_id, products(sku)')
    .eq('id', node.canvas_id)
    .single()

  if (!canvas) throw new Error('Canvas não encontrado')

  const sku           = (canvas as { products?: { sku?: string } }).products?.sku ?? 'unknown'
  const combinationId = canvas.copy_combination_id as string
  const config        = (node.config ?? {}) as { count?: number; aspect_ratio?: string; scene_index?: number }
  const prompt        = (node.prompt as string | null) ?? ''

  // Buscar outputs ativos dos nós que conectam NESTE nó
  const { data: inEdges } = await supabase
    .from('canvas_edges')
    .select('source_node_id')
    .eq('target_node_id', nodeId)

  let firstFrameBuffer:     Buffer | undefined
  let referenceImageBuffer: Buffer | undefined

  if (inEdges && inEdges.length > 0) {
    const sourceIds = inEdges.map((e: { source_node_id: string }) => e.source_node_id)
    const { data: sourceNodes } = await supabase
      .from('canvas_nodes')
      .select('id, type')
      .in('id', sourceIds)

    // Vídeo: busca frame conectado como primeiro frame
    if (node.type === 'video') {
      const frameSource = sourceNodes?.find((n: { type: string }) => n.type === 'frame')
      if (frameSource) {
        const { data: activeOutput } = await supabase
          .from('canvas_node_outputs')
          .select('drive_url')
          .eq('node_id', frameSource.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (activeOutput?.drive_url) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/drive-image?url=${encodeURIComponent(activeOutput.drive_url)}`)
          if (res.ok) firstFrameBuffer = Buffer.from(await res.arrayBuffer())
        }
      }
    }

    // Frame: busca personagem conectado como imagem de referência
    if (node.type === 'frame') {
      const personagemSource = sourceNodes?.find((n: { type: string }) => n.type === 'personagem')
      if (personagemSource) {
        const { data: activeOutput } = await supabase
          .from('canvas_node_outputs')
          .select('drive_url')
          .eq('node_id', personagemSource.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (activeOutput?.drive_url) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/drive-image?url=${encodeURIComponent(activeOutput.drive_url)}`)
          if (res.ok) referenceImageBuffer = Buffer.from(await res.arrayBuffer())
        }
      }
    }
  }

  if (IMAGE_TYPES.has(node.type)) {
    const count       = config.count ?? 1
    const aspectRatio = config.aspect_ratio ?? '1:1'
    const buffers     = await generateImage(prompt, { count, aspectRatio, referenceImageBuffer })

    for (let i = 0; i < buffers.length; i++) {
      const filename = `${node.type}_${Date.now()}_${i + 1}.png`
      const { fileId, driveUrl } = await uploadToCanvasFolder(buffers[i], filename, 'image/png', sku, combinationId, node.type + 's')
      await supabase.from('canvas_node_outputs').insert({
        node_id:       nodeId,
        output_type:   'image',
        drive_file_id: fileId,
        drive_url:     driveUrl,
        is_active:     i === 0,
      })
    }

    await supabase
      .from('canvas_nodes')
      .update({ generation_status: 'done', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', nodeId)

  } else if (node.type === 'video') {
    const aspectRatio = (config.aspect_ratio ?? '9:16') as '9:16' | '1:1' | '16:9'
    const buffer = await generateVideo(prompt, { aspectRatio, firstFrameBuffer })

    const filename = `video_${Date.now()}.mp4`
    const { fileId, driveUrl } = await uploadToCanvasFolder(buffer, filename, 'video/mp4', sku, combinationId, 'videos')
    await supabase.from('canvas_node_outputs').insert({
      node_id:       nodeId,
      output_type:   'video',
      drive_file_id: fileId,
      drive_url:     driveUrl,
      is_active:     true,
    })

    await supabase
      .from('canvas_nodes')
      .update({ generation_status: 'done', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', nodeId)
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { nodeId: string } },
) {
  const { nodeId } = params
  const supabase = getServiceClient()

  // Seta gerando imediatamente
  await supabase
    .from('canvas_nodes')
    .update({ generation_status: 'generating', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', nodeId)

  // Fire-and-forget — geração pode levar minutos
  runGeneration(nodeId).catch(async (err) => {
    const supabase2 = getServiceClient()
    await supabase2
      .from('canvas_nodes')
      .update({
        generation_status: 'error',
        error_message:     String(err?.message ?? err),
        updated_at:        new Date().toISOString(),
      })
      .eq('id', nodeId)
  })

  return NextResponse.json({ status: 'generating' }, { status: 202 })
}
