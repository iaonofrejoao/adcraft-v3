// Tool de execução de agentes para o Jarvis Claude agent.
// trigger_agent: cria um plan_preview e emite evento SSE — sem executar diretamente.
// O usuário aprova o plano pelo UI existente (PlanPreviewCard) ou via mensagem.

import type { ToolContext }            from './database-read';
import { planPipeline }                from '../planner';
import { persistPlanPreview }          from '../actions';
import { resolveProduct }              from '../actions';
import type { GoalName }               from '../../agent-registry';

// ── trigger_agent ─────────────────────────────────────────────────────────────

export const TRIGGER_AGENT_TOOL = {
  name: 'trigger_agent',
  description:
    'Cria um plano de execução para um produto + goal e exibe o preview ao usuário. ' +
    'O usuário deve aprovar o plano antes de qualquer execução real. ' +
    'Use quando o usuário pede para "rodar", "executar", "criar" um avatar, mercado, ' +
    'ângulos, copy ou criativo completo para um produto específico.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_identifier: {
        type: 'string',
        description:
          'SKU (ex: "BRNX") ou nome do produto (ex: "CitrusBurn"). ' +
          'Será resolvido automaticamente para o product_id.',
      },
      goal: {
        type: 'string',
        enum: ['avatar_only', 'market_only', 'angles_only', 'copy_only', 'creative_full'],
        description:
          'Goal do pipeline: ' +
          '"avatar_only" (pesquisa de avatar), ' +
          '"market_only" (pesquisa de mercado), ' +
          '"angles_only" (gera ângulos — requer avatar + market), ' +
          '"copy_only" (hooks + bodies + CTAs + compliance), ' +
          '"creative_full" (pipeline completo até vídeo).',
      },
      force_refresh: {
        type: 'boolean',
        description:
          'Se true, ignora dados em cache e reprocessa tudo do zero. ' +
          'Use quando o usuário pede explicitamente para refazer.',
        default: false,
      },
    },
    required: ['product_identifier', 'goal'],
  },
};

export async function executeTriggerAgent(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const identifier   = (input.product_identifier as string).trim();
  const goal         = input.goal as GoalName;
  const forceRefresh = (input.force_refresh as boolean | undefined) ?? false;

  // 1. Resolve produto
  const productOrList = await resolveProduct(identifier, ctx.supabase);

  if (!productOrList) {
    return {
      error: `Produto "${identifier}" não encontrado. Use query_products para listar os produtos disponíveis.`,
    };
  }

  if (Array.isArray(productOrList)) {
    return {
      error:        `Ambiguidade: encontrei ${productOrList.length} produtos com esse nome.`,
      candidates:   productOrList.map((p) => ({ sku: p.sku, name: p.name, id: p.id })),
      instructions: 'Especifique o SKU exato (ex: "BRNX") para evitar ambiguidade.',
    };
  }

  const product = productOrList;

  // 2. Cria o plano (DAG)
  let plan;
  try {
    plan = await planPipeline(goal, product.id, forceRefresh, ctx.supabase);
  } catch (err) {
    return { error: `Falha ao planejar pipeline: ${(err as Error).message}` };
  }

  plan.product_sku  = product.sku;
  plan.product_name = product.name;

  // 3. Persiste como plan_preview (aguarda aprovação)
  let persisted;
  try {
    persisted = await persistPlanPreview(plan, forceRefresh, ctx.supabase);
  } catch (err) {
    return { error: `Falha ao persistir plano: ${(err as Error).message}` };
  }

  // 4. Emite evento SSE para o frontend renderizar o PlanPreviewCard
  ctx.emit({
    type:        'plan_preview',
    plan,
    pipeline_id: persisted.pipeline_id,
  });

  // 5. Retorna resumo para o Claude gerar a resposta textual
  const taskCount     = persisted.task_count;
  const cachedCount   = plan.tasks.filter((t) => t.status === 'reused').length;
  const toRunCount    = taskCount;

  const pipelineShortId = persisted.pipeline_id.slice(0, 4).toUpperCase();
  const demandaLink = `[Demanda ${product.name} #${pipelineShortId}](/demandas?pipeline=${persisted.pipeline_id})`;

  return {
    status:        'plan_preview_shown',
    pipeline_id:   persisted.pipeline_id,
    product:       { sku: product.sku, name: product.name },
    goal,
    task_count:    toRunCount,
    cached_count:  cachedCount,
    estimated_cost_usd: plan.estimated_cost_usd,
    budget_usd:    plan.budget_usd,
    demanda_link_markdown: demandaLink,
    instructions:
      'O preview do plano foi exibido ao usuário. ' +
      'Apresente um resumo conciso do plano e instrua o usuário a clicar ' +
      '"Executar" no card de preview ou digitar "sim, pode executar" para confirmar. ' +
      `Use OBRIGATORIAMENTE este link markdown na sua resposta: ${demandaLink}`,
  };
}
