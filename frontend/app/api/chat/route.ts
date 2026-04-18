// POST /api/chat — SSE endpoint do Jarvis
// Processa mensagem do usuário, resolve @mentions e /goals, planeja e persiste pipelines.
//
// Fluxo:
//   1. Resolve @mentions (produto por SKU/nome) e /goals via reference-resolver
//   2. Classifica intent: list_products | create_pipeline | approve_plan |
//      check_status | general_question
//   3. list_products   → Claude agent com contexto de produtos
//   4. create_pipeline → planPipeline() → persiste plan_preview → stream plan_preview + mermaid
//   5. approve_plan    → transiciona plan_preview → pending OU createNewPipeline()
//   6. check_status    → getPipelineStatus() → stream pipeline_status
//   7. general_question → Claude agent com tool use (DB, web, arquivos, execução)
//   8. Persiste messages em conversation
//
// SSE events emitidos:
//   { type: 'status',                message: string }
//   { type: 'references_resolved',   mentions, hasAmbiguity }
//   { type: 'references_ambiguous',  mentions }
//   { type: 'plan_preview',          plan, pipeline_id }
//   { type: 'pipeline_created',      pipeline_id, task_count }
//   { type: 'pipeline_status',       pipeline }
//   { type: 'tool_call',             name, input }
//   { type: 'tool_result',           name, output, is_error }
//   { type: 'message',               content }
//   { type: 'error',                 error }
//   { type: 'done' }
//
// PLANO_EXECUCAO_V2 Fase B | PRD seção 4.3

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import { resolveReferences, extractProduct, extractGoal } from '@/lib/jarvis/reference-resolver';
import { planPipeline, type PipelinePlan } from '@/lib/jarvis/planner';
import type { GoalName } from '@/lib/agent-registry';
import { JARVIS_MODEL } from '@/lib/agent-registry';
import {
  listProducts,
  getProductKnowledge,
  getPipelineStatus,
  createNewPipeline,
  persistPlanPreview,
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
  | { type: 'tool_call';             name: string; input: unknown }
  | { type: 'tool_result';           name: string; output: unknown; is_error?: boolean }
  | { type: 'message';               content: string }
  | { type: 'error';                 error: string }
  | { type: 'done' };

// ── Request schema ────────────────────────────────────────────────────────────

const ChatRequestSchema = z.object({
  message:             z.string().min(1).max(4000),
  conversation_id:     z.string().uuid().optional(),
  user_id:             z.string().uuid().optional(),
  pending_pipeline_id: z.string().uuid().optional(),
  pending_plan: z.object({
    product_id:      z.string().uuid(),
    goal:            z.string(),
    product_version: z.number().int().positive().default(1),
  }).optional(),
  force_refresh: z.boolean().optional().default(false),
});

// ── Gemini REST API ───────────────────────────────────────────────────────────

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

// Timeout para chamadas Jarvis ao Gemini: 30s é suficiente para respostas
// conversacionais simples (sem tool use). Previne o SSE ficar pendurado.
const JARVIS_GEMINI_TIMEOUT_MS = 30_000;

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
    generation_config: { temperature: 0.7, max_output_tokens: 2048 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JARVIS_GEMINI_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error('[chat/jarvis] fetch error:', isTimeout ? 'timeout (30s)' : err);
    return isTimeout
      ? 'A resposta demorou mais que o esperado. Tente novamente.'
      : 'Desculpe, não consegui processar sua pergunta no momento.';
  } finally {
    clearTimeout(timer);
  }

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

async function buildSystemInstruction(opts: {
  product:       { id: string; name: string; sku: string } | null;
  supabase:      ReturnType<typeof getServiceClient>;
  intent:        Intent;
  extraContext?: string;
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

// ── Intent classifier ─────────────────────────────────────────────────────────

type Intent =
  | 'list_products'
  | 'create_pipeline'
  | 'approve_plan'
  | 'check_status'
  | 'general_question';

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
    /\brefaz(er)?\b/.test(lower)
  );
}

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
  message:            string,
  hasProduct:         boolean,
  hasGoal:            boolean,
  hasPendingPipeline: boolean,
): Intent {
  const lower = message.toLowerCase().trim();

  const listPatterns = [
    'quais produtos', 'meus produtos', 'produtos que eu tenho',
    'listar produtos', 'o que eu tenho', 'que produtos',
  ];
  if (listPatterns.some((w) => lower.includes(w))) return 'list_products';
  if (/^(listar|lista|ver)\s+(meus\s+)?produtos/.test(lower)) return 'list_products';

  if (hasPendingPipeline) {
    const approveWords = [
      'sim', 'ok', 'aprovar', 'executar', 'pode executar', 'confirmar',
      'yes', 'go', 'pode rodar', 'manda ver', 'roda', 'executa', 'aprova',
      'pode', 'vamos', 'bora',
    ];
    if (approveWords.some((w) => lower.includes(w))) return 'approve_plan';
  }

  if (hasProduct && hasGoal) return 'create_pipeline';
  if (hasGoal && !hasProduct) return 'general_question';

  const statusWords = [
    'status', 'progresso', 'andamento', 'como est[aá]', 'como t[aá]',
    'quanto falta', 'terminou', 'concluiu', 'pipeline', 'rodando', 'executando',
  ];
  if (statusWords.some((w) => new RegExp(w).test(lower))) return 'check_status';

  return 'general_question';
}

// ── Persistência de messages ──────────────────────────────────────────────────

async function saveMessage(
  supabase:       ReturnType<typeof getServiceClient>,
  conversationId: string,
  role:           'user' | 'assistant',
  content:        string,
  pipelineId?:    string,
  refs?:          unknown,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    id:              randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    references:      refs ?? null,
    pipeline_id:     pipelineId ?? null,
  }).select();

  if (error) console.error('[saveMessage] insert error:', error.message);

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Handler principal ─────────────────────────────────────────────────────────

// Jarvis desativado — motor migrado para Claude Code (Ultron). 2026-04-18
export async function POST(_req: Request) {
  return new Response(
    JSON.stringify({ error: 'Jarvis temporariamente desativado. Use o Claude Code (Ultron) para orquestrar pipelines.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function POST_DISABLED(req: Request) {
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
        if (isNewConversation && conversationId) {
          emit({ type: 'conversation_created', conversation_id: conversationId });
        }

        if (conversationId) {
          await saveMessage(supabase, conversationId, 'user', input.message);
        }

        emit({ type: 'status', message: 'Analisando sua mensagem...' });

        const resolved = await resolveReferences(input.message, supabase);

        emit({
          type:         'references_resolved',
          mentions:     resolved.mentions,
          hasAmbiguity: resolved.hasAmbiguity,
        });

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
        const goal    = extractGoal(resolved) ?? detectGoalFromText(input.message);

        let effectivePendingPipelineId = input.pending_pipeline_id ?? null;
        if (!effectivePendingPipelineId && conversationId) {
          const { data: recentMsgs } = await supabase
            .from('messages')
            .select('pipeline_id, pipelines(id, status)')
            .eq('conversation_id', conversationId)
            .not('pipeline_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);
          if (recentMsgs) {
            for (const msg of recentMsgs) {
              const pArr = msg.pipelines as Array<{ id: string; status: string }> | null;
              const p = pArr?.[0] ?? null;
              if (p?.status === 'plan_preview') {
                effectivePendingPipelineId = p.id;
                break;
              }
            }
          }
        }

        const hasPendingPipeline =
          Boolean(effectivePendingPipelineId) || Boolean(input.pending_plan);

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
          const extraContext = products.length === 0
            ? 'O usuário não tem nenhum produto cadastrado ainda. Sugira criar um produto via /produtos.'
            : `Produtos cadastrados do usuário:\n${
                products
                  .map((p) => `• ${p.sku} — ${p.name} (criado em ${new Date(p.created_at).toLocaleDateString('pt-BR')})`)
                  .join('\n')
              }`;

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
          if (conversationId && replyContent) {
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

          if (effectivePendingPipelineId) {
            // Aprovação atômica: UPDATE com WHERE status='plan_preview' garante
            // idempotência — dois cliques simultâneos nunca ativam o pipeline duas vezes.
            const { data: updated, error: updateErr } = await supabase
              .from('pipelines')
              .update({ status: 'pending' })
              .eq('id', effectivePendingPipelineId)
              .eq('status', 'plan_preview')
              .select('id, status')
              .maybeSingle();

            if (updateErr) {
              emit({ type: 'error', error: 'Erro ao aprovar pipeline' });
            } else if (!updated) {
              // Nenhuma linha atualizada: pipeline não estava em plan_preview
              const { data: current } = await supabase
                .from('pipelines')
                .select('status')
                .eq('id', effectivePendingPipelineId)
                .maybeSingle();
              const currentStatus = current?.status ?? 'desconhecido';
              emit({ type: 'error', error: `Pipeline já está em status '${currentStatus}' — não é possível aprovar novamente` });
            } else {
              const { count } = await supabase
                .from('tasks')
                .select('id', { count: 'exact', head: true })
                .eq('pipeline_id', effectivePendingPipelineId)
                .neq('status', 'skipped');

              emit({
                type:        'pipeline_created',
                pipeline_id: effectivePendingPipelineId,
                task_count:  count ?? 0,
              });

              const replyContent = `Pipeline em execução! ${count ?? 0} tasks enfileiradas. Acompanhe o progresso em /demandas?pipeline=${effectivePendingPipelineId}.`;
              if (conversationId) {
                await saveMessage(supabase, conversationId, 'assistant', replyContent, effectivePendingPipelineId);
              }
              emit({ type: 'message', content: replyContent });
            }
          } else if (input.pending_plan) {
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
          } else if (effectivePendingPipelineId) {
            pipelineId = effectivePendingPipelineId;
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

        // ── general_question → Gemini ─────────────────────────────────────────
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
                extraContext = `Pipeline ativo do produto mencionado: ${pd.goal} (${pd.status}) — ${taskSummary}`;
              }
            }

            // Injeta conhecimento disponível do produto
            const knowledge = await getProductKnowledge(product.id, supabase);
            if (knowledge.length > 0) {
              const knownTypes = knowledge.map((k) => k.artifact_type).join(', ');
              extraContext += `\nDados disponíveis para ${product.name} (${product.sku}): ${knownTypes}`;
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

          if (conversationId && replyContent) {
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
} // fim POST_DISABLED
