// Ações reais do Jarvis: queries SQL via Supabase service client.
// Cada função recebe o client como parâmetro (injeção de dependência)
// para evitar acoplamento com workers/lib/db.ts no contexto Next.js.
// Chamado por frontend/app/api/chat/route.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { planPipeline } from './planner';
import type { GoalName } from '../agent-registry';
import type { PlannedTask } from './dag-builder';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  niche_id: string | null;
  created_at: string;
}

export interface KnowledgeRecord {
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  created_at: string;
  status: string;
}

export interface TaskRecord {
  id: string;
  pipeline_id: string;
  agent_name: string;
  status: string;
  depends_on: string[];
  retry_count: number;
  output: unknown | null;
}

export interface PipelineRow {
  id: string;
  product_id: string;
  goal: string;
  status: string;
  cost_so_far_usd: string;
  budget_usd: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineWithTasks extends PipelineRow {
  tasks: TaskRecord[];
}

// ── 1. listProducts ───────────────────────────────────────────────────────────
// SELECT id, sku, name, niche_id, created_at FROM products
// ORDER BY created_at DESC LIMIT 20

export async function listProducts(supabase: SupabaseClient): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('id, sku, name, niche_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data as Product[]) ?? [];
}

// ── 2. resolveProduct ─────────────────────────────────────────────────────────
// Se query é 4 letras maiúsculas → busca exata por sku
// Senão → ILIKE '%query%' por name
// 0 resultados → null | 1 → Product | 2+ → Product[] (ambiguidade)

export async function resolveProduct(
  query: string,
  supabase: SupabaseClient,
): Promise<Product | Product[] | null> {
  const isSkuLike = /^[A-Z0-9]{4}$/i.test(query.trim());

  if (isSkuLike) {
    const { data } = await supabase
      .from('products')
      .select('id, sku, name, niche_id, created_at')
      .eq('sku', query.trim().toUpperCase())
      .is('deleted_at', null)
      .maybeSingle();
    return (data as Product) ?? null;
  }

  const { data } = await supabase
    .from('products')
    .select('id, sku, name, niche_id, created_at')
    .ilike('name', `%${query.trim()}%`)
    .is('deleted_at', null)
    .limit(5);

  if (!data || data.length === 0) return null;
  if (data.length === 1) return data[0] as Product;
  return data as Product[];
}

// ── 3. getProductKnowledge ────────────────────────────────────────────────────
// SELECT artifact_type, artifact_data, created_at, status
// FROM product_knowledge WHERE product_id = $1 AND status = 'fresh'
// ORDER BY created_at DESC

export async function getProductKnowledge(
  productId: string,
  supabase: SupabaseClient,
): Promise<KnowledgeRecord[]> {
  const { data } = await supabase
    .from('product_knowledge')
    .select('artifact_type, artifact_data, created_at, status')
    .eq('product_id', productId)
    .eq('status', 'fresh')
    .order('created_at', { ascending: false });
  return (data as KnowledgeRecord[]) ?? [];
}

// ── 4. getPipelineStatus ──────────────────────────────────────────────────────
// SELECT pipeline + tasks via duas queries (Supabase não suporta GROUP BY + array_agg via PostgREST)

export async function getPipelineStatus(
  pipelineId: string,
  supabase: SupabaseClient,
): Promise<PipelineWithTasks | null> {
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, product_id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
    .eq('id', pipelineId)
    .maybeSingle();

  if (!pipeline) return null;

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, pipeline_id, agent_name, status, depends_on, retry_count, output')
    .eq('pipeline_id', pipelineId)
    .order('created_at', { ascending: true });

  return {
    ...(pipeline as PipelineRow),
    tasks: (tasks as TaskRecord[]) ?? [],
  };
}

// ── 5. createNewPipeline ──────────────────────────────────────────────────────
// Planeja DAG, insere pipeline com status='pending' e tasks.
// Usado no approve_plan quando não há plan_preview no DB.

export async function createNewPipeline(
  productId: string,
  goal: GoalName,
  productVersion: number,
  supabase: SupabaseClient,
): Promise<PipelineWithTasks> {
  const plan = await planPipeline(goal, productId, false, supabase);
  const pipelineId = randomUUID();

  const { data: pipeline, error: pipelineErr } = await supabase
    .from('pipelines')
    .insert({
      id:                pipelineId,
      product_id:        productId,
      goal,
      deliverable_agent: plan.deliverable,
      plan:              { tasks: plan.tasks, checkpoints: plan.checkpoints },
      state:             {},
      status:            'pending',
      product_version:   productVersion,
      budget_usd:        plan.budget_usd,
      cost_so_far_usd:   '0',
    })
    .select('id, product_id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
    .single();

  if (pipelineErr || !pipeline) {
    throw new Error(`Pipeline insert failed: ${pipelineErr?.message}`);
  }

  // Mapa agent → taskId para resolver depends_on em UUIDs
  const agentToTaskId = new Map<string, string>(
    plan.tasks.map((t: PlannedTask) => [t.agent, randomUUID()]),
  );

  const taskRows = plan.tasks.map((t: PlannedTask) => {
    const taskId    = agentToTaskId.get(t.agent)!;
    const depsUuids = t.depends_on
      .map((dep) => agentToTaskId.get(dep))
      .filter((id): id is string => id !== undefined);

    let status: string;
    if (t.status === 'reused')       status = 'skipped';
    else if (depsUuids.length === 0) status = 'pending';
    else                             status = 'waiting';

    return {
      id:            taskId,
      pipeline_id:   pipelineId,
      agent_name:    t.agent,
      depends_on:    depsUuids,
      status,
      input_context: null,
      output:        t.status === 'reused' ? { source_knowledge_id: t.source_knowledge_id } : null,
      retry_count:   0,
    };
  });

  if (taskRows.length > 0) {
    const { error: tasksErr } = await supabase.from('tasks').insert(taskRows);
    if (tasksErr) throw new Error(`Tasks insert failed: ${tasksErr.message}`);
  }

  return {
    ...(pipeline as PipelineRow),
    tasks: taskRows as unknown as TaskRecord[],
  };
}
