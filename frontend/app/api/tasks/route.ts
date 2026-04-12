// GET /api/tasks
// Lista tasks com dados do pipeline e produto associados.
// Query params:
//   limit — número de registros (default 100, max 500)
//   order — campo.direção, ex: "created_at.desc" (default)
//
// Resposta: { tasks: [...] }
// Campos: id, pipeline_id, agent_name, mode, status, retry_count, error,
//         started_at, completed_at, created_at, pipeline?{ goal, product?{ name, sku } }
//
// Nota: tabela v2 `tasks` não possui FK constraints → join feito em memória
// com duas queries adicionais (pipelines, products).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// Colunas da tabela v2 tasks que o Kanban em demandas/page.tsx precisa
const TASK_COLS = [
  'id', 'pipeline_id', 'agent_name', 'mode', 'status',
  'retry_count', 'error', 'started_at', 'completed_at', 'created_at',
].join(', ');

const ALLOWED_ORDER_FIELDS = new Set([
  'created_at', 'started_at', 'completed_at', 'status', 'agent_name',
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100),
    500,
  );

  // Parseia "campo.direção" — ex: "created_at.desc"
  const orderParam = searchParams.get('order') ?? 'created_at.desc';
  const dotIdx     = orderParam.lastIndexOf('.');
  const rawField   = dotIdx > 0 ? orderParam.slice(0, dotIdx) : orderParam;
  const dir        = dotIdx > 0 ? orderParam.slice(dotIdx + 1) : 'desc';
  const orderField = ALLOWED_ORDER_FIELDS.has(rawField) ? rawField : 'created_at';
  const ascending  = dir === 'asc';

  try {
    const supabase = getServiceClient();

    // 1. Busca tasks
    const { data: tasksRaw, error: tasksErr } = await supabase
      .from('tasks')
      .select(TASK_COLS)
      .order(orderField, { ascending })
      .limit(limit);

    if (tasksErr) {
      console.error('[api/tasks] tasks query error:', tasksErr.message);
      return NextResponse.json({ error: tasksErr.message }, { status: 500 });
    }

    const tasks = tasksRaw ?? [];

    // 2. Busca pipelines para os pipeline_ids únicos presentes
    const pipelineIds = [...new Set(
      tasks.map((t: any) => t.pipeline_id).filter(Boolean) as string[]
    )];

    type PipelineRow = { id: string; goal: string; product_id: string | null };
    let pipelineMap = new Map<string, PipelineRow>();

    if (pipelineIds.length > 0) {
      const { data: pipelines, error: pipErr } = await supabase
        .from('pipelines')
        .select('id, goal, product_id')
        .in('id', pipelineIds);

      if (pipErr) {
        console.error('[api/tasks] pipelines query error:', pipErr.message);
        // Não falha a rota — retorna tasks sem dados de pipeline
      } else {
        pipelineMap = new Map((pipelines ?? []).map((p: PipelineRow) => [p.id, p]));
      }
    }

    // 3. Busca products para os product_ids únicos nos pipelines
    const productIds = [...new Set(
      [...pipelineMap.values()]
        .map((p) => p.product_id)
        .filter(Boolean) as string[]
    )];

    type ProductRow = { id: string; name: string; sku: string };
    let productMap = new Map<string, ProductRow>();

    if (productIds.length > 0) {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);

      if (prodErr) {
        console.error('[api/tasks] products query error:', prodErr.message);
      } else {
        productMap = new Map((products ?? []).map((p: ProductRow) => [p.id, p]));
      }
    }

    // 4. Monta resposta com join em memória
    const result = tasks.map((t: any) => {
      const pipeline = t.pipeline_id ? pipelineMap.get(t.pipeline_id) : undefined;
      const product  = pipeline?.product_id ? productMap.get(pipeline.product_id) : undefined;

      return {
        id:           t.id,
        pipeline_id:  t.pipeline_id,
        agent_name:   t.agent_name,
        mode:         t.mode,
        status:       t.status,
        retry_count:  t.retry_count,
        error:        t.error,
        started_at:   t.started_at,
        completed_at: t.completed_at,
        created_at:   t.created_at,
        pipeline: pipeline
          ? {
              goal:    pipeline.goal,
              product: product
                ? { name: product.name, sku: product.sku }
                : undefined,
            }
          : undefined,
      };
    });

    return NextResponse.json({ tasks: result }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/tasks] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
