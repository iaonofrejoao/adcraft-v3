// PATCH /api/canvas/nodes/[nodeId] — atualiza prompt | config | posição
// DELETE /api/canvas/nodes/[nodeId] — remove nó e outputs (cascata no DB)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function PATCH(
  req: Request,
  { params }: { params: { nodeId: string } },
) {
  const { nodeId } = params
  const supabase = getServiceClient()
  const body = await req.json() as {
    prompt?:            string
    config?:            Record<string, unknown>
    position_x?:        number
    position_y?:        number
    generation_status?: string
    error_message?:     string | null
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.prompt            !== undefined) update.prompt            = body.prompt
  if (body.config            !== undefined) update.config            = body.config
  if (body.position_x        !== undefined) update.position_x        = body.position_x
  if (body.position_y        !== undefined) update.position_y        = body.position_y
  if (body.generation_status !== undefined) update.generation_status = body.generation_status
  if (body.error_message     !== undefined) update.error_message     = body.error_message

  const { data: node, error } = await supabase
    .from('canvas_nodes')
    .update(update)
    .eq('id', nodeId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ node })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { nodeId: string } },
) {
  const { nodeId } = params
  const supabase = getServiceClient()

  const { error } = await supabase.from('canvas_nodes').delete().eq('id', nodeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
