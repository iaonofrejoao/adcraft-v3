// Gateway único para chamadas LLM via Gemini API.
// Regra 18: ÚNICO ponto de chamada LLM — nenhuma outra parte do código chama o SDK diretamente.
// Skill: gemini-cost-optimization.md | PRD seção 3.4
//
// Responsabilidades:
//   1. Carrega model assignment do AGENT_REGISTRY (Regra 17)
//   2. Carrega prompt do agente de workers/agents/prompts/{agent}.md
//   3. Injeta niche learnings no system prompt
//   4. Verifica/cria prompt cache no Gemini (TTL 1h) e salva em prompt_caches
//   5. Executa loop de function calling (web_search, read_page)
//   6. Loga em llm_calls com tokens e custo
//   7. Circuit breaker: pausa pipeline se cost_so_far_usd + estimate > budget_usd
//   8. Retorna { output, usage, cost_usd }

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type Tool,
  type FunctionDeclaration,
} from '@google/generative-ai';
import { eq, and, gt } from 'drizzle-orm';
import { db, supabase } from '../db';
import { llmCalls, promptCaches, pipelines, approvals } from '../../../frontend/lib/schema/index';
import { AGENT_REGISTRY, type AgentName, type CopyMode } from '../../../frontend/lib/agent-registry';
import { injectLearnings, AGENT_LEARNING_TYPES } from '../../../frontend/lib/knowledge/learning-injector';
import { executeSearchWeb, WEB_SEARCH_TOOL } from '../../../frontend/lib/tools/web-search';
import { executeReadPage, READ_PAGE_TOOL } from '../../../frontend/lib/tools/read-page';

// ── Tabela de preços (Gemini, abril 2026) ─────────────────────────────────────
const PRICE_INPUT_PER_1M: Record<string, number> = {
  'gemini-2.5-pro':   1.25,
  'gemini-2.5-flash': 0.075,
};
const PRICE_CACHED_PER_1M: Record<string, number> = {
  'gemini-2.5-pro':   0.31,
  'gemini-2.5-flash': 0.019,
};
const PRICE_OUTPUT_PER_1M: Record<string, number> = {
  'gemini-2.5-pro':   5.00,
  'gemini-2.5-flash': 0.30,
};

function calcCost(
  model: string,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): number {
  const billableInput = Math.max(0, inputTokens - cachedTokens);
  const pIn  = (PRICE_INPUT_PER_1M[model]  ?? 1.25)  / 1_000_000;
  const pCac = (PRICE_CACHED_PER_1M[model] ?? 0.31)  / 1_000_000;
  const pOut = (PRICE_OUTPUT_PER_1M[model] ?? 5.00)  / 1_000_000;
  return billableInput * pIn + cachedTokens * pCac + outputTokens * pOut;
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

// ── Tipos públicos ────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.resolve(__dirname, '../../agents/prompts');

function loadPrompt(agentName: string): string {
  const file = path.join(PROMPTS_DIR, `${agentName}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`Prompt file not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf-8').trim();
}

// ── Ferramentas Gemini ────────────────────────────────────────────────────────

function toFunctionDeclaration(
  toolDef: typeof WEB_SEARCH_TOOL | typeof READ_PAGE_TOOL,
): FunctionDeclaration {
  return {
    name:        toolDef.name,
    description: toolDef.description,
    parameters:  toolDef.input_schema as any,
  };
}

const GEMINI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      toFunctionDeclaration(WEB_SEARCH_TOOL),
      toFunctionDeclaration(READ_PAGE_TOOL),
    ],
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'search_web':
      return executeSearchWeb(
        args.query as string,
        (args.num_results as number | undefined) ?? 5,
      );
    case 'read_page':
      return executeReadPage(
        args.url as string,
        (args.extract_mode as 'text' | 'structured' | undefined) ?? 'text',
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Prompt caching ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

async function findValidCache(cacheKey: string): Promise<string | null> {
  const row = await db.query.promptCaches.findFirst({
    where: and(
      eq(promptCaches.cache_key, cacheKey),
      gt(promptCaches.expires_at, new Date()),
    ),
  });
  return row?.gemini_cache_name ?? null;
}

async function upsertCacheRecord(cacheKey: string, geminiCacheName: string): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await db
    .insert(promptCaches)
    .values({
      id:                randomUUID(),
      cache_key:         cacheKey,
      gemini_cache_name: geminiCacheName,
      expires_at:        expiresAt,
    })
    .onConflictDoUpdate({
      target: promptCaches.cache_key,
      set: {
        gemini_cache_name: geminiCacheName,
        expires_at:        expiresAt,
      },
    });
}

/**
 * Tenta criar um cache de sistema via GoogleAICacheManager (Node.js only).
 * Retorna null se o SDK não suportar caching nesta versão.
 */
async function createGeminiCache(
  model: string,
  systemInstruction: string,
): Promise<string | null> {
  try {
    // GoogleAICacheManager disponível em @google/generative-ai/server
    const { GoogleAICacheManager } = await import('@google/generative-ai/server' as any);
    const manager = new GoogleAICacheManager(process.env.GEMINI_API_KEY!);
    const cache = await manager.create({
      model:             `models/${model}`,
      systemInstruction: systemInstruction,
      ttlSeconds:        CACHE_TTL_MS / 1000,
    });
    return (cache.name ?? null) as string | null;
  } catch {
    return null;
  }
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

async function checkBudget(pipelineId: string, estimatedCost: number): Promise<void> {
  const row = await db.query.pipelines.findFirst({
    where: eq(pipelines.id, pipelineId),
  });
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

// ── Atualiza custo do pipeline ────────────────────────────────────────────────

async function incrementPipelineCost(pipelineId: string, delta: number): Promise<void> {
  // Usa RPC atômica para evitar race condition com outros workers
  await supabase.rpc('increment_pipeline_cost', {
    p_pipeline_id: pipelineId,
    p_delta:       delta,
  });
}

// ── Logging ───────────────────────────────────────────────────────────────────

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
  });
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Chama um agente via Gemini API com function calling loop e prompt caching.
 * Regra 18: único ponto de entrada — nunca chame o SDK Gemini diretamente.
 */
export async function callAgent(params: CallAgentParams): Promise<CallAgentResult> {
  const cap   = AGENT_REGISTRY[params.agent_name];
  const model = cap.model;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

  // ── 3. Prompt cache ───────────────────────────────────────────────────────
  const cacheKey = `${params.agent_name}:${params.niche_slug ?? 'global'}`;
  let cachedName = await findValidCache(cacheKey);
  if (!cachedName) {
    cachedName = await createGeminiCache(model, systemInstruction);
    if (cachedName) {
      await upsertCacheRecord(cacheKey, cachedName);
    }
  }

  // ── 4. Estimativa de custo e circuit breaker ──────────────────────────────
  // ~4 chars/token como heurística conservadora
  const estimatedIn  = Math.ceil(systemInstruction.length / 4) +
                       Math.ceil(params.dynamic_input.length / 4);
  const estimatedOut = 1500;
  const estimatedCost = calcCost(model, estimatedIn, 0, estimatedOut);

  if (params.pipeline_id) {
    await checkBudget(params.pipeline_id, estimatedCost);
  }

  // ── 5. Configura modelo ───────────────────────────────────────────────────
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemInstruction,
    tools: GEMINI_TOOLS,
    generationConfig: { temperature: 1.0 },
  });

  const chat = geminiModel.startChat();

  // ── 6. Loop de function calling ───────────────────────────────────────────
  const startedAt = Date.now();
  let totalInput  = 0;
  let totalCached = 0;
  let totalOutput = 0;
  let finalText   = '';

  let result = await chat.sendMessage(params.dynamic_input);
  const MAX_ROUNDS = 12;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const meta = result.response.usageMetadata;
    totalInput  += meta?.promptTokenCount       ?? 0;
    totalCached += meta?.cachedContentTokenCount ?? 0;
    totalOutput += meta?.candidatesTokenCount    ?? 0;

    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) {
      finalText = result.response.text();
      break;
    }

    // Executa tools em paralelo
    const toolParts: Part[] = await Promise.all(
      calls.map(async (fc) => {
        const toolResult = await executeTool(
          fc.name,
          fc.args as Record<string, unknown>,
        );
        return {
          functionResponse: { name: fc.name, response: toolResult },
        } as Part;
      }),
    );

    result = await chat.sendMessage(toolParts);
  }

  const durationMs = Date.now() - startedAt;

  // ── 7. Custo real e logging ───────────────────────────────────────────────
  const realCost = calcCost(model, totalInput, totalCached, totalOutput);
  const usage: LLMUsage = {
    input_tokens:  totalInput,
    cached_tokens: totalCached,
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

  // ── 8. Parse JSON ─────────────────────────────────────────────────────────
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
