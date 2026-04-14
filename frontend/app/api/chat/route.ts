// POST /api/chat — SSE endpoint do Jarvis
// Processa mensagem do usuário, resolve @mentions e /goals, planeja e persiste pipelines.
//
// Fluxo:
//   1. Resolve @mentions (produto por SKU/nome) e /goals via reference-resolver
//   2. Classifica intent: list_products | create_pipeline | approve_plan |
//      check_status | general_question
//   3. list_products   → listProducts() → stream message com lista
//   4. create_pipeline → planPipeline() → persiste plan_preview → stream plan_preview + mermaid
//   5. approve_plan    → transiciona plan_preview → pending OU createNewPipeline()
//   6. check_status    → getPipelineStatus() → stream pipeline_status
//   7. general_question → Gemini Flash com contexto enriquecido → stream message
//   8. Persiste messages em conversation
//
// SSE events emitidos:
//   { type: 'status',                message: string }
//   { type: 'references_resolved',   mentions, hasAmbiguity }
//   { type: 'references_ambiguous',  mentions }
//   { type: 'plan_preview',          plan, pipeline_id }
//   { type: 'pipeline_created',      pipeline_id, task_count }
//   { type: 'pipeline_status',       pipeline }
//   { type: 'message',               content }
//   { type: 'error',                 error }
//   { type: 'done' }
//
// PLANO_EXECUCAO 5.2 | PRD seção 4.3

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { resolveReferences, extractProduct, extractGoal } from '@/lib/jarvis/reference-resolver';
import { planPipeline, type PipelinePlan } from '@/lib/jarvis/planner';
import type { PlannedTask } from '@/lib/jarvis/dag-builder';
import { JARVIS_MODEL, type GoalName } from '@/lib/agent-registry';
import {
  listProducts,
  getProductKnowledge,
  getPipelineStatus,
  createNewPipeline,
  type Product,
  type PipelineWithTasks,
} from '@/lib/jarvis/actions';
import { loadConversationHistory, type GeminiContent } from '@/lib/jarvis/loadConversationHistory';

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── Tipos SSE ─────────────────────────────────────────────────────────────────

type SSEPayload =
  | { type: 'status';                message: string }
  | { type: 'conversation_created';  conversation_id: string }
  | { type: 'references_resolved';   mentions: unknown[]; hasAmbiguity: boolean }
  | { type: 'references_ambiguous';  mentions: unknown[] }
  | { type: 'plan_preview';          plan: PipelinePlan; pipeline_id: string }
  | { type: 'pipeline_created';      pipeline_id: string; task_count: number }
  | { type: 'pipeline_status';       pipeline: unknown }
  | { type: 'message';               content: string }
  | { type: 'error';                 error: string }
  | { type: 'done' };

// ── Request schema ────────────────────────────────────────────────────────────

const ChatRequestSchema = z.object({
  message:             z.string().min(1).max(4000),
  conversation_id:     z.string().uuid().optional(),
  user_id:             z.string().uuid().optional(),
  /** pipeline_id de um plano_preview aguardando aprovação no DB */
  pending_pipeline_id: z.string().uuid().optional(),
  /** dados do plano pendente quando não há registro no DB (fluxo novo) */
  pending_plan: z.object({
    product_id:      z.string().uuid(),
    goal:            z.string(),
    product_version: z.number().int().positive().default(1),
  }).optional(),
  force_refresh: z.boolean().optional().default(false),
});

// ── Intent classifier ─────────────────────────────────────────────────────────

type Intent =
  | 'list_products'
  | 'create_pipeline'
  | 'approve_plan'
  | 'check_status'
  | 'general_question';

/**
 * Detecta se o usuário quer forçar reprocessamento, ignorando cache.
 * Retorna true para qualquer padrão de "refazer do zero" no texto.
 */
function detectForceRefresh(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bforce[_\s]refresh\b/.test(lower) ||
    /\bfor[cç]ar\b/.test(lower) ||
    /\brefresh\b/.test(lower) ||
    /\breprocessar\b/.test(lower) ||
    /\breexecutar\b/.test(lower) ||
    /\bde\s*novo\b/.test(lower) ||
    /\bnovamente\b/.test(lower) ||
    /\bdo\s+zero\b/.test(lower) ||
    /\brefaz(er)?\b/.test(lower) ||
    /\batuali[zs](ar|a)\b/.test(lower)
  );
}

/**
 * Detecta goal a partir de palavras-chave no texto (fallback quando não há /ação).
 */
function detectGoalFromText(message: string): GoalName | null {
  const lower = message.toLowerCase();
  if (/\bavatar\b|p[uú]blico.alvo|persona\b/.test(lower)) return 'avatar_only';
  if (/\bmercado\b|viabilidade|concorr[eê]ncia/.test(lower)) return 'market_only';
  if (/\b[aâ]ngulos?\b|\bangles?\b/.test(lower)) return 'angles_only';
  if (/\bcopy\b|\bhooks?\b|\bbodies\b|\bbody\b|\bctas?\b/.test(lower)) return 'copy_only';
  if (/\bv[ií]deo\b|criativo|creative/.test(lower)) return 'creative_full';
  return null;
}

function classifyIntent(
  message: string,
  hasProduct: boolean,
  hasGoal: boolean,
  hasPendingPipeline: boolean,
): Intent {
  const lower = message.toLowerCase().trim();

  // list_products — perguntas sobre catálogo
  const listPatterns = [
    'quais produtos', 'meus produtos', 'produtos que eu tenho',
    'listar produtos', 'o que eu tenho', 'que produtos',
  ];
  if (listPatterns.some((w) => lower.includes(w))) return 'list_products';
  if (/^(listar|lista|ver)\s+(meus\s+)?produtos/.test(lower)) return 'list_products';

  // approve_plan — usuário confirma plano pendente
  if (hasPendingPipeline) {
    const approveWords = [
      'sim', 'ok', 'aprovar', 'executar', 'pode executar', 'confirmar',
      'yes', 'go', 'pode rodar', 'manda ver', 'roda', 'executa', 'aprova',
      'pode', 'vamos', 'bora',
    ];
    if (approveWords.some((w) => lower.includes(w))) return 'approve_plan';
  }

  // create_pipeline — produto + goal identificados
  if (hasProduct && hasGoal) return 'create_pipeline';
  // goal sem produto → Jarvis pede o produto
  if (hasGoal && !hasProduct) return 'general_question';

  // check_status — perguntas sobre progresso
  const statusWords = [
    'status', 'progresso', 'andamento', 'como est[aá]', 'como t[aá]',
    'quanto falta', 'terminou', 'concluiu', 'pipeline', 'rodando', 'executando',
  ];
  if (statusWords.some((w) => new RegExp(w).test(lower))) return 'check_status';

  return 'general_question';
}

// ── Persistência do pipeline como plan_preview ────────────────────────────────

interface PersistedPipeline {
  pipeline_id: string;
  task_count:  number;
}

async function getNextProductVersion(
  product_id: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<number> {
  const { data } = await supabase
    .from('pipelines')
    .select('product_version')
    .eq('product_id', product_id)
    .order('product_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.product_version as number) + 1 : 1;
}

async function persistPlanPreview(
  plan: PipelinePlan,
  forceRefresh: boolean,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<PersistedPipeline> {
  const pipelineId     = randomUUID();
  const productVersion = await getNextProductVersion(plan.product_id, supabase);

  const { error: pipelineErr } = await supabase.from('pipelines').insert({
    id:                pipelineId,
    product_id:        plan.product_id,
    goal:              plan.goal,
    deliverable_agent: plan.deliverable,
    plan:              {
      tasks:              plan.tasks,
      checkpoints:        plan.checkpoints,
      mermaid:            plan.mermaid,
      estimated_cost_usd: plan.estimated_cost_usd,
      product_sku:        plan.product_sku,
      product_name:       plan.product_name,
    },
    state:             {},
    status:            'plan_preview',
    product_version:   productVersion,
    force_refresh:     forceRefresh,
    budget_usd:        plan.budget_usd,
    cost_so_far_usd:   '0',
  });

  if (pipelineErr) throw new Error(`Pipeline insert failed: ${pipelineErr.message}`);

  // Insere tasks com status waiting/pending (sem executar ainda)
  const agentToTaskId = new Map<string, string>();
  for (const t of plan.tasks) {
    agentToTaskId.set(t.agent, randomUUID());
  }

  const taskRows = plan.tasks.map((t: PlannedTask) => {
    const taskId    = agentToTaskId.get(t.agent)!;
    const depsUuids = t.depends_on
      .map((dep) => agentToTaskId.get(dep))
      .filter((uid): uid is string => uid !== undefined);

    let status: string;
    if (t.status === 'reused')       status = 'skipped';
    else if (depsUuids.length === 0) status = 'pending';
    else                             status = 'waiting';

    return {
      id:            taskId,
      pipeline_id:   pipelineId,
      agent_name:    t.agent,
      depends_on:    depsUuids,
      status,
      input_context: null,
      output:        t.status === 'reused' ? { source_knowledge_id: t.source_knowledge_id } : null,
      retry_count:   0,
    };
  });

  if (taskRows.length > 0) {
    const { error: tasksErr } = await supabase.from('tasks').insert(taskRows);
    if (tasksErr) throw new Error(`Tasks insert failed: ${tasksErr.message}`);
  }

  return { pipeline_id: pipelineId, task_count: taskRows.length };
}

// ── Gemini Flash para geração de texto ────────────────────────────────────────
// Usa REST API diretamente. systemInstruction inclui prompt base + contexto real.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

let _jarvisPrompt: string | null = null;
function getJarvisPrompt(): string {
  if (_jarvisPrompt) return _jarvisPrompt;
  _jarvisPrompt = fs.readFileSync(
    path.join(process.cwd(), '..', 'workers', 'agents', 'prompts', 'jarvis.md'),
    'utf-8',
  ).trim();
  return _jarvisPrompt;
}

async function callJarvisGemini(
  systemInstruction: string,
  userMessage: string,
  history: GeminiContent[] = [],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return 'GEMINI_API_KEY não configurada — não consigo responder esta pergunta.';

  const url = `${GEMINI_BASE}/models/${JARVIS_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generation_config: { temperature: 0.7, max_output_tokens: 1024 },
  };

  const resp = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[chat/jarvis] Gemini error:', err);
    return 'Desculpe, não consegui processar sua pergunta no momento.';
  }

  const data = await resp.json() as {
    candidates?: Array<{ content: { parts: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sem resposta.';
}

// ── Contexto enriquecido para Gemini ─────────────────────────────────────────

async function buildSystemInstruction(opts: {
  product:        { id: string; name: string; sku: string } | null;
  supabase:       ReturnType<typeof getServiceClient>;
  intent:         Intent;
  extraContext?:  string;
}): Promise<string> {
  const { product, supabase, intent, extraContext } = opts;

  const products = await listProducts(supabase);
  const productsList = products.slice(0, 5)
    .map((p) => `• ${p.sku} — ${p.name}`)
    .join('\n') || 'nenhum';

  const parts: string[] = [
    getJarvisPrompt(),
    '',
    '=== ESTADO ATUAL ===',
    `Produtos cadastrados:\n${productsList}`,
    `Último intent detectado: ${intent}`,
  ];

  if (product) {
    const knowledge = await getProductKnowledge(product.id, supabase);
    const knownTypes = knowledge.map((k) => k.artifact_type).join(', ') || 'nenhum';
    parts.push(`Produto mencionado: ${product.name} (${product.sku})`);
    parts.push(`Dados disponíveis para este produto: ${knownTypes}`);
  }

  if (extraContext) {
    parts.push('', extraContext);
  }

  return parts.join('\n');
}

// ── Persistência de messages ──────────────────────────────────────────────────

async function saveMessage(
  supabase: ReturnType<typeof getServiceClient>,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  pipelineId?: string,
  refs?: unknown,
): Promise<void> {
  console.log('[saveMessage] inserting:', {
    conversationId, role, contentPreview: content.slice(0, 50),
  });

  const { data, error } = await supabase.from('messages').insert({
    id:              randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    references:      refs ?? null,
    pipeline_id:     pipelineId ?? null,
  }).select();

  console.log('[saveMessage] result:', {
    error: error?.message,
    inserted: data?.length,
  });

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let input: z.infer<typeof ChatRequestSchema>;
  try {
    const raw    = await req.json();
    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    input = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Garante que existe uma conversa
  let conversationId    = input.conversation_id;
  const isNewConversation = !conversationId;
  if (!conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        id:      randomUUID(),
        user_id: input.user_id ?? null,
        title:   input.message.slice(0, 80),
      })
      .select('id')
      .single();
    conversationId = conv?.id;
  }

  const encoder = new TextEncoder();

  function sseChunk(payload: SSEPayload): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: SSEPayload) => controller.enqueue(sseChunk(payload));

      try {
        // 1. Se a conversa foi criada agora, informa o cliente antes de tudo
        if (isNewConversation && conversationId) {
          emit({ type: 'conversation_created', conversation_id: conversationId });
        }

        // 2. Persiste mensagem do usuário
        if (conversationId) {
          await saveMessage(supabase, conversationId, 'user', input.message);
        }

        // 2. Resolve referências @produto e /goal
        emit({ type: 'status', message: 'Analisando sua mensagem...' });

        // Passa o service client para evitar bloqueio RLS com o anon key
        const resolved = await resolveReferences(input.message, supabase);

        emit({
          type:         'references_resolved',
          mentions:     resolved.mentions,
          hasAmbiguity: resolved.hasAmbiguity,
        });

        // Ambiguidade: Jarvis pede ao usuário que escolha o produto
        if (resolved.hasAmbiguity) {
          const ambiguous = resolved.mentions.filter((m) => m.ambiguous);
          emit({ type: 'references_ambiguous', mentions: ambiguous });
          const replyContent = `Encontrei mais de um produto com esse nome. Qual você quis dizer?\n${
            ambiguous
              .flatMap((m) => m.candidates ?? [])
              .map((c: any) => `• @${c.sku} — ${c.name}`)
              .join('\n')
          }`;
          if (conversationId) {
            await saveMessage(supabase, conversationId, 'assistant', replyContent);
          }
          emit({ type: 'message', content: replyContent });
          emit({ type: 'done' });
          controller.close();
          return;
        }

        const product = extractProduct(resolved);
        // Goal: /ação explícita OU keywords no texto
        const goal = extractGoal(resolved) ?? detectGoalFromText(input.message);

        const hasPendingPipeline =
          Boolean(input.pending_pipeline_id) || Boolean(input.pending_plan);

        const intent = classifyIntent(
          input.message,
          product !== null,
          goal !== null,
          hasPendingPipeline,
        );

        // ── list_products ─────────────────────────────────────────────────────
        if (intent === 'list_products') {
          emit({ type: 'status', message: 'Buscando seus produtos...' });

          const products = await listProducts(supabase);

          let extraContext: string;
          if (products.length === 0) {
            extraContext = 'O usuário não tem nenhum produto cadastrado ainda. Sugira criar um produto via /produtos.';
          } else {
            const rows = products.map(
              (p) => `• ${p.sku} — ${p.name} (criado em ${new Date(p.created_at).toLocaleDateString('pt-BR')})`,
            );
            extraContext = `Produtos cadastrados do usuário:\n${rows.join('\n')}`;
          }

          const systemInstruction = await buildSystemInstruction({
            product: null,
            supabase,
            intent,
            extraContext,
          });

          const history = conversationId
            ? await loadConversationHistory(conversationId, supabase)
            : [];
          const replyContent = await callJarvisGemini(systemInstruction, input.message, history);

          if (conversationId) {
            await saveMessage(supabase, conversationId, 'assistant', replyContent);
          }
          emit({ type: 'message', content: replyContent });
        }

        // ── create_pipeline ───────────────────────────────────────────────────
        else if (intent === 'create_pipeline' && product && goal) {
          emit({ type: 'status', message: `Planejando ${goal} para ${product.sku}...` });

          const forceRefresh = input.force_refresh || detectForceRefresh(input.message);
          const plan = await planPipeline(goal as GoalName, product.id, forceRefresh, supabase);
          plan.product_sku  = product.sku;
          plan.product_name = product.name;

          // Persiste como plan_preview — aguarda aprovação do usuário
          const { pipeline_id } = await persistPlanPreview(plan, forceRefresh, supabase);

          emit({ type: 'plan_preview', plan, pipeline_id });

          if (conversationId) {
            await saveMessage(supabase, conversationId, 'assistant', '[plan_preview]', pipeline_id, {
              plan_preview: true,
            });
          }
        }

        // ── approve_plan ──────────────────────────────────────────────────────
        else if (intent === 'approve_plan' && hasPendingPipeline) {
          emit({ type: 'status', message: 'Aprovando plano e enfileirando tarefas...' });

          if (input.pending_pipeline_id) {
            // Fluxo plan_preview no DB: transiciona para pending
            const { data: pipeline, error: fetchErr } = await supabase
              .from('pipelines')
              .select('id, status')
              .eq('id', input.pending_pipeline_id)
              .maybeSingle();

            if (fetchErr || !pipeline) {
              emit({ type: 'error', error: 'Pipeline não encontrado' });
            } else if (pipeline.status !== 'plan_preview') {
              emit({ type: 'error', error: `Pipeline já está em status '${pipeline.status}'` });
            } else {
              await supabase
                .from('pipelines')
                .update({ status: 'pending' })
                .eq('id', input.pending_pipeline_id);

              const { count } = await supabase
                .from('tasks')
                .select('id', { count: 'exact', head: true })
                .eq('pipeline_id', input.pending_pipeline_id)
                .neq('status', 'skipped');

              emit({
                type:        'pipeline_created',
                pipeline_id: input.pending_pipeline_id,
                task_count:  count ?? 0,
              });

              const replyContent = `Pipeline em execução! ${count ?? 0} tasks enfileiradas. Acompanhe o progresso em /demandas?pipeline=${input.pending_pipeline_id}.`;
              if (conversationId) {
                await saveMessage(supabase, conversationId, 'assistant', replyContent, input.pending_pipeline_id);
              }
              emit({ type: 'message', content: replyContent });
            }

          } else if (input.pending_plan) {
            // Fluxo sem plan_preview no DB: cria pipeline diretamente
            const { product_id, goal: pendingGoal, product_version } = input.pending_plan;
            const newPipeline = await createNewPipeline(
              product_id,
              pendingGoal as GoalName,
              product_version,
              supabase,
            );
            const taskCount = newPipeline.tasks.filter((t) => t.status !== 'skipped').length;

            emit({
              type:        'pipeline_created',
              pipeline_id: newPipeline.id,
              task_count:  taskCount,
            });

            const replyContent = `Pipeline criado! ${taskCount} tasks enfileiradas. Vou te avisar quando tiver resultado.`;
            if (conversationId) {
              await saveMessage(supabase, conversationId, 'assistant', replyContent, newPipeline.id);
            }
            emit({ type: 'message', content: replyContent });
          }
        }

        // ── check_status ──────────────────────────────────────────────────────
        else if (intent === 'check_status') {
          emit({ type: 'status', message: 'Buscando status do pipeline...' });

          let pipelineId: string | null = null;

          if (product) {
            const { data: latest } = await supabase
              .from('pipelines')
              .select('id')
              .eq('product_id', product.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            pipelineId = latest?.id ?? null;
          } else if (input.pending_pipeline_id) {
            pipelineId = input.pending_pipeline_id;
          }

          if (!pipelineId) {
            const replyContent = 'Não encontrei nenhum pipeline ativo para este produto. Deseja iniciar um?';
            if (conversationId) {
              await saveMessage(supabase, conversationId, 'assistant', replyContent);
            }
            emit({ type: 'message', content: replyContent });
          } else {
            const pipelineData = await getPipelineStatus(pipelineId, supabase);

            if (!pipelineData) {
              emit({ type: 'error', error: 'Pipeline não encontrado' });
            } else {
              emit({ type: 'pipeline_status', pipeline: pipelineData });

              const taskLines = pipelineData.tasks
                .map((t) => `  • ${t.agent_name}: \`${t.status}\``)
                .join('\n') || '  (sem tasks)';

              const replyContent = [
                `Pipeline **${pipelineData.goal}**: \`${pipelineData.status}\``,
                `Custo: $${parseFloat(pipelineData.cost_so_far_usd ?? '0').toFixed(4)} / $${pipelineData.budget_usd}`,
                '',
                'Tasks:',
                taskLines,
              ].join('\n');

              if (conversationId) {
                await saveMessage(supabase, conversationId, 'assistant', replyContent, pipelineId);
              }
              emit({ type: 'message', content: replyContent });
            }
          }
        }

        // ── general_question ──────────────────────────────────────────────────
        else {
          emit({ type: 'status', message: 'Pensando...' });

          // Contexto adicional: pipeline ativo do produto se houver
          let extraContext = '';
          if (product) {
            const { data: latestPipeline } = await supabase
              .from('pipelines')
              .select('id')
              .eq('product_id', product.id)
              .in('status', ['pending', 'running'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestPipeline?.id) {
              const pd = await getPipelineStatus(latestPipeline.id, supabase);
              if (pd) {
                const taskSummary = pd.tasks
                  .map((t) => `${t.agent_name}:${t.status}`)
                  .join(', ');
                extraContext = `Pipeline ativo: ${pd.goal} (${pd.status}) — ${taskSummary}`;
              }
            }
          }

          const systemInstruction = await buildSystemInstruction({
            product,
            supabase,
            intent,
            extraContext: extraContext || undefined,
          });

          const history = conversationId
            ? await loadConversationHistory(conversationId, supabase)
            : [];
          const replyContent = await callJarvisGemini(systemInstruction, input.message, history);

          if (conversationId) {
            await saveMessage(supabase, conversationId, 'assistant', replyContent);
          }
          emit({ type: 'message', content: replyContent });
        }

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[chat/route] error:', errMsg);
        emit({ type: 'error', error: errMsg });
      } finally {
        emit({ type: 'done' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
