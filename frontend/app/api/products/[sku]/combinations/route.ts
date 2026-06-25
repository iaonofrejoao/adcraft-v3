// GET /api/products/[sku]/combinations — lista copy_combinations com status de canvas

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function GET(
  _req: Request,
  { params }: { params: { sku: string } },
) {
  const { sku } = params
  const supabase = getServiceClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product)     return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const { data: combinations, error } = await supabase
    .from('copy_combinations')
    .select('id, tag, full_text, script_status, created_at')
    .eq('product_id', product.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!combinations || combinations.length === 0) {
    return NextResponse.json({ combinations: [] })
  }

  // Buscar canvases existentes para essas combinações
  const comboIds = combinations.map(c => c.id)
  const { data: canvases } = await supabase
    .from('creative_canvases')
    .select('id, copy_combination_id')
    .in('copy_combination_id', comboIds)

  const canvasMap = Object.fromEntries((canvases ?? []).map(c => [c.copy_combination_id, [{ id: c.id }]]))

  const result = combinations.map(combo => ({
    ...combo,
    creative_canvases: canvasMap[combo.id] ?? [],
  }))

  return NextResponse.json({ combinations: result })
}
