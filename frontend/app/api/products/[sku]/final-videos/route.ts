// GET  /api/products/[sku]/final-videos
//      Retorna final_videos do produto + status da persona.
// POST /api/products/[sku]/final-videos
//      Body: { copy_combination_id: string }
//      Cria um final_video com status 'queued'.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key não configurado')
  return createClient(url, key)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveProductId(supabase: ReturnType<typeof createClient>, sku: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error(`Produto não encontrado: ${sku}`)
  return (data as { id: string }).id
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sku: string } },
) {
  try {
    const supabase = getServiceClient()
    const productId = await resolveProductId(supabase, params.sku)

    const [videosResult, personaResult] = await Promise.all([
      supabase
        .from('final_videos')
        .select(
          'id, product_id, pipeline_id, copy_combination_id, status, progress_step, ' +
          'video_url, thumbnail_url, duration_seconds, error_message, created_at, completed_at, ' +
          'composition_config',
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false }),

      supabase
        .from('persona_assets')
        .select('status')
        .eq('product_id', productId)
        .eq('status', 'ready')
        .maybeSingle(),
    ])

    if (videosResult.error) throw new Error(videosResult.error.message)

    // Extrai IDs dos tiktok_videos usados e limpa composition_config da resposta
    type RawVideo = Record<string, unknown>
    type ClipEntry = { tiktok_video_id?: string }
    type ConfigShape = { clips?: ClipEntry[] }

    const usedTikTokIds: string[] = []
    const videos: RawVideo[] = []

    for (const v of (videosResult.data ?? []) as unknown as RawVideo[]) {
      const config = v.composition_config as ConfigShape | null
      if (config?.clips) {
        for (const clip of config.clips) {
          if (clip.tiktok_video_id) usedTikTokIds.push(clip.tiktok_video_id)
        }
      }
      const { composition_config: _cc, ...rest } = v
      videos.push(rest)
    }

    return NextResponse.json({
      videos,
      persona_ready:    personaResult.data != null,
      product_id:       productId,
      used_tiktok_ids:  [...new Set(usedTikTokIds)],
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sku: string } },
) {
  try {
    const body = await req.json() as { copy_combination_id?: string }
    const combinationId = body.copy_combination_id

    if (!combinationId || !UUID_RE.test(combinationId)) {
      return NextResponse.json(
        { error: 'copy_combination_id inválido ou ausente' },
        { status: 400 },
      )
    }

    const supabase  = getServiceClient()
    const productId = await resolveProductId(supabase, params.sku)

    // Deriva pipeline_id da combinação
    const { data: combo, error: comboErr } = await supabase
      .from('copy_combinations')
      .select('pipeline_id')
      .eq('id', combinationId)
      .eq('product_id', productId)
      .maybeSingle()

    if (comboErr) throw new Error(comboErr.message)
    if (!combo)   throw new Error('Combinação não encontrada ou não pertence a este produto')

    // Evita duplicatas: se já existe um registro não-failed para essa combinação, retorná-lo
    const { data: existing } = await supabase
      .from('final_videos')
      .select('id, status')
      .eq('product_id', productId)
      .eq('copy_combination_id', combinationId)
      .not('status', 'eq', 'failed')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ video: existing, already_queued: true })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('final_videos')
      .insert({
        product_id:          productId,
        pipeline_id:         (combo as { pipeline_id: string | null }).pipeline_id ?? null,
        copy_combination_id: combinationId,
        status:              'queued',
      })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json({ video: inserted }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
