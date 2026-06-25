// GET /api/canvas/[canvasId] — canvas completo com nodes + edges + outputs
// IMPORTANTE: Supabase JS usa fetch internamente. No Next.js 14 App Router, o fetch
// das Route Handlers pode ser cacheado pelo Data Cache. Passamos cache:'no-store'
// explicitamente para garantir dados sempre frescos do banco.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: { canvasId: string } },
) {
  const { canvasId } = params
  const supabase = getServiceClient()

  const [canvasRes, nodesRes, edgesRes] = await Promise.all([
    supabase
      .from('creative_canvases')
      .select('id, product_id, copy_combination_id, created_at, copy_combinations(full_text)')
      .eq('id', canvasId)
      .maybeSingle(),
    supabase
      .from('canvas_nodes')
      .select(`
        id, type, label, position_x, position_y, prompt, config, generation_status, error_message,
        canvas_node_outputs(id, output_type, drive_file_id, drive_url, is_active, created_at)
      `)
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true }),
    supabase
      .from('canvas_edges')
      .select('id, source_node_id, target_node_id')
      .eq('canvas_id', canvasId),
  ])

  if (canvasRes.error) return NextResponse.json({ error: canvasRes.error.message }, { status: 500 })
  if (!canvasRes.data) return NextResponse.json({ error: 'Canvas não encontrado' }, { status: 404 })

  const canvas    = canvasRes.data
  const comboText = (canvas.copy_combinations as { full_text?: string | null } | null)?.full_text ?? null

  // Garante que o copy node sempre tem o full_text da combinação,
  // mesmo em canvases criados antes de guardarmos o prompt nele.
  const nodes = (nodesRes.data ?? []).map(n => {
    if (n.type === 'copy' && !n.prompt && comboText) {
      return { ...n, prompt: comboText }
    }
    return n
  })

  return NextResponse.json(
    {
      canvas: { id: canvas.id, product_id: canvas.product_id, copy_combination_id: canvas.copy_combination_id, created_at: canvas.created_at },
      nodes,
      edges: edgesRes.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
