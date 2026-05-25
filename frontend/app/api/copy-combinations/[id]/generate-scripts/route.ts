// POST /api/copy-combinations/:id/generate-scripts
// Enfileira a combinação para geração de scripts pelo Claude Code no terminal.
// NÃO chama nenhuma API de IA — apenas marca script_status como 'queued'.
// Para processar a fila: "Processa scripts na fila para o produto X" no Claude Code.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { data: combo, error: fetchErr } = await supabase
    .from('copy_combinations')
    .select('id, tag, script_status')
    .eq('id', id)
    .single()

  if (fetchErr || !combo) {
    return NextResponse.json({ error: 'Combinação não encontrada' }, { status: 404 })
  }

  if (combo.script_status === 'queued' || combo.script_status === 'generating') {
    return NextResponse.json(
      { status: combo.script_status, message: 'Já em andamento' },
      { status: 202 },
    )
  }

  const { error: updateErr } = await supabase
    .from('copy_combinations')
    .update({ script_status: 'queued' })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      status: 'queued',
      combination_id: id,
      tag: combo.tag,
      message: 'Na fila. Rode "Processa scripts na fila" no Claude Code para executar.',
    },
    { status: 202 },
  )
}
