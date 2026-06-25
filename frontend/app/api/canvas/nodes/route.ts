// POST /api/canvas/nodes — cria nó avulso (ex: Imagem Adicional)

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
    canvas_id:   string
    type:        string
    label?:      string
    position_x?: number
    position_y?: number
    prompt?:     string
    config?:     Record<string, unknown>
  }

  const { data: node, error } = await supabase
    .from('canvas_nodes')
    .insert({
      canvas_id:   body.canvas_id,
      type:        body.type,
      label:       body.label,
      position_x:  body.position_x ?? 0,
      position_y:  body.position_y ?? 0,
      prompt:      body.prompt,
      config:      body.config ?? {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ node }, { status: 201 })
}
