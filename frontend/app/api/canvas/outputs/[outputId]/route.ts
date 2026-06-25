// PATCH /api/canvas/outputs/[outputId] — toggle is_active
// DELETE /api/canvas/outputs/[outputId] — remove output + arquivo do Drive

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteFile } from '../../../../../../workers/lib/canvas/drive-upload'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function PATCH(
  req: Request,
  { params }: { params: { outputId: string } },
) {
  const { outputId } = params
  const supabase = getServiceClient()
  const body = await req.json() as { is_active: boolean }

  const { data: output, error } = await supabase
    .from('canvas_node_outputs')
    .update({ is_active: body.is_active })
    .eq('id', outputId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ output })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { outputId: string } },
) {
  const { outputId } = params
  const supabase = getServiceClient()

  const { data: output } = await supabase
    .from('canvas_node_outputs')
    .select('drive_file_id')
    .eq('id', outputId)
    .maybeSingle()

  if (output?.drive_file_id) {
    await deleteFile(output.drive_file_id).catch(() => {})
  }

  const { error } = await supabase.from('canvas_node_outputs').delete().eq('id', outputId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
