// Tools de leitura do banco de dados para o Jarvis Claude agent.
// Todas as funções recebem contexto via ToolContext — sem side effects de escrita.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ToolContext {
  supabase: SupabaseClient;
  conversationId: string;
  emit: (event: { type: string; [key: string]: unknown }) => void;
}

// ── query_products ────────────────────────────────────────────────────────────

export const QUERY_PRODUCTS_TOOL = {
  name: 'query_products',
  description:
    'Lista os produtos cadastrados na plataforma. Suporta filtro por SKU, nome ' +
    'ou niche_id. Retorna id, sku, name, niche_id e created_at de cada produto. ' +
    'Use para encontrar o product_id necessário para outras tools.',
  input_schema: {
    type: 'object' as const,
    properties: {
      search: {
        type: 'string',
        description:
          'Filtro por SKU exato (4 letras maiúsculas, ex: "BRNX") ou por nome ' +
          '(busca parcial, ex: "citrus"). Omita para listar todos.',
      },
      limit: {
        type: 'integer',
        description: 'Máximo de resultados. Default 10, máximo 50.',
        default: 10,
        minimum: 1,
        maximum: 50,
      },
    },
    required: [],
  },
};

export async function executeQueryProducts(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const search = (input.search as string | undefined)?.trim();
  const limit  = Math.min(Math.max(1, (input.limit as number | undefined) ?? 10), 50);

  let query = ctx.supabase
    .from('products')
    .select('id, sku, name, niche_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    // SKU exato (4 chars alfanuméricos)
    if (/^[A-Z0-9]{3,6}$/i.test(search)) {
      query = query.eq('sku', search.toUpperCase());
    } else {
      query = query.ilike('name', `%${search}%`);
    }
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: (data ?? []).length,
    products: (data ?? []).map((p: Record<string, unknown>) => ({
      id:         p.id,
      sku:        p.sku,
      name:       p.name,
      niche_id:   p.niche_id ?? null,
      created_at: p.created_at,
    })),
  };
}

// ── query_executions ──────────────────────────────────────────────────────────

export const QUERY_EXECUTIONS_TOOL = {
  name: 'query_executions',
  description:
    'Lista execuções (pipelines) com filtros opcionais. Retorna id, product_id, ' +
    'goal, status, custo e data. Use para responder perguntas como "quantas execuções ' +
    'rodei semana passada?" ou "qual o status do meu último pipeline?".',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_id: {
        type: 'string',
        description: 'UUID do produto para filtrar. Obtenha via query_products.',
      },
      status: {
        type: 'string',
        enum: ['plan_preview', 'pending', 'running', 'completed', 'failed', 'paused'],
        description: 'Filtra por status do pipeline.',
      },
      limit: {
        type: 'integer',
        description: 'Máximo de resultados. Default 10, máximo 50.',
        default: 10,
      },
      since_days: {
        type: 'integer',
        description:
          'Retorna apenas pipelines criados nos últimos N dias. ' +
          'Ex: 7 para "semana passada".',
      },
    },
    required: [],
  },
};

export async function executeQueryExecutions(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const limit     = Math.min(Math.max(1, (input.limit as number | undefined) ?? 10), 50);
  const sinceDays = input.since_days as number | undefined;

  let query = ctx.supabase
    .from('pipelines')
    .select('id, product_id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.product_id) {
    query = query.eq('product_id', input.product_id as string);
  }
  if (input.status) {
    query = query.eq('status', input.status as string);
  }
  if (sinceDays) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    query = query.gte('created_at', since.toISOString());
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const pipelines = data ?? [];
  return {
    count: pipelines.length,
    pipelines: pipelines.map((p: Record<string, unknown>) => ({
      id:              p.id,
      product_id:      p.product_id,
      goal:            p.goal,
      status:          p.status,
      cost_usd:        parseFloat((p.cost_so_far_usd as string) ?? '0').toFixed(4),
      budget_usd:      p.budget_usd,
      created_at:      p.created_at,
      updated_at:      p.updated_at,
    })),
  };
}

// ── query_agent_output ────────────────────────────────────────────────────────

export const QUERY_AGENT_OUTPUT_TOOL = {
  name: 'query_agent_output',
  description:
    'Busca o output (knowledge) de um agente específico para um produto. ' +
    'Use para mostrar ao usuário o que foi pesquisado: avatar, mercado, ângulos, ' +
    'copy ou compliance. Retorna o artifact_data completo do agente.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_id: {
        type: 'string',
        description: 'UUID do produto. Obtenha via query_products.',
      },
      artifact_type: {
        type: 'string',
        enum: ['avatar', 'market', 'angles', 'copy_components', 'compliance_results', 'video_assets'],
        description: 'Tipo de artifact a buscar.',
      },
    },
    required: ['product_id', 'artifact_type'],
  },
};

export async function executeQueryAgentOutput(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const { data, error } = await ctx.supabase
    .from('product_knowledge')
    .select('artifact_type, artifact_data, created_at, status')
    .eq('product_id', input.product_id as string)
    .eq('artifact_type', input.artifact_type as string)
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data)  return { found: false, message: `Nenhum ${input.artifact_type} encontrado para este produto. Execute o pipeline correspondente primeiro.` };

  return {
    found:         true,
    artifact_type: data.artifact_type,
    created_at:    data.created_at,
    status:        data.status,
    data:          data.artifact_data,
  };
}
