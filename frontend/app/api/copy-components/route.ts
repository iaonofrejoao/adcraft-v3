// GET /api/copy-components?pipeline_id=UUID&product_id=UUID
// Lista componentes de copy de um pipeline/produto.
// Pelo menos um dos dois query params é obrigatório.
// PLANO_EXECUCAO 5.4 | PRD seção 7.2

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get('pipeline_id');
  const productId  = searchParams.get('product_id');

  if (!pipelineId && !productId) {
    return NextResponse.json(
      { error: 'Pelo menos um dos parâmetros pipeline_id ou product_id é obrigatório' },
      { status: 400 },
    );
  }

  if (pipelineId && !UUID_RE.test(pipelineId)) {
    return NextResponse.json({ error: 'pipeline_id inválido — deve ser UUID' }, { status: 400 });
  }
  if (productId && !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'product_id inválido — deve ser UUID' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    let query = supabase
      .from('copy_components')
      .select(
        'id, pipeline_id, product_id, component_type, slot_number, tag, content, ' +
        'rationale, register, structure, intensity, ' +
        'compliance_status, compliance_violations, ' +
        'approval_status, approved_at, rejected_at, rejection_reason, created_at',
      )
      .order('created_at', { ascending: true });

    if (pipelineId) query = query.eq('pipeline_id', pipelineId);
    if (productId)  query = query.eq('product_id', productId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ components: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
