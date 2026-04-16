// GET /api/pipelines — lista pipelines com filtros opcionais
//
// Query params:
//   sku        — filtra por produto (SKU)
//   product_id — filtra por produto (UUID, alternativa ao sku)
//   status     — filtra por status (pode ser vírgula-separado: "running,pending")
//   date_from  — ISO8601, filtra created_at >=
//   date_to    — ISO8601, filtra created_at <=
//   limit      — default 50, max 200
//   offset     — paginação, default 0
//
// Resposta: { pipelines: [...], total: number }
// Cada pipeline inclui: id, goal, status, cost_so_far_usd, budget_usd,
//   created_at, updated_at, completed_at, product_id,
//   product?{ name, sku }, progress_pct, tasks_total, tasks_done

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

  const sku        = searchParams.get('sku');
  const productId  = searchParams.get('product_id');
  const statusRaw  = searchParams.get('status');
  const dateFrom   = searchParams.get('date_from');
  const dateTo     = searchParams.get('date_to');
  const limit      = Math.min(Math.max(1, parseInt(searchParams.get('limit')  ?? '50',  10) || 50),  200);
  const offset     = Math.max(0,              parseInt(searchParams.get('offset') ?? '0',   10) || 0);

  const statusList = statusRaw
    ? statusRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const supabase = getServiceClient();

  // ── Resolve product_id se vier como SKU ───────────────────────────────────
  let resolvedProductId: string | null = productId ?? null;

  if (sku && !resolvedProductId) {
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .maybeSingle();

    if (productErr) {
      return NextResponse.json({ error: productErr.message }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ pipelines: [], total: 0 });
    }
    resolvedProductId = product.id;
  }

  // ── Query pipelines ───────────────────────────────────────────────────────
  let query = supabase
    .from('pipelines')
    .select(
      'id, goal, status, cost_so_far_usd, budget_usd, product_id, created_at, updated_at, completed_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (resolvedProductId) query = query.eq('product_id', resolvedProductId);
  if (statusList.length)  query = query.in('status', statusList);
  if (dateFrom)           query = query.gte('created_at', dateFrom);
  if (dateTo)             query = query.lte('created_at', dateTo);

  const { data: pipelines, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = pipelines ?? [];

  // ── Enrich: product names ─────────────────────────────────────────────────
  const productIds = [...new Set(rows.map((p) => p.product_id).filter(Boolean) as string[])];

  type ProductRow = { id: string; name: string; sku: string };
  let productMap = new Map<string, ProductRow>();

  if (productIds.length) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku')
      .in('id', productIds);

    productMap = new Map((products ?? []).map((p: ProductRow) => [p.id, p]));
  }

  // ── Enrich: task progress ─────────────────────────────────────────────────
  const ids = rows.map((p) => p.id);
  const { data: taskRows } = ids.length
    ? await supabase
        .from('tasks')
        .select('pipeline_id, status')
        .in('pipeline_id', ids)
    : { data: [] };

  const tasksByPipeline: Record<string, { status: string }[]> = {};
  for (const t of taskRows ?? []) {
    if (!tasksByPipeline[t.pipeline_id]) tasksByPipeline[t.pipeline_id] = [];
    tasksByPipeline[t.pipeline_id].push(t);
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const result = rows.map((p) => {
    const all        = tasksByPipeline[p.id] ?? [];
    const total      = all.length;
    const done       = all.filter((t) => t.status === 'completed' || t.status === 'skipped').length;
    const progress   = total > 0 ? Math.round((done / total) * 100) : 0;
    const product    = p.product_id ? productMap.get(p.product_id) : undefined;

    return {
      id:             p.id,
      goal:           p.goal,
      status:         p.status,
      cost_so_far_usd: p.cost_so_far_usd,
      budget_usd:     p.budget_usd,
      product_id:     p.product_id,
      created_at:     p.created_at,
      updated_at:     p.updated_at,
      completed_at:   p.completed_at,
      product:        product ? { name: product.name, sku: product.sku } : undefined,
      progress_pct:   progress,
      tasks_total:    total,
      tasks_done:     done,
    };
  });

  return NextResponse.json({ pipelines: result, total: count ?? result.length });
}
