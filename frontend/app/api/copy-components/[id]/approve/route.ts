// POST /api/copy-components/:id/approve
// Aprova um componente de copy (hook, body ou CTA).
// Regra 9: aprovação é por componente, nunca por copy completa.
// Regra 10: copy_combinations só pode ser inserido se hook+body+cta estão 'approved'.
// PLANO_EXECUCAO 5.4 | PRD seção 7.2

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = getServiceClient();

  // Busca o componente para validar existência e estado atual
  const { data: component, error: fetchErr } = await supabase
    .from('copy_components')
    .select('id, approval_status, compliance_status, tag')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !component) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 });
  }

  if (component.approval_status === 'approved') {
    return NextResponse.json({ error: 'Component already approved' }, { status: 409 });
  }

  // Aprovação manual substitui qualquer compliance_status pendente
  const { data: updated, error: updateErr } = await supabase
    .from('copy_components')
    .update({
      approval_status: 'approved',
      approved_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, tag, component_type, slot_number, approval_status, approved_at')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
