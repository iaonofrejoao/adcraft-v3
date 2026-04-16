// Tools de memória cumulativa para o Jarvis — Fase E
// Permite ao Jarvis consultar learnings, patterns e insights persistidos.
// Todas as queries são read-only; escrita é feita pelos workers (extractor/aggregator).

import type { ToolContext } from './database-read';

// ── query_learnings ────────────────────────────────────────────────────────────

export const QUERY_LEARNINGS_TOOL = {
  name: 'query_learnings',
  description:
    'Consulta aprendizados atômicos extraídos de pipelines anteriores. ' +
    'Use para responder perguntas como "que ângulo funcionou melhor em X?", ' +
    '"o que aprendemos sobre copies para nicho Y?", ' +
    '"quais foram os melhores achados das últimas campanhas?". ' +
    'Retorna observações com nível de confiança e evidência.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description:
          'Filtro por categoria do aprendizado. ' +
          'Valores: angle, copy, persona, creative, targeting, compliance, other. ' +
          'Omita para buscar em todas as categorias.',
        enum: ['angle', 'copy', 'persona', 'creative', 'targeting', 'compliance', 'other'],
      },
      niche_id: {
        type: 'string',
        description: 'UUID do nicho para filtrar learnings específicos de um nicho.',
      },
      product_id: {
        type: 'string',
        description: 'UUID do produto para filtrar learnings de um produto específico.',
      },
      search: {
        type: 'string',
        description:
          'Busca por texto na observação. Ex: "medo", "autoridade", "depoimento". ' +
          'Usa full-text search em português.',
      },
      min_confidence: {
        type: 'number',
        description: 'Confiança mínima (0-1). Default 0.4.',
        minimum: 0,
        maximum: 1,
        default: 0.4,
      },
      limit: {
        type: 'integer',
        description: 'Máximo de resultados. Default 10, máximo 30.',
        default: 10,
        minimum: 1,
        maximum: 30,
      },
    },
    required: [],
  },
};

export async function executeQueryLearnings(
  input: Record<string, unknown>,
  ctx:   ToolContext,
): Promise<unknown> {
  const category      = input.category as string | undefined;
  const nicheId       = input.niche_id as string | undefined;
  const productId     = input.product_id as string | undefined;
  const search        = (input.search as string | undefined)?.trim();
  const minConfidence = Math.max(0, Math.min(1, (input.min_confidence as number | undefined) ?? 0.4));
  const limit         = Math.min(Math.max(1, (input.limit as number | undefined) ?? 10), 30);

  let query = ctx.supabase
    .from('execution_learnings')
    .select(
      'id, category, observation, evidence, confidence, product_id, niche_id, ' +
      'validated_by_user, created_at'
    )
    .eq('status', 'active')
    .neq('validated_by_user', false)    // exclui explicitamente invalidados
    .gte('confidence', String(minConfidence))
    .order('confidence', { ascending: false })
    .limit(limit);

  if (category)  query = query.eq('category', category);
  if (nicheId)   query = query.eq('niche_id', nicheId);
  if (productId) query = query.eq('product_id', productId);
  if (search) {
    query = query.textSearch('observation', search, {
      type: 'websearch',
      config: 'portuguese',
    });
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const learnings = ((data ?? []) as any[]).map((l) => ({
    id:               l.id,
    category:         l.category,
    observation:      l.observation,
    confidence:       parseFloat(l.confidence as string),
    evidence:         l.evidence ?? null,
    product_id:       l.product_id ?? null,
    niche_id:         l.niche_id ?? null,
    validated:        l.validated_by_user,
    created_at:       l.created_at,
  }));

  return {
    count: learnings.length,
    learnings,
    tip: learnings.length === 0
      ? 'Nenhum learning encontrado com esses filtros. Tente ampliar os critérios.'
      : undefined,
  };
}

// ── find_similar_campaigns ────────────────────────────────────────────────────

export const FIND_SIMILAR_CAMPAIGNS_TOOL = {
  name: 'find_similar_campaigns',
  description:
    'Encontra campanhas (pipelines) similares a um produto dado, baseado em ' +
    'nicho e learnings em comum. Use quando o usuário perguntar sobre ' +
    '"produtos parecidos", "histórico de campanhas similares" ou ' +
    '"o que funcionou para produtos como X". ' +
    'Retorna lista de pipelines com produto, goal e learnings associados.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_id: {
        type: 'string',
        description: 'UUID do produto de referência.',
      },
      niche_id: {
        type: 'string',
        description:
          'UUID do nicho. Se omitido, usa o nicho do produto informado. ' +
          'Informe diretamente se quiser buscar por nicho sem produto específico.',
      },
      limit: {
        type: 'integer',
        description: 'Máximo de pipelines a retornar. Default 5, máximo 15.',
        default: 5,
        minimum: 1,
        maximum: 15,
      },
    },
    required: [],
  },
};

export async function executeFindSimilarCampaigns(
  input: Record<string, unknown>,
  ctx:   ToolContext,
): Promise<unknown> {
  const productId = input.product_id as string | undefined;
  const limit     = Math.min(Math.max(1, (input.limit as number | undefined) ?? 5), 15);

  let nicheId = input.niche_id as string | undefined;

  // Resolve niche_id do produto se não fornecido
  if (!nicheId && productId) {
    const { data: product } = await ctx.supabase
      .from('products')
      .select('niche_id')
      .eq('id', productId)
      .maybeSingle();
    nicheId = product?.niche_id ?? undefined;
  }

  if (!nicheId && !productId) {
    return { error: 'Informe product_id ou niche_id para buscar campanhas similares.' };
  }

  // Busca pipelines do mesmo nicho com learnings
  let pipelinesQuery = ctx.supabase
    .from('pipelines')
    .select(
      'id, goal, status, cost_so_far_usd, created_at, ' +
      'products!inner(id, name, sku, niche_id)'
    )
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (nicheId) {
    pipelinesQuery = pipelinesQuery.eq('products.niche_id', nicheId);
  }
  if (productId) {
    pipelinesQuery = pipelinesQuery.neq('product_id', productId); // exclui o próprio produto
  }

  const { data: pipelinesData, error: pipelinesError } = await pipelinesQuery;
  if (pipelinesError) return { error: pipelinesError.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelines = (pipelinesData ?? []) as any[];
  if (pipelines.length === 0) {
    return {
      count: 0,
      pipelines: [],
      tip: 'Nenhum pipeline similar encontrado. Pode ser o primeiro produto deste nicho.',
    };
  }

  // Para cada pipeline, busca seus learnings
  const pipelineIds = pipelines.map((p: Record<string, unknown>) => p.id);
  const { data: learningsData } = await ctx.supabase
    .from('execution_learnings')
    .select('pipeline_id, category, observation, confidence')
    .in('pipeline_id', pipelineIds)
    .eq('status', 'active')
    .gte('confidence', '0.5')
    .order('confidence', { ascending: false });

  const learningsByPipeline = new Map<string, unknown[]>();
  for (const l of (learningsData ?? [])) {
    const pid = (l as Record<string, unknown>).pipeline_id as string;
    if (!learningsByPipeline.has(pid)) learningsByPipeline.set(pid, []);
    learningsByPipeline.get(pid)!.push({
      category:    (l as Record<string, unknown>).category,
      observation: (l as Record<string, unknown>).observation,
      confidence:  parseFloat((l as Record<string, unknown>).confidence as string),
    });
  }

  return {
    count: pipelines.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipelines: pipelines.map((p: any) => ({
      id:         p.id,
      goal:       p.goal,
      status:     p.status,
      cost_usd:   p.cost_so_far_usd,
      created_at: p.created_at,
      product:    p.products,
      learnings:  learningsByPipeline.get(p.id as string) ?? [],
    })),
  };
}

// ── get_insights ──────────────────────────────────────────────────────────────

export const GET_INSIGHTS_TOOL = {
  name: 'get_insights',
  description:
    'Retorna insights curados de alto nível sobre padrões de performance. ' +
    'Use para responder perguntas estratégicas como "o que o sistema aprendeu?", ' +
    '"quais são os principais insights de marketing?", ' +
    '"qual é o padrão mais confiante que temos?". ' +
    'Os insights são gerados pelo aggregator diário a partir de múltiplos learnings.',
  input_schema: {
    type: 'object' as const,
    properties: {
      min_importance: {
        type: 'integer',
        description: 'Importância mínima (1-5). Default 3. Use 4-5 para insights mais críticos.',
        minimum: 1,
        maximum: 5,
        default: 3,
      },
      limit: {
        type: 'integer',
        description: 'Máximo de insights. Default 5, máximo 20.',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
    },
    required: [],
  },
};

export async function executeGetInsights(
  input: Record<string, unknown>,
  ctx:   ToolContext,
): Promise<unknown> {
  const minImportance = Math.min(5, Math.max(1, (input.min_importance as number | undefined) ?? 3));
  const limit         = Math.min(Math.max(1, (input.limit as number | undefined) ?? 5), 20);

  const { data, error } = await ctx.supabase
    .from('insights')
    .select('id, title, body, importance, source, validated_by_user, created_at')
    .gte('importance', minImportance)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    insights: rows.map((i) => ({
      id:            i.id,
      title:         i.title,
      body:          i.body,
      importance:    i.importance,
      source:        i.source,
      validated:     i.validated_by_user,
      created_at:    i.created_at,
    })),
    tip: (data ?? []).length === 0
      ? 'Nenhum insight encontrado. O aggregator gera insights diariamente após acumular learnings suficientes.'
      : undefined,
  };
}
