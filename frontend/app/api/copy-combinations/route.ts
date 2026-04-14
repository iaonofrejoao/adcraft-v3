// GET /api/copy-combinations?pipeline_id=UUID&product_id=UUID
// Lista combinações de copy de um pipeline/produto.
// Pelo menos um dos dois query params é obrigatório.
// PLANO_EXECUCAO 5.5 | PRD seção 2.2

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
      .from('copy_combinations')
      .select(
        'id, product_id, pipeline_id, tag, hook_id, body_id, cta_id, ' +
        'full_text, selected_for_video, created_at',
      )
      .order('created_at', { ascending: true });

    if (pipelineId) query = query.eq('pipeline_id', pipelineId);
    if (productId)  query = query.eq('product_id', productId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ combinations: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
