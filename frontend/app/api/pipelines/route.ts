// GET /api/pipelines?sku=:sku&limit=:limit — lista pipelines de um produto

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sku   = searchParams.get('sku');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

  if (!sku) {
    return NextResponse.json({ error: 'sku is required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Resolve product_id pelo SKU
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle();

  if (productErr) {
    return NextResponse.json({ error: productErr.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ pipelines: [] });
  }

  const { data: pipelines, error } = await supabase
    .from('pipelines')
    .select('id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calcula progress_pct para cada pipeline via tasks
  const ids = (pipelines ?? []).map((p) => p.id);
  const { data: tasks } = ids.length
    ? await supabase
        .from('tasks')
        .select('pipeline_id, status')
        .in('pipeline_id', ids)
    : { data: [] };

  const tasksByPipeline: Record<string, { status: string }[]> = {};
  for (const t of tasks ?? []) {
    if (!tasksByPipeline[t.pipeline_id]) tasksByPipeline[t.pipeline_id] = [];
    tasksByPipeline[t.pipeline_id].push(t);
  }

  const result = (pipelines ?? []).map((p) => {
    const all       = tasksByPipeline[p.id] ?? [];
    const executed  = all.filter((t) => t.status !== 'skipped');
    const completed = executed.filter((t) => t.status === 'completed');
    const progress  = executed.length > 0
      ? Math.round((completed.length / executed.length) * 100)
      : 0;
    return { ...p, progress_pct: progress };
  });

  return NextResponse.json({ pipelines: result });
}
