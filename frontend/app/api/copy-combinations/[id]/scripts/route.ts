// GET /api/copy-combinations/:id/scripts
// Retorna artefatos criativos (script, character, keyframes, video_assets) de uma combinação.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const [{ data: combo }, { data: artifacts }] = await Promise.all([
    supabase
      .from('copy_combinations')
      .select('id, tag, script_status')
      .eq('id', id)
      .single(),
    supabase
      .from('product_knowledge')
      .select('id, artifact_type, artifact_data, created_at')
      .eq('copy_combination_id', id)
      .eq('status', 'fresh')
      .order('created_at', { ascending: true }),
  ])

  if (!combo) {
    return NextResponse.json({ error: 'Combinação não encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    combination_id: id,
    tag: combo.tag,
    script_status: combo.script_status,
    artifacts: artifacts ?? [],
  })
}
