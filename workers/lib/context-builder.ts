// Constrói o contexto mínimo para um agente antes de cada chamada LLM.
// Regra 5: context builder obrigatório — nunca passar pipeline.state completo.
// Extrai apenas os artifact_types listados em AGENT_REGISTRY[agent].requires.
// Injeta niche learnings e respeita max_input_tokens.
// Fase 3.2

import * as path from 'path';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { productKnowledge, pipelines } from '../../frontend/lib/schema/index';
import { AGENT_REGISTRY, type AgentName, type ArtifactType } from '../../frontend/lib/agent-registry';
import { injectLearnings, AGENT_LEARNING_TYPES } from '../../frontend/lib/knowledge/learning-injector';
import { supabase } from './db';

// Heurística simples: ~4 chars por token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface BuiltContext {
  /** JSON serializado dos artifacts requeridos pelo agente */
  context_json:    Record<string, unknown>;
  /** Bloco de texto de learnings pronto para injeção no prompt */
  learnings_block: string;
  /** true se contexto foi truncado por max_input_tokens */
  truncated:       boolean;
}

/**
 * Retorna o artifact mais recente e fresco de um produto.
 */
async function fetchArtifact(
  product_id: string,
  artifact_type: ArtifactType,
): Promise<Record<string, unknown> | null> {
  const row = await db.query.productKnowledge.findFirst({
    where: and(
      eq(productKnowledge.product_id, product_id),
      eq(productKnowledge.artifact_type, artifact_type),
      eq(productKnowledge.status, 'fresh'),
    ),
    orderBy: (pk, { desc }) => [desc(pk.created_at)],
  });
  return (row?.artifact_data as Record<string, unknown> | null) ?? null;
}

/**
 * Busca todos os artifacts requeridos para um agente e monta o context_json.
 *
 * @param agentName  - Nome do agente (deve existir no AGENT_REGISTRY)
 * @param productId  - UUID do produto
 * @param pipelineId - UUID do pipeline (para log e fallback de state)
 * @param niches     - { niche_id, niche_slug } do produto (opcional)
 */
export async function buildContext(
  agentName: AgentName,
  productId: string,
  pipelineId: string,
  niches?: { niche_id: string; niche_slug: string },
): Promise<BuiltContext> {
  const cap = AGENT_REGISTRY[agentName];
  const maxTokens = cap.max_input_tokens;

  // ── 1. Coleta cada artifact requerido ─────────────────────────────────────
  const context_json: Record<string, unknown> = {};

  for (const artifactType of cap.requires) {
    const data = await fetchArtifact(productId, artifactType);
    if (data !== null) {
      context_json[artifactType] = data;
    }
  }

  // ── 2. Injeta niche learnings ─────────────────────────────────────────────
  let learnings_block = '';
  if (niches?.niche_id) {
    const types = AGENT_LEARNING_TYPES[agentName] ?? [];
    if (types.length > 0) {
      try {
        const result = await injectLearnings(
          {
            niche_id:   niches.niche_id,
            types,
            product_id: productId,
            limit:      15,
          },
          supabase as any,
        );
        learnings_block = result.prompt_block;
      } catch {
        // Learnings opcionais
      }
    }
  }

  // ── 3. Verifica token budget ───────────────────────────────────────────────
  const contextStr    = JSON.stringify(context_json);
  const learningsStr  = learnings_block;
  const totalEstimate = estimateTokens(contextStr) + estimateTokens(learningsStr);

  let truncated = false;

  if (totalEstimate > maxTokens) {
    truncated = true;
    // Estratégia de truncagem: remove artifacts menos prioritários primeiro.
    // 'product' e 'avatar' têm maior prioridade; 'angles', 'copy_components' podem ser comprimidos.
    const priority: ArtifactType[] = ['product', 'avatar', 'market', 'angles', 'copy_components', 'compliance_results', 'copy_combinations_selected', 'video_assets'];
    const sorted = cap.requires
      .slice()
      .sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

    let budget = maxTokens - estimateTokens(learningsStr) - 200; // 200 tokens de margem

    const trimmed: Record<string, unknown> = {};
    for (const key of sorted) {
      if (context_json[key] === undefined) continue;
      const serialized = JSON.stringify(context_json[key]);
      const tokens     = estimateTokens(serialized);
      if (budget <= 0) break;
      if (tokens <= budget) {
        trimmed[key] = context_json[key];
        budget -= tokens;
      } else {
        // Inclui versão truncada (primeiros ~budget*4 chars do JSON)
        const sliced = serialized.slice(0, budget * 4);
        try {
          trimmed[key] = JSON.parse(sliced);
        } catch {
          trimmed[key] = { _truncated: true };
        }
        budget = 0;
      }
    }

    return { context_json: trimmed, learnings_block, truncated };
  }

  return { context_json, learnings_block, truncated };
}

/**
 * Serializa o context_json para a mensagem dinâmica do usuário enviada ao LLM.
 * Formata como bloco JSON legível para o modelo.
 */
export function serializeContext(ctx: BuiltContext): string {
  const lines: string[] = ['## Contexto do produto e artifacts\n'];
  lines.push('```json');
  lines.push(JSON.stringify(ctx.context_json, null, 2));
  lines.push('```');

  if (ctx.truncated) {
    lines.push('\n> ⚠️ Contexto truncado por limite de tokens.');
  }

  return lines.join('\n');
}
