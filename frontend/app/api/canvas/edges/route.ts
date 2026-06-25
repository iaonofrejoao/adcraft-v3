// POST /api/canvas/edges — cria conexão entre nós

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function POST(req: Request) {
  const supabase = getServiceClient()
  const body = await req.json() as {
    canvas_id:      string
    source_node_id: string
    target_node_id: string
  }

  const { data: edge, error } = await supabase
    .from('canvas_edges')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ edge }, { status: 201 })
}
