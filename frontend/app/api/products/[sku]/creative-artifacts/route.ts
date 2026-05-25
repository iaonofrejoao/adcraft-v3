// GET /api/products/:sku/creative-artifacts?type=script|character|keyframes|video_assets
// Retorna artefatos criativos gerados por combinação (copy_combination_id IS NOT NULL).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

const ALLOWED_TYPES = ['script', 'character', 'keyframes', 'video_assets'] as const
type ArtifactType = typeof ALLOWED_TYPES[number]

export async function GET(
  req: Request,
  { params }: { params: { sku: string } },
) {
  const { sku } = params
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ArtifactType | null

  if (type && !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type inválido. Use: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = getServiceClient()

  // Resolve product_id from sku
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  let query = supabase
    .from('product_knowledge')
    .select(`
      id,
      artifact_type,
      artifact_data,
      copy_combination_id,
      source_pipeline_id,
      created_at,
      copy_combinations:copy_combination_id (tag, script_status)
    `)
    .eq('product_id', product.id)
    .eq('status', 'fresh')
    .not('copy_combination_id', 'is', null)
    .order('created_at', { ascending: false })

  if (type) {
    query = query.eq('artifact_type', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ artifacts: data ?? [] })
}
