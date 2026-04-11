// Injeção de niche learnings no contexto dos agentes.
// Usa busca híbrida: filtro relacional + pgvector cosine distance.
// PRD seção 7.2 / Skill pgvector-search.md | Fase 2.7.2
//
// Fluxo: context-builder chama injectLearnings(niche_id, types, product_id) antes
// de cada chamada de agente. O resultado é formatado como bloco de texto e
// concatenado ao prompt do agente.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { LearningType } from './niche-learnings';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LearningForInjection {
  id: string;
  learning_type: string;
  content: string;
  confidence: number;
  occurrences: number;
}

export interface InjectLearningsOptions {
  niche_id: string;
  /** Tipos de learning relevantes para o agente sendo chamado */
  types: LearningType[];
  /** ID do produto atual — usado para buscar o embedding e fazer ranking semântico */
  product_id?: string;
  /** Limite de learnings a injetar (default 15, conforme PRD) */
  limit?: number;
}

export interface InjectionResult {
  learnings: LearningForInjection[];
  /** Bloco de texto pronto para injetar no system prompt do agente */
  prompt_block: string;
  /** true se o ranking semântico foi usado (embedding do produto encontrado) */
  semantic_ranking: boolean;
}

// ── Cliente de serviço ────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key not configured');
  }
  return createSupabaseClient(url, key);
}

// ── Busca de embedding do produto ────────────────────────────────────────────

/**
 * Retorna o vetor de embedding de um produto (a partir da tabela embeddings,
 * onde source_table='product_knowledge' e o artifact_type='product').
 * Retorna null se não houver embedding gerado ainda.
 */
export async function getProductEmbedding(
  product_id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<number[] | null> {
  const client = supabaseClient ?? getServiceClient();

  // Busca o embedding do artifact 'product' mais recente (fresh) para este produto
  const { data } = await client
    .from('product_knowledge')
    .select('id')
    .eq('product_id', product_id)
    .eq('artifact_type', 'product')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const { data: embRow } = await client
    .from('embeddings')
    .select('embedding')
    .eq('source_table', 'product_knowledge')
    .eq('source_id', data.id)
    .not('embedding', 'is', null)
    .maybeSingle();

  if (!embRow?.embedding) return null;

  // Supabase retorna embedding como string "[0.1,0.2,...]" ou number[]
  const raw = embRow.embedding;
  if (typeof raw === 'string') {
    return JSON.parse(raw) as number[];
  }
  return raw as number[];
}

// ── Query híbrida via RPC ─────────────────────────────────────────────────────

/**
 * Executa query_niche_learnings (RPC) com ou sem ranking semântico.
 * Delega para a função PL/pgSQL em 0003_niche_intelligence_rpcs.sql.
 */
async function queryNicheLearnings(
  niche_id: string,
  types: LearningType[],
  queryVector: number[] | null,
  limit: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
): Promise<LearningForInjection[]> {
  const { data, error } = await client.rpc('query_niche_learnings', {
    p_niche_id:     niche_id,
    p_types:        types,
    p_query_vector: queryVector ? `[${queryVector.join(',')}]` : null,
    p_limit:        limit,
  });

  if (error) {
    throw new Error(`query_niche_learnings RPC failed: ${error.message}`);
  }

  return (data ?? []) as LearningForInjection[];
}

// ── Formatação para prompt ────────────────────────────────────────────────────

/**
 * Formata lista de learnings como bloco de texto para injeção no system prompt.
 * Agrupa por tipo para facilitar leitura pelo modelo.
 */
export function formatLearningsForPrompt(learnings: LearningForInjection[]): string {
  if (learnings.length === 0) return '';

  // Agrupa por learning_type
  const grouped = new Map<string, LearningForInjection[]>();
  for (const l of learnings) {
    const arr = grouped.get(l.learning_type) ?? [];
    arr.push(l);
    grouped.set(l.learning_type, arr);
  }

  const TYPE_LABEL: Record<string, string> = {
    angle_winner:       'Ângulos que funcionam neste nicho',
    angle_loser:        'Ângulos que NÃO funcionam neste nicho',
    hook_pattern:       'Padrões de hook que convertem',
    creative_format:    'Formatos criativos validados',
    objection:          'Objeções comuns do avatar',
    language_pattern:   'Padrões de linguagem do avatar',
    avatar_insight:     'Insights de avatar',
    compliance_violation: 'Violações de compliance frequentes (evitar)',
  };

  const lines: string[] = ['## Niche Intelligence — learnings do nicho\n'];

  for (const [type, items] of grouped) {
    const label = TYPE_LABEL[type] ?? type;
    lines.push(`### ${label}`);
    for (const item of items) {
      const conf = Math.round(item.confidence * 100);
      lines.push(`- ${item.content} _(confiança: ${conf}%, ${item.occurrences} sinal${item.occurrences !== 1 ? 'ais' : ''}))_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Função principal do injector.
 *
 * 1. Busca embedding do produto (se product_id fornecido)
 * 2. Executa query híbrida via RPC `query_niche_learnings`
 * 3. Retorna learnings + bloco formatado pronto para o prompt
 *
 * Chamada pelo context-builder (Fase 3.2) antes de cada task de agente.
 */
export async function injectLearnings(
  opts: InjectLearningsOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any
): Promise<InjectionResult> {
  const client = supabaseClient ?? getServiceClient();
  const limit = opts.limit ?? 15;

  // Tenta obter embedding semântico do produto para ranking vetorial
  let queryVector: number[] | null = null;
  if (opts.product_id) {
    queryVector = await getProductEmbedding(opts.product_id, client);
  }

  const learnings = await queryNicheLearnings(
    opts.niche_id,
    opts.types,
    queryVector,
    limit,
    client
  );

  return {
    learnings,
    prompt_block:     formatLearningsForPrompt(learnings),
    semantic_ranking: queryVector !== null,
  };
}

// ── Helpers de conveniência por agente ───────────────────────────────────────

/**
 * Mapa de agent_name → tipos de learning relevantes.
 * Usado pelo context-builder para saber quais tipos injetar em cada agente.
 */
export const AGENT_LEARNING_TYPES: Record<string, LearningType[]> = {
  avatar_research:    ['avatar_insight', 'language_pattern', 'objection'],
  market_research:    ['angle_winner', 'angle_loser', 'objection'],
  angle_generator:    ['angle_winner', 'angle_loser', 'hook_pattern', 'objection'],
  copy_hook_generator: ['hook_pattern', 'language_pattern', 'creative_format', 'angle_winner', 'angle_loser'],
  anvisa_compliance:  ['compliance_violation'],
  niche_curator:      ['angle_winner', 'angle_loser', 'hook_pattern', 'creative_format',
                       'objection', 'language_pattern', 'avatar_insight', 'compliance_violation'],
};
