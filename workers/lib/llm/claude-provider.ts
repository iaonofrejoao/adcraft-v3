// Provider Anthropic Claude para agentes de texto/análise.
// Regra 18: chamado exclusivamente por gemini-client.ts::callAgent quando model.startsWith('claude-').
// Dependência unidirecional — NÃO importa de gemini-client.ts.
//
// Responsabilidades:
//   1. Tipos públicos compartilhados (CallAgentParams, CallAgentResult, LLMUsage, BudgetExceededError)
//   2. Carrega prompt do agente via loadPrompt()
//   3. Injeta niche learnings no system prompt
//   4. Prompt caching via cache_control: { type: 'ephemeral' } na mensagem de sistema
//   5. Loop de tool use (search_web, read_page) com conversão de formato Gemini → Claude
//   6. Circuit breaker de budget (mesma lógica do Gemini)
//   7. Loga em llm_calls com tokens e custo
//   8. Retorna { output, usage, cost_usd }

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, supabase } from '../db';
import { llmCalls, pipelines, approvals } from '../../../frontend/lib/schema/index';
import { AGENT_REGISTRY, type AgentName, type CopyMode } from '../../../frontend/lib/agent-registry';
import { injectLearnings, AGENT_LEARNING_TYPES } from '../../../frontend/lib/knowledge/learning-injector';
import { executeSearchWeb, WEB_SEARCH_TOOL } from '../../../frontend/lib/tools/web-search';
import { executeReadPage, READ_PAGE_TOOL } from '../../../frontend/lib/tools/read-page';

// ── Tipos públicos (re-exportados por gemini-client.ts) ───────────────────────

export interface CallAgentParams {
  agent_name:   AgentName;
  /** Null para tasks de manutenção (ex: niche_curator sem pipeline) */
  pipeline_id:  string | null;
  product_id?:  string;
  niche_id?:    string;
  /** Slug legível do nicho para compor a cache key */
  niche_slug?:  string;
  /** Mensagem do usuário: contexto dinâmico do produto/state */
  dynamic_input: string;
  /** Para copy_hook_generator */
  mode?: CopyMode;
}

export interface LLMUsage {
  input_tokens:  number;
  cached_tokens: number;
  output_tokens: number;
}

export interface CallAgentResult {
  output:   Record<string, unknown> | string;
  usage:    LLMUsage;
  cost_usd: number;
}

// ── Erro de budget excedido ───────────────────────────────────────────────────

export class BudgetExceededError extends Error {
  constructor(
    public readonly pipelineId: string,
    public readonly budgetUsd: number,
    public readonly costSoFar: number,
  ) {
    super(
      `Pipeline ${pipelineId}: budget $${budgetUsd} exceeded ` +
      `(cost so far: $${costSoFar.toFixed(4)})`,
    );
    this.name = 'BudgetExceededError';
  }
}

// ── Pricing Anthropic (abril 2026) ────────────────────────────────────────────
// Verificar em https://docs.anthropic.com/en/docs/about-claude/models#api-models
// Preços em USD por 1M tokens.

interface ModelPricing {
  input:        number;
  output:       number;
  cacheWrite:   number; // criação de cache (≈ 1.25x input)
  cacheRead:    number; // leitura de cache (≈ 10% input)
}

const CLAUDE_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    input:      15.00,
    output:     75.00,
    cacheWrite: 18.75,
    cacheRead:   1.50,
  },
  'claude-sonnet-4-6': {
    input:       3.00,
    output:     15.00,
    cacheWrite:  3.75,
    cacheRead:   0.30,
  },
  'claude-haiku-4-5-20251001': {
    input:       0.80,
    output:      4.00,
    cacheWrite:  1.00,
    cacheRead:   0.08,
  },
};

function calcCostClaude(
  model: string,
  inputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  outputTokens: number,
): number {
  const pricing = CLAUDE_PRICING[model];
  if (!pricing) {
    // Fallback: usa Sonnet como proxy para modelos não mapeados
    console.warn(`[claude-provider] Pricing não encontrado para ${model} — usando Sonnet como fallback`);
    return calcCostClaude('claude-sonnet-4-6', inputTokens, cacheCreationTokens, cacheReadTokens, outputTokens);
  }
  const toM = 1 / 1_000_000;
  return (
    inputTokens          * pricing.input      * toM +
    cacheCreationTokens  * pricing.cacheWrite * toM +
    cacheReadTokens      * pricing.cacheRead  * toM +
    outputTokens         * pricing.output     * toM
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.resolve(__dirname, '../../agents/prompts');

function loadPrompt(agentName: string): string {
  const file = path.join(PROMPTS_DIR, `${agentName}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`Prompt file not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf-8').trim();
}

// ── Ferramentas Claude ────────────────────────────────────────────────────────

const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name:         WEB_SEARCH_TOOL.name,
    description:  WEB_SEARCH_TOOL.description,
    input_schema: WEB_SEARCH_TOOL.input_schema as Anthropic.Tool['input_schema'],
  },
  {
    name:         READ_PAGE_TOOL.name,
    description:  READ_PAGE_TOOL.description,
    input_schema: READ_PAGE_TOOL.input_schema as Anthropic.Tool['input_schema'],
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'search_web':
      return executeSearchWeb(
        input.query as string,
        (input.num_results as number | undefined) ?? 5,
      );
    case 'read_page':
      return executeReadPage(
        input.url as string,
        (input.extract_mode as 'text' | 'structured' | undefined) ?? 'text',
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

async function checkBudget(pipelineId: string, estimatedCost: number): Promise<void> {
  // Usa select explícito para evitar incompatibilidade de tipos com db.query (Proxy lazy)
  const rows = await db
    .select({ budget_usd: pipelines.budget_usd, cost_so_far_usd: pipelines.cost_so_far_usd })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row) return;

  const budget    = parseFloat((row.budget_usd      as string | null) ?? '999');
  const costSoFar = parseFloat((row.cost_so_far_usd as string | null) ?? '0');

  if (costSoFar + estimatedCost > budget) {
    await db
      .update(pipelines)
      .set({ status: 'paused' })
      .where(eq(pipelines.id, pipelineId));

    await db.insert(approvals).values({
      id:            randomUUID(),
      pipeline_id:   pipelineId,
      approval_type: 'budget_exceeded',
      payload: {
        budget_usd:          budget,
        cost_so_far_usd:     costSoFar,
        estimated_call_cost: estimatedCost,
      },
      status: 'pending',
    });

    throw new BudgetExceededError(pipelineId, budget, costSoFar);
  }
}

async function incrementPipelineCost(pipelineId: string, delta: number): Promise<void> {
  await supabase.rpc('increment_pipeline_cost', {
    p_pipeline_id: pipelineId,
    p_delta:       delta,
  });
}

async function logCall(
  agentName: string,
  pipelineId: string | null,
  productId: string | undefined,
  nicheId: string | undefined,
  model: string,
  usage: LLMUsage,
  costUsd: number,
  durationMs: number,
): Promise<void> {
  await db.insert(llmCalls).values({
    id:                  randomUUID(),
    agent_name:          agentName,
    pipeline_id:         pipelineId ?? undefined,
    product_id:          productId,
    niche_id:            nicheId,
    model,
    input_tokens:        usage.input_tokens,
    cached_input_tokens: usage.cached_tokens,
    output_tokens:       usage.output_tokens,
    cost_usd:            costUsd.toFixed(6),
    duration_ms:         durationMs,
    payload:             null,
  });
}

// ── Função principal ──────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_ROUNDS = 12;

/**
 * Chama um agente via Anthropic Claude com tool use loop e prompt caching.
 * Regra 18: chamado por gemini-client.ts::callAgent — nunca diretamente.
 */
export async function callAgentClaude(params: CallAgentParams): Promise<CallAgentResult> {
  const cap   = AGENT_REGISTRY[params.agent_name];
  const model = cap.model;

  // ── 1. System prompt base ─────────────────────────────────────────────────
  let basePrompt = loadPrompt(params.agent_name);
  if (params.mode) {
    basePrompt = `${basePrompt}\n\n## Modo de execução: ${params.mode}`;
  }

  // ── 2. Injeção de niche learnings ─────────────────────────────────────────
  let learningsBlock = '';
  if (params.niche_id) {
    const types = AGENT_LEARNING_TYPES[params.agent_name] ?? [];
    if (types.length > 0) {
      try {
        const result = await injectLearnings(
          { niche_id: params.niche_id, types, product_id: params.product_id },
          supabase as any,
        );
        learningsBlock = result.prompt_block;
      } catch {
        // Learnings são opcionais — não bloqueia o agente
      }
    }
  }

  const systemInstruction = learningsBlock
    ? `${basePrompt}\n\n${learningsBlock}`
    : basePrompt;

  // ── 3. Estimativa de custo e circuit breaker ──────────────────────────────
  const pricing = CLAUDE_PRICING[model];
  const estimatedIn  = Math.ceil(systemInstruction.length / 4) +
                       Math.ceil(params.dynamic_input.length / 4);
  const estimatedOut = 1500;
  const estimatedCost = (estimatedIn * (pricing?.input ?? 3.00) +
                         estimatedOut * (pricing?.output ?? 15.00)) / 1_000_000;

  if (params.pipeline_id) {
    await checkBudget(params.pipeline_id, estimatedCost);
  }

  // ── 4. Loop de tool use ───────────────────────────────────────────────────
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: params.dynamic_input },
  ];

  const startedAt = Date.now();
  let totalInput         = 0;
  let totalCacheCreation = 0;
  let totalCacheRead     = 0;
  let totalOutput        = 0;
  let finalText          = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      // cache_control no system prompt → Claude armazena automaticamente em cache
      system: [
        {
          type:          'text',
          text:          systemInstruction,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools:    CLAUDE_TOOLS,
      messages,
    });

    // Acumula tokens
    const u = response.usage as Anthropic.Usage & {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?:     number;
    };
    totalInput         += u.input_tokens         ?? 0;
    totalCacheCreation += u.cache_creation_input_tokens ?? 0;
    totalCacheRead     += u.cache_read_input_tokens     ?? 0;
    totalOutput        += u.output_tokens        ?? 0;

    // Adiciona resposta do modelo à conversa
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      // Extrai texto da resposta final
      const textBlock = response.content.find((b) => b.type === 'text');
      finalText = textBlock && 'text' in textBlock ? textBlock.text : '';
      break;
    }

    // Executa tools em paralelo
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          return {
            type:        'tool_result' as const,
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          };
        } catch (err) {
          return {
            type:        'tool_result' as const,
            tool_use_id: block.id,
            content:     JSON.stringify({ error: String(err) }),
            is_error:    true,
          };
        }
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  const durationMs = Date.now() - startedAt;

  // ── 5. Custo real e logging ───────────────────────────────────────────────
  const realCost = calcCostClaude(model, totalInput, totalCacheCreation, totalCacheRead, totalOutput);

  // LLMUsage.cached_tokens representa tokens lidos do cache (o lado barato)
  const usage: LLMUsage = {
    input_tokens:  totalInput + totalCacheCreation,
    cached_tokens: totalCacheRead,
    output_tokens: totalOutput,
  };

  await logCall(
    params.agent_name,
    params.pipeline_id,
    params.product_id,
    params.niche_id,
    model,
    usage,
    realCost,
    durationMs,
  );

  if (params.pipeline_id) {
    await incrementPipelineCost(params.pipeline_id, realCost);
  }

  // ── 6. Parse JSON ─────────────────────────────────────────────────────────
  let output: Record<string, unknown> | string;
  try {
    const cleaned = finalText
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/\s*```$/im, '')
      .trim();
    output = JSON.parse(cleaned);
  } catch {
    output = finalText;
  }

  return { output, usage, cost_usd: realCost };
}
