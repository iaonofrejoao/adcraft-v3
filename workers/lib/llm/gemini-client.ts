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
import { eq } from 'drizzle-orm';
import { db, supabase } from '../db';
import { llmCalls, pipelines, approvals } from '../../../frontend/lib/schema/index';
import { AGENT_REGISTRY, type AgentName, type CopyMode } from '../../../frontend/lib/agent-registry';
import { injectLearnings, AGENT_LEARNING_TYPES } from '../../../frontend/lib/knowledge/learning-injector';
import { executeSearchWeb, WEB_SEARCH_TOOL } from '../../../frontend/lib/tools/web-search';
import { executeReadPage, READ_PAGE_TOOL } from '../../../frontend/lib/tools/read-page';
import { createOrGetCache } from './prompt-cache';

// ── Tipos Gemini REST API ─────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { id?: string; name: string; args: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: unknown };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface GeminiGenerateResponse {
  candidates?: Array<{ content: GeminiContent }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

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

const FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name:        WEB_SEARCH_TOOL.name,
    description: WEB_SEARCH_TOOL.description,
    parameters:  WEB_SEARCH_TOOL.input_schema as Record<string, unknown>,
  },
  {
    name:        READ_PAGE_TOOL.name,
    description: READ_PAGE_TOOL.description,
    parameters:  READ_PAGE_TOOL.input_schema as Record<string, unknown>,
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Gemini 2.5 às vezes alucina nomes curtos de tools
  // (padrões do treinamento do Google Search grounding).
  // Tratamos aliases conhecidos aqui.
  const KNOWN_ALIASES: Record<string, string> = {
    'search':        'search_web',
    'web_search':    'search_web',
    'google_search': 'search_web',
    'fetch_page':    'read_page',
    'read_url':      'read_page',
  };

  const canonicalName = KNOWN_ALIASES[name] ?? name;

  if (canonicalName !== name) {
    console.warn(
      `[gemini-client] tool name alias detected: "${name}" → "${canonicalName}". ` +
      `Gemini pode estar alucinando o nome. Monitorar frequência.`,
    );
  }

  switch (canonicalName) {
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
      throw new Error(
        `Unknown tool: ${name}` +
        (canonicalName !== name ? ` (tried alias "${canonicalName}")` : ''),
      );
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
  payload?: Record<string, unknown>,
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
    payload:             payload ?? null,
  });
}

// ── Embedding via fetch puro (sem SDK) ───────────────────────────────────────
//
// Deliberado: mantém gemini-client.ts livre de dependência no @google/genai.
// Consistente com o que o frontend/lib/embeddings/gemini-embeddings.ts já fazia.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;
const EMBED_BATCH_SIZE = 100;
const EMBED_PRICE_PER_1M = 0.025; // USD por 1M tokens de input (gemini-embedding-001)

export interface CallEmbeddingParams {
  texts: string | string[];
  source_table: string;
  source_id: string;
  niche_id?: string;
  product_id?: string;
}

interface BatchEmbedResponse {
  embeddings: Array<{ values: number[] }>;
  // Gemini pode retornar usageMetadata a nível de resposta (quando disponível)
  usageMetadata?: { totalTokenCount?: number };
}

/**
 * Gera embeddings via Gemini batchEmbedContents usando fetch puro.
 * Regra 18: toda chamada LLM (incluindo embeddings) passa por gemini-client.ts.
 *
 * - Se texts é string: processa como batch de 1 elemento, retorna number[][]
 * - Se texts é string[]: processa em batches de até 100 por chamada
 * - Loga em llm_calls com agent_name='embedding'
 * - source_table/source_id são gravados em llm_calls.payload como
 *   { source_table, source_id } para rastreamento fino de custo.
 * - product_id e niche_id são mapeados diretamente em colunas dedicadas.
 */
export async function callEmbedding(params: CallEmbeddingParams): Promise<number[][]> {
  const isSingle = typeof params.texts === 'string';
  const inputTexts: string[] = isSingle ? [params.texts as string] : (params.texts as string[]);

  const allVectors: number[][] = [];
  let totalInputTokens = 0;
  const startedAt = Date.now();

  for (let offset = 0; offset < inputTexts.length; offset += EMBED_BATCH_SIZE) {
    const batch = inputTexts.slice(offset, offset + EMBED_BATCH_SIZE);

    const url =
      `${GEMINI_API_BASE}/models/${EMBED_MODEL}:batchEmbedContents` +
      `?key=${process.env.GEMINI_API_KEY!}`;

    const requests = batch.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIM,
    }));

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini batchEmbedContents error ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as BatchEmbedResponse;

    // Tokens: usa usageMetadata da resposta se disponível; senão estima pelo texto
    if (typeof data.usageMetadata?.totalTokenCount === 'number') {
      totalInputTokens += data.usageMetadata.totalTokenCount;
    } else {
      for (const text of batch) {
        totalInputTokens += Math.ceil(text.length / 4);
      }
    }

    for (const emb of data.embeddings ?? []) {
      allVectors.push(emb.values ?? []);
    }
  }

  const durationMs = Date.now() - startedAt;
  const costUsd = (totalInputTokens / 1_000_000) * EMBED_PRICE_PER_1M;

  await logCall(
    'embedding',
    null, // embeddings não têm pipeline_id
    params.product_id,
    params.niche_id,
    EMBED_MODEL,
    { input_tokens: totalInputTokens, cached_tokens: 0, output_tokens: 0 },
    costUsd,
    durationMs,
    { source_table: params.source_table, source_id: params.source_id },
  );

  return allVectors;
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Chama um agente via Gemini API com function calling loop e prompt caching.
 * Regra 18: único ponto de entrada — nunca chame o SDK Gemini diretamente.
 * Usa fetch puro para generateContent; cache gerenciado por prompt-cache.ts.
 */
export async function callAgent(params: CallAgentParams): Promise<CallAgentResult> {
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

  // Conteúdo estático: system prompt + learnings (estável por agente+nicho)
  const systemInstruction = learningsBlock
    ? `${basePrompt}\n\n${learningsBlock}`
    : basePrompt;

  // ── 3. Prompt cache ───────────────────────────────────────────────────────
  const cacheKey = `${params.agent_name}:${params.niche_slug ?? 'global'}`;
  const cacheResult = await createOrGetCache({
    cache_key: cacheKey,
    content:   systemInstruction,
    model,
  });

  // ── 4. Estimativa de custo e circuit breaker ──────────────────────────────
  const estimatedIn  = Math.ceil(systemInstruction.length / 4) +
                       Math.ceil(params.dynamic_input.length / 4);
  const estimatedOut = 1500;
  const estimatedCost = calcCost(model, estimatedIn, 0, estimatedOut);

  if (params.pipeline_id) {
    await checkBudget(params.pipeline_id, estimatedCost);
  }

  // ── 5. Inicializa conversa ────────────────────────────────────────────────
  const messages: GeminiContent[] = [
    { role: 'user', parts: [{ text: params.dynamic_input }] },
  ];

  // ── 6. Loop de function calling via fetch puro ────────────────────────────
  const startedAt = Date.now();
  let totalInput  = 0;
  let totalCached = 0;
  let totalOutput = 0;
  let finalText   = '';

  const MAX_ROUNDS = 12;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reqBody: Record<string, unknown> = {
      contents:         messages,
      tools:            [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: { temperature: 1.0 },
    };

    if (cacheResult) {
      // Cache contém o conteúdo estático — não duplicar inline
      reqBody.cachedContent = cacheResult.cache_name;
    } else {
      reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }


    const res = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify(reqBody),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini generateContent error ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as GeminiGenerateResponse;

    // Acumula tokens — cached_input_tokens vem de cachedContentTokenCount
    const meta = data.usageMetadata;
    totalInput  += meta?.promptTokenCount       ?? 0;
    totalCached += meta?.cachedContentTokenCount ?? 0;
    totalOutput += meta?.candidatesTokenCount    ?? 0;

    const candidate = data.candidates?.[0];
    if (!candidate) break;

    // Adiciona resposta do modelo à conversa
    messages.push(candidate.content);

    // Verifica se há function calls
    const functionCallParts = candidate.content.parts.filter(
      (p) => p.functionCall !== undefined,
    );

    if (functionCallParts.length === 0) {
      finalText = candidate.content.parts.find((p) => p.text)?.text ?? '';
      break;
    }

    // Executa tools em paralelo
    const toolParts: GeminiPart[] = await Promise.all(
      functionCallParts.map(async (part) => {
        const fc = part.functionCall!;
        const toolResult = await executeTool(fc.name, fc.args);
        // Gemini REST API exige que functionResponse.response seja um objeto
        // (google.protobuf.Struct), nunca um array. Arrays são wrapped em { result: [...] }.
        const response: unknown = Array.isArray(toolResult)
          ? { result: toolResult }
          : toolResult;
        // Gemini 2.5 retorna `id` em cada functionCall para parallel calls.
        // O `id` deve ser espelhado na functionResponse correspondente.
        const frPart: GeminiPart = {
          functionResponse: { name: fc.name, response },
        };
        if (fc.id) frPart.functionResponse!.id = fc.id;
        return frPart;
      }),
    );

    // Gemini 2.5: cada functionResponse deve ser um content separado com role='function'.
    // Múltiplos parts em um único content causa 400 em chamadas paralelas.
    for (const toolPart of toolParts) {
      messages.push({ role: 'function', parts: [toolPart] });
    }
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
