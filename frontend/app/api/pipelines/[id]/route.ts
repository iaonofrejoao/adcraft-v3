// GET  /api/pipelines/:id  — retorna pipeline + tasks + approvals pendentes
// PATCH /api/pipelines/:id  — transiciona status (ex: plan_preview → pending para aprovar o plano)
// PLANO_EXECUCAO 5.3 | PRD seção 3.2

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = getServiceClient();

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  // Busca tasks do pipeline ordenadas por criação
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, agent_name, mode, depends_on, status, input_context, output, error, retry_count, started_at, completed_at, created_at')
    .eq('pipeline_id', id)
    .order('created_at', { ascending: true });

  // Busca approvals pendentes
  const { data: approvals } = await supabase
    .from('approvals')
    .select('*')
    .eq('pipeline_id', id)
    .eq('status', 'pending');

  // Enrich: produto associado
  let product: { name: string; sku: string } | null = null;
  if (pipeline.product_id) {
    const { data: prod } = await supabase
      .from('products')
      .select('name, sku')
      .eq('id', pipeline.product_id)
      .maybeSingle();
    if (prod) product = prod;
  }

  // Progresso: % de tasks completed (exclui reused/skipped)
  const allTasks = tasks ?? [];
  const executedTasks = allTasks.filter((t) => t.status !== 'skipped');
  const completedTasks = executedTasks.filter((t) => t.status === 'completed' || t.status === 'done');
  const progress = executedTasks.length > 0
    ? Math.round((completedTasks.length / executedTasks.length) * 100)
    : 0;

  return NextResponse.json({
    ...pipeline,
    product,
    tasks: allTasks,
    pending_approvals: approvals ?? [],
    progress_pct: progress,
    tasks_total: allTasks.length,
    tasks_done:  completedTasks.length,
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

interface PatchBody {
  status?: 'pending' | 'cancelled';
  force_refresh?: boolean;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  plan_preview: ['pending', 'cancelled', 'deleted'],
  paused:       ['pending', 'cancelled', 'deleted'],
  pending:      ['cancelled', 'deleted'],
  running:      ['deleted'],
  failed:       ['deleted'],
  cancelled:    ['deleted'],
  completed:    ['deleted'],
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Busca estado atual
  const { data: pipeline, error: fetchErr } = await supabase
    .from('pipelines')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  const allowed = ALLOWED_TRANSITIONS[pipeline.status as string] ?? [];

  if (body.status && !allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${pipeline.status}' to '${body.status}'` },
      { status: 422 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.status === 'cancelled') patch.completed_at = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('pipelines')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Quando o plano é aprovado (plan_preview → pending), promove tasks 'waiting'
  // cujas dependências são todas 'skipped' (artifacts cacheados).
  // Garante que pipelines criados antes do fix também funcionem.
  if (body.status === 'pending') {
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, status, depends_on')
      .eq('pipeline_id', id);

    if (allTasks && allTasks.length > 0) {
      const skippedIds = new Set(
        allTasks.filter((t) => t.status === 'skipped').map((t) => t.id as string),
      );

      const toPromote = allTasks
        .filter((t) => {
          if (t.status !== 'waiting') return false;
          const deps: string[] = (t.depends_on as string[]) ?? [];
          return deps.length > 0 && deps.every((d) => skippedIds.has(d));
        })
        .map((t) => t.id as string);

      if (toPromote.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'pending' })
          .in('id', toPromote);
      }
    }
  }

  return NextResponse.json(updated);
}
