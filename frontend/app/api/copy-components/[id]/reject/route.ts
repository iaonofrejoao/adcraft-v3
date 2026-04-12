// POST /api/copy-components/:id/reject
// Rejeita um componente de copy. Registra o motivo como sinal para o niche_curator.
// Regra 9: aprovação/rejeição é por componente.
// O niche_curator (cron diário) lê componentes 'rejected' e extrai learnings.
// PLANO_EXECUCAO 5.4 | PRD seção 7.2

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

const RejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let body: { reason: string };
  try {
    const raw = await req.json();
    const parsed = RejectSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'rejection_reason is required', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: component, error: fetchErr } = await supabase
    .from('copy_components')
    .select('id, approval_status, tag, niche_id:product_id(niche_id)')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !component) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 });
  }

  if (component.approval_status === 'rejected') {
    return NextResponse.json({ error: 'Component already rejected' }, { status: 409 });
  }

  // Atualiza o status de aprovação com rejected_at e rejection_reason
  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('copy_components')
    .update({
      approval_status:  'rejected',
      rejected_at:      now,
      rejection_reason: body.reason,
    })
    .eq('id', id)
    .select('id, tag, component_type, slot_number, approval_status, rejected_at, rejection_reason')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Sinal para o niche_curator: persiste a rejeição como niche_learning de baixa confiança.
  // O curator cron vai consolidar esses sinais em learnings com occurrences reforçado.
  // A inserção é best-effort — não bloqueia a resposta.
  persistRejectionSignal(id, component as any, body.reason, supabase).catch((err) =>
    console.error('[copy-components/reject] niche signal failed:', err)
  );

  return NextResponse.json(updated);
}

async function persistRejectionSignal(
  componentId: string,
  component: { tag: string; component_type?: string; niche_id?: unknown },
  reason: string | undefined,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  // Resolve o niche_id via produto
  const { data: comp } = await supabase
    .from('copy_components')
    .select('product_id, component_type, content')
    .eq('id', componentId)
    .maybeSingle();

  if (!comp?.product_id) return;

  const { data: product } = await supabase
    .from('products')
    .select('niche_id')
    .eq('id', comp.product_id)
    .maybeSingle();

  if (!product?.niche_id) return;

  // Determina o tipo de learning baseado no tipo de componente
  const learningTypeMap: Record<string, string> = {
    hook:  'hook_pattern',
    body:  'language_pattern',
    cta:   'language_pattern',
  };
  const learningType = learningTypeMap[comp.component_type ?? ''] ?? 'hook_pattern';

  await supabase.from('niche_learnings').insert({
    niche_id:          product.niche_id,
    learning_type:     learningType,
    content:           reason
      ? `Rejeição (${comp.component_type}): ${reason}`
      : `Padrão rejeitado (${comp.component_type}): ${comp.content?.slice(0, 200) ?? ''}`,
    evidence:          { component_id: componentId, reason: reason ?? null },
    confidence:        0.3,  // baixa confiança — será reforçada pelo curator com mais ocorrências
    status:            'pending_curation',  // curator converte para 'active' após análise
  });
}
