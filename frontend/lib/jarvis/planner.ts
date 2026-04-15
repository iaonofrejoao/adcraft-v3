// Planner do Jarvis: dado um goal + produto, retorna DAG mínimo de tasks,
// reaproveitando artifacts existentes em product_knowledge.
// Regra 14: todo DAG vem daqui — nenhum lugar do código tem sequência fixa.
// Skill: jarvis-planner.md | PRD seção 4.2

import {
  AGENT_REGISTRY,
  GOAL_TO_DELIVERABLE,
  GOAL_BUDGET_DEFAULTS,
  AgentName,
  ArtifactType,
  GoalName,
} from '../agent-registry';
import {
  resolveAgentDependencies,
  topologicalSort,
  buildDependsOn,
  PlannedTask,
} from './dag-builder';
import { renderMermaid } from './mermaid-renderer';
import { createClient } from '../supabase';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Falls back to service-role client — never the anon key — to avoid silent RLS failures.
function getServiceClient(): ReturnType<typeof createClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createSupabaseClient(url, key) as unknown as ReturnType<typeof createClient>;
}

// ── Estimativa de custo ─────────────────────────────────────────────────────

// USD por 1M tokens de input (aproximado, Abril 2026)
const COST_PER_1M_INPUT: Record<string, number> = {
  'gemini-2.5-pro': 1.25,
  'gemini-2.5-flash': 0.075,
};

function estimateTaskCost(agentName: AgentName): number {
  const cap = AGENT_REGISTRY[agentName];
  const pricePerM = COST_PER_1M_INPUT[cap.model] ?? 1.25;
  // Input + ~20% output estimado
  return (cap.max_input_tokens * 1.2 / 1_000_000) * pricePerM;
}

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface PlanCheckpoint {
  after_agent: AgentName;
  type: 'component_approval' | 'combination_selection';
  description: string;
}

export interface PipelinePlan {
  goal: GoalName;
  product_id: string;
  deliverable: ArtifactType;
  tasks: PlannedTask[];
  mermaid: string;
  estimated_cost_usd: number;
  budget_usd: number;
  checkpoints: PlanCheckpoint[];
  product_sku?: string;
  product_name?: string;
}

// Checkpoints definidos por goal (PRD tabela 4.2)
const GOAL_CHECKPOINTS: Partial<Record<GoalName, PlanCheckpoint[]>> = {
  copy_only: [
    {
      after_agent: 'anvisa_compliance',
      type: 'component_approval',
      description: 'Aprovar hooks, bodies e CTAs individualmente antes de gerar combinações',
    },
  ],
  creative_full: [
    {
      after_agent: 'anvisa_compliance',
      type: 'component_approval',
      description: 'Aprovar hooks, bodies e CTAs individualmente',
    },
    {
      after_agent: 'anvisa_compliance',  // combinações só após compliance (PRD jornada passo 8)
      type: 'combination_selection',
      description: 'Selecionar combinações H×B×C que virarão vídeo',
    },
  ],
};

// ── Cache check ─────────────────────────────────────────────────────────────

interface FreshResult {
  fresh: boolean;
  knowledgeId?: string;
}

/**
 * Verifica se há artifact fresco em product_knowledge para o produto.
 * "Fresco" = status='fresh' e criado dentro da janela de freshness_days.
 */
async function isFresh(
  productId: string,
  artifactType: ArtifactType,
  freshnessDays: number,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<FreshResult> {
  const client = supabaseClient ?? getServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - freshnessDays);

  const { data, error } = await client
    .from('product_knowledge')
    .select('id')
    .eq('product_id', productId)
    .eq('artifact_type', artifactType)
    .eq('status', 'fresh')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { fresh: false };
  return { fresh: true, knowledgeId: data.id as string };
}

// ── Função principal ────────────────────────────────────────────────────────

/**
 * Planeja o pipeline para um goal + produto.
 *
 * @param goal        - Um dos 5 goals do catálogo (PRD 4.2)
 * @param productId   - UUID do produto
 * @param forceRefresh - Ignora cache, recria todos os artifacts
 * @param supabaseClient - Injeção para testes (opcional)
 */
export async function planPipeline(
  goal: GoalName,
  productId: string,
  forceRefresh = false,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<PipelinePlan> {
  const deliverable = GOAL_TO_DELIVERABLE[goal];

  // 1. Resolve quais agentes são necessários via BFS reverso
  const requiredAgents = resolveAgentDependencies(deliverable, AGENT_REGISTRY);

  // 2. Ordena topologicamente (dependências primeiro)
  const sortedAgents = topologicalSort(requiredAgents, AGENT_REGISTRY);

  // 3. Para cada agente, decide pending vs reused
  const tasks: PlannedTask[] = [];

  for (const agentName of sortedAgents) {
    const cap = AGENT_REGISTRY[agentName];
    const dependsOn = buildDependsOn(agentName, sortedAgents, AGENT_REGISTRY);

    if (!forceRefresh && cap.cacheable && cap.freshness_days) {
      const { fresh, knowledgeId } = await isFresh(
        productId,
        cap.produces[0],
        cap.freshness_days,
        supabaseClient
      );
      if (fresh) {
        tasks.push({
          agent: agentName,
          status: 'reused',
          produces: cap.produces,
          requires: cap.requires,
          depends_on: dependsOn,
          source_knowledge_id: knowledgeId,
          estimated_cost_usd: 0,
        });
        continue;
      }
    }

    tasks.push({
      agent: agentName,
      status: 'pending',
      produces: cap.produces,
      requires: cap.requires,
      depends_on: dependsOn,
      estimated_cost_usd: estimateTaskCost(agentName),
    });
  }

  // 4. Métricas e renderização
  const estimatedCost = tasks.reduce((sum, t) => sum + (t.estimated_cost_usd ?? 0), 0);
  const mermaid = renderMermaid(tasks);
  const checkpoints = GOAL_CHECKPOINTS[goal] ?? [];
  const budgetUsd = GOAL_BUDGET_DEFAULTS[goal];

  return {
    goal,
    product_id: productId,
    deliverable,
    tasks,
    mermaid,
    estimated_cost_usd: estimatedCost,
    budget_usd: budgetUsd,
    checkpoints,
  };
}
