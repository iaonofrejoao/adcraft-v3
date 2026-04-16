// POST /api/tasks/:id/rerun
//
// Reseta uma task para 'pending' e invalida (→ 'waiting') todas as tasks
// downstream que dependem dela transitivamente.
// O worker vai buscá-la no próximo poll (≤5s) e re-executar.
//
// Resposta: { ok: true, task_id, downstream_reset: string[] }

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

  // Busca a task e o pipeline
  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, pipeline_id, agent_name, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Só permite re-run em tasks terminais (failed, completed, skipped)
  // e em paused — não em running (já está em execução).
  const RERUNNABLE = ['failed', 'completed', 'skipped', 'paused', 'pending', 'waiting'];
  if (!RERUNNABLE.includes(task.status)) {
    return NextResponse.json(
      { error: `Cannot rerun task with status '${task.status}'` },
      { status: 422 }
    );
  }

  // ── Reset a task alvo ────────────────────────────────────────────────────
  const { error: resetErr } = await supabase
    .from('tasks')
    .update({
      status:      'pending',
      output:      null,
      error:       null,
      retry_count: 0,
      started_at:  null,
      completed_at: null,
    })
    .eq('id', id);

  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 500 });
  }

  // ── Encontra e invalida tasks downstream ─────────────────────────────────
  // Tasks downstream são todas que têm este task.id em depends_on
  // e estão em status ≠ pending/waiting (já podem ter rodado).
  // Fazemos BFS iterativo para pegar a cadeia toda.

  const downstreamReset: string[] = [];

  if (task.pipeline_id) {
    // Carrega todas as tasks do pipeline para BFS em memória
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, depends_on, status')
      .eq('pipeline_id', task.pipeline_id);

    const rows = (allTasks ?? []) as { id: string; depends_on: string[]; status: string }[];

    // BFS: começa pelo id rerunnado, propaga para quem depende dele
    const visited  = new Set<string>([id]);
    const queue    = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const row of rows) {
        if (visited.has(row.id)) continue;
        if ((row.depends_on ?? []).includes(current)) {
          visited.add(row.id);
          queue.push(row.id);
          if (row.id !== id) downstreamReset.push(row.id);
        }
      }
    }

    // Invalida downstream → 'waiting' (serão promovidos pelo seed-next-task
    // quando suas dependências estiverem concluídas novamente)
    if (downstreamReset.length > 0) {
      await supabase
        .from('tasks')
        .update({
          status:      'waiting',
          output:      null,
          error:       null,
          started_at:  null,
          completed_at: null,
        })
        .in('id', downstreamReset);
    }

    // Garante pipeline em 'running' para o worker continuar
    await supabase
      .from('pipelines')
      .update({ status: 'running', completed_at: null })
      .eq('id', task.pipeline_id)
      .in('status', ['completed', 'failed']);
  }

  return NextResponse.json({
    ok:               true,
    task_id:          id,
    downstream_reset: downstreamReset,
  });
}
