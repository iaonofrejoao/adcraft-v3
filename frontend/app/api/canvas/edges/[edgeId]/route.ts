// DELETE /api/canvas/edges/[edgeId] — remove conexão

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { edgeId: string } },
) {
  const { edgeId } = params
  const supabase = getServiceClient()

  const { error } = await supabase.from('canvas_edges').delete().eq('id', edgeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
