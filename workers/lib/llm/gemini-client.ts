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
import { executeReadPage, READ_PAGE_TOOL } from '../../../frontend/lib/tools/read-page';
import { createOrGetCache } from './prompt-cache';
import {
  callAgentClaude,
  BudgetExceededError,
  type CallAgentParams,
  type CallAgentResult,
  type LLMUsage,
} from './claude-provider';

// Re-exports: tipos públicos vivem em claude-provider.ts (dependência unidirecional)
export { BudgetExceededError, type CallAgentParams, type CallAgentResult, type LLMUsage } from './claude-provider';

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

// Tipos públicos e BudgetExceededError re-exportados de claude-provider.ts (acima).

// ── Retry helper para erros transitórios Gemini (503 / 429) ──────────────────

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS  = [2_000, 5_000, 10_000]; // 2s → 5s → 10s

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      // Erros de rede (AbortError de timeout, ECONNRESET, etc.) — não retry
      throw err;
    }

    if (!RETRYABLE_STATUS.has(res.status)) return res; // sucesso ou erro definitivo

    const errBody = await res.text();
    lastErr = new Error(`Gemini generateContent error ${res.status}: ${errBody}`);

    if (attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[gemini-client] HTTP ${res.status} — aguardando ${delay / 1000}s antes do retry ${attempt + 1}/${RETRY_DELAYS_MS.length}…`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr!;
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

// search_web removido — agentes workers operam sem busca externa.
// read_page mantido: acessa URLs sem depender de API key.
const FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = [
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
    'fetch_page': 'read_page',
    'read_url':   'read_page',
  };

  const canonicalName = KNOWN_ALIASES[name] ?? name;

  if (canonicalName !== name) {
    console.warn(
      `[gemini-client] tool name alias detected: "${name}" → "${canonicalName}". ` +
      `Gemini pode estar alucinando o nome. Monitorar frequência.`,
    );
  }

  switch (canonicalName) {
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

// ── Texto simples — sem tool use, sem cache ───────────────────────────────────

/**
 * Chama Gemini para geração de texto simples (sem tools, sem cache).
 * Uso: learning-extractor, aggregator — qualquer task de texto → JSON.
 * Regra 18: toda chamada LLM passa por gemini-client.ts.
 *
 * @param agentName  Nome para logging em llm_calls (ex: 'learning_extractor')
 * @param model      Modelo Gemini (ex: 'gemini-2.5-flash')
 * @param systemPrompt  Instrução de sistema (estática)
 * @param userMessage   Mensagem do usuário (dinâmica)
 * @param productId  Opcional — para rastreamento de custo por produto
 * @param nicheId    Opcional — para rastreamento de custo por nicho
 * @returns          Texto bruto da resposta do modelo
 */
export async function callTextGemini(
  agentName:    string,
  model:        string,
  systemPrompt: string,
  userMessage:  string,
  productId?:   string,
  nicheId?:     string,
): Promise<string> {
  const startedAt = Date.now();

  const res = await fetchWithRetry(
    `${GEMINI_API_BASE}/models/${model}:generateContent`,
    {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents:          [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig:  { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini generateContent error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as GeminiGenerateResponse;

  const meta         = data.usageMetadata;
  const totalInput   = meta?.promptTokenCount       ?? 0;
  const totalCached  = meta?.cachedContentTokenCount ?? 0;
  const totalOutput  = meta?.candidatesTokenCount    ?? 0;
  const durationMs   = Date.now() - startedAt;
  const realCost     = calcCost(model, totalInput, totalCached, totalOutput);

  await logCall(
    agentName,
    null, // tasks simples não têm pipeline_id
    productId,
    nicheId,
    model,
    { input_tokens: totalInput, cached_tokens: totalCached, output_tokens: totalOutput },
    realCost,
    durationMs,
  );

  return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
}

// ── Timeouts por agente ───────────────────────────────────────────────────────
//
// Timeout TOTAL para toda a execução do agente (incluindo todos os rounds).
// Deve ser menor que REAPER_TIMEOUT_MIN (15 min) para que o agente falhe
// de forma limpa antes de ser reaped brutalmente pelo DB.
// 12 min → 3 min de margem antes do reaper.

const AGENT_TOTAL_TIMEOUT_MS: Partial<Record<AgentName, number>> = {
  avatar_research:     8 * 60_000,   // lê páginas — pode ter muitos rounds
  market_research:     8 * 60_000,   // idem
  angle_generator:     7 * 60_000,   // análise pura, menos rounds
  copy_hook_generator: 9 * 60_000,   // 2.5-pro + geração longa
  anvisa_compliance:   5 * 60_000,   // análise de regras, sem web
  niche_curator:       6 * 60_000,
  video_maker:         5 * 60_000,
};
const DEFAULT_AGENT_TIMEOUT_MS = 8 * 60_000; // 8 min para agentes não mapeados

/** Rejeita após `ms` ms com uma mensagem de timeout descritiva. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[timeout] ${label} exceeded ${Math.round(ms / 60_000)}min limit`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Chama um agente via Gemini API com function calling loop e prompt caching.
 * Regra 18: único ponto de entrada — nunca chame o SDK Gemini diretamente.
 * Usa fetch puro para generateContent; cache gerenciado por prompt-cache.ts.
 *
 * Proteção contra zombie: wrapa _callAgentGemini() em withTimeout() com
 * limite por agente. Garante que a task falha limpa antes do reaper DB (15 min).
 */
export async function callAgent(params: CallAgentParams): Promise<CallAgentResult> {
  const cap   = AGENT_REGISTRY[params.agent_name];
  const model = cap.model;

  // Roteamento: modelos Claude → provider Anthropic (inclui timeout lá)
  if (model.startsWith('claude-')) {
    return callAgentClaude(params);
  }

  const timeoutMs = AGENT_TOTAL_TIMEOUT_MS[params.agent_name] ?? DEFAULT_AGENT_TIMEOUT_MS;
  return withTimeout(
    _callAgentGemini(params),
    timeoutMs,
    `callAgent(${params.agent_name})`,
  );
}

/**
 * Implementação interna do loop Gemini. Chamada via callAgent() com timeout wrapping.
 */
async function _callAgentGemini(params: CallAgentParams): Promise<CallAgentResult> {
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

  // 8 rounds máximos: suficiente para qualquer agente de texto/análise.
  // Reduzido de 12 para limitar o espaço temporal total dentro do timeout por agente.
  const MAX_ROUNDS = 8;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reqBody: Record<string, unknown> = {
      contents:         messages,
      tools:            [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: {
        temperature:   1.0,
        // Limita thinking tokens do Gemini 2.5 Pro para evitar timeout do reaper (10 min).
        // Sem este limite, uma única chamada pode levar vários minutos.
        thinkingConfig: { thinkingBudget: 8192 },
      },
    };

    if (cacheResult) {
      // Cache contém o conteúdo estático — não duplicar inline
      reqBody.cachedContent = cacheResult.cache_name;
    } else {
      reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    // Timeout por chamada individual: 3 min.
    // Com MAX_ROUNDS=8 e timeout total do agente de 8-9 min, 3 min/chamada é o
    // pior caso por round. Na prática rounds de function calling são muito menores.
    const callController = new AbortController();
    const callTimeout = setTimeout(() => callController.abort(), 180_000);

    let res: Response;
    try {
      res = await fetchWithRetry(
        `${GEMINI_API_BASE}/models/${model}:generateContent`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
          },
          body:   JSON.stringify(reqBody),
          signal: callController.signal,
        },
      );
    } finally {
      clearTimeout(callTimeout);
    }

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

// ── Utilitário compartilhado ──────────────────────────────────────────────────

/**
 * Extrai e valida o JSON de um CallAgentResult.
 *
 * callAgent() já tenta fazer o parse internamente; se falhar, devolve o texto
 * bruto como string. Esta função faz uma segunda tentativa e lança um erro
 * descritivo caso o output ainda não seja JSON — impedindo que agentes
 * propaguem um crash silencioso de JSON.parse().
 *
 * Uso: substitui o padrão inseguro
 *   `typeof result.output === 'string' ? JSON.parse(result.output) : result.output`
 * por uma versão com erro descritivo.
 */
export function parseAgentOutput(
  result: CallAgentResult,
  agentName: string,
): Record<string, unknown> {
  if (typeof result.output !== 'string') {
    return result.output as Record<string, unknown>;
  }
  try {
    const cleaned = result.output
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/\s*```$/im, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      `[${agentName}] LLM retornou output inválido (não-JSON, ${result.output.length} chars): ` +
      result.output.slice(0, 300),
    );
  }
}
