// POST /api/chat — SSE endpoint do Jarvis
// Processa mensagem do usuário, resolve @mentions e /goals, planeja e persiste pipelines.
//
// Fluxo:
//   1. Resolve @mentions (produto por SKU/nome) e /goals via reference-resolver
//   2. Classifica intent: create_pipeline | approve_plan | check_status | general_question
//   3. create_pipeline → planPipeline() → persiste pipeline + tasks → stream plan_preview
//   4. approve_plan    → transiciona pipeline plan_preview → pending → stream pipeline_created
//   5. check_status    → busca pipeline → stream pipeline_status
//   6. general_question → chama Gemini Flash via REST → stream message
//   7. Persiste messages em conversation
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

// ── Supabase service client ───────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── Tipos SSE ─────────────────────────────────────────────────────────────────

type SSEPayload =
  | { type: 'status';               message: string }
  | { type: 'references_resolved';  mentions: unknown[]; hasAmbiguity: boolean }
  | { type: 'references_ambiguous'; mentions: unknown[] }
  | { type: 'plan_preview';         plan: PipelinePlan; pipeline_id: string }
  | { type: 'pipeline_created';     pipeline_id: string; task_count: number }
  | { type: 'pipeline_status';      pipeline: unknown }
  | { type: 'message';              content: string }
  | { type: 'error';                error: string }
  | { type: 'done' };

// ── Request schema ────────────────────────────────────────────────────────────

const ChatRequestSchema = z.object({
  message:             z.string().min(1).max(4000),
  conversation_id:     z.string().uuid().optional(),
  user_id:             z.string().uuid().optional(),
  /** pipeline_id de um plano pendente de aprovação (enviado pelo frontend após plan_preview) */
  pending_pipeline_id: z.string().uuid().optional(),
  /** Força replanejamento mesmo com artifacts frescos */
  force_refresh:       z.boolean().optional().default(false),
});

// ── Intent classifier ─────────────────────────────────────────────────────────
// Rule-based: evita latência de um LLM call extra para classificação simples.

type Intent =
  | 'create_pipeline'
  | 'approve_plan'
  | 'check_status'
  | 'general_question';

function classifyIntent(
  message: string,
  hasProduct: boolean,
  hasGoal: boolean,
  hasPendingPipeline: boolean,
): Intent {
  const lower = message.toLowerCase();

  // Aprovação explícita do plano
  if (hasPendingPipeline) {
    const approveWords = ['sim', 'ok', 'aprovar', 'aprovar plano', 'executar', 'pode executar', 'confirmar', 'yes', 'go'];
    if (approveWords.some((w) => lower.includes(w))) return 'approve_plan';
  }

  // Criação de pipeline: tem produto + goal
  if (hasProduct && hasGoal) return 'create_pipeline';
  // Só goal → Jarvis pedirá o produto; por ora trata como general
  if (hasGoal && !hasProduct) return 'general_question';

  // Status de pipeline
  const statusWords = ['status', 'progresso', 'andamento', 'como está', 'como tá', 'quanto falta', 'terminou', 'concluiu'];
  if (statusWords.some((w) => lower.includes(w))) return 'check_status';

  return 'general_question';
}

// ── Persistência do pipeline ──────────────────────────────────────────────────

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

async function persistPipeline(
  plan: PipelinePlan,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<PersistedPipeline> {
  const pipelineId     = randomUUID();
  const productVersion = await getNextProductVersion(plan.product_id, supabase);

  // Insere o pipeline com status plan_preview (aguarda aprovação do usuário)
  const { error: pipelineErr } = await supabase.from('pipelines').insert({
    id:               pipelineId,
    product_id:       plan.product_id,
    goal:             plan.goal,
    deliverable_agent: plan.deliverable,
    plan:             { tasks: plan.tasks, checkpoints: plan.checkpoints },
    state:            {},
    status:           'plan_preview',
    product_version:  productVersion,
    budget_usd:       plan.budget_usd,
    cost_so_far_usd:  '0',
  });

  if (pipelineErr) throw new Error(`Pipeline insert failed: ${pipelineErr.message}`);

  // Insere tasks: agente_name → uuid map para resolve depends_on
  const agentToTaskId = new Map<string, string>();
  for (const t of plan.tasks) {
    agentToTaskId.set(t.agent, randomUUID());
  }

  const taskRows = plan.tasks.map((t: PlannedTask) => {
    const taskId  = agentToTaskId.get(t.agent)!;
    // Converte depends_on de agent names → task UUIDs
    const depsUuids = t.depends_on
      .map((depAgent) => agentToTaskId.get(depAgent))
      .filter((uid): uid is string => uid !== undefined);

    // reused → skipped, pending sem deps → pending, pending com deps → waiting
    let status: string;
    if (t.status === 'reused') {
      status = 'skipped';
    } else if (depsUuids.length === 0) {
      status = 'pending';
    } else {
      status = 'waiting';
    }

    return {
      id:           taskId,
      pipeline_id:  pipelineId,
      agent_name:   t.agent,
      depends_on:   depsUuids,
      status,
      input_context: null,
      output:        t.status === 'reused' ? { source_knowledge_id: t.source_knowledge_id } : null,
      retry_count:  0,
    };
  });

  if (taskRows.length > 0) {
    const { error: tasksErr } = await supabase.from('tasks').insert(taskRows);
    if (tasksErr) throw new Error(`Tasks insert failed: ${tasksErr.message}`);
  }

  return { pipeline_id: pipelineId, task_count: taskRows.length };
}

// ── Gemini Flash para perguntas gerais ────────────────────────────────────────
// Usa REST API diretamente (sem SDK) para compatibilidade com Edge/Node runtime.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const JARVIS_MODEL = 'gemini-2.5-flash';

const JARVIS_SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), 'workers/agents/prompts/jarvis.md'),
  'utf-8',
).trim();

async function callJarvisGemini(userMessage: string, context: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return 'GEMINI_API_KEY não configurada — não consigo responder esta pergunta.';

  const url = `${GEMINI_BASE}/models/${JARVIS_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: JARVIS_SYSTEM_PROMPT }] },
    contents: [
      ...(context ? [{ role: 'user', parts: [{ text: `Contexto: ${context}` }] }] : []),
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

// ── Persistência de messages ──────────────────────────────────────────────────

async function saveMessage(
  supabase: ReturnType<typeof getServiceClient>,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  pipelineId?: string,
  refs?: unknown,
): Promise<void> {
  await supabase.from('messages').insert({
    id:              randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    references:      refs ?? null,
    pipeline_id:     pipelineId ?? null,
  });

  // Atualiza last_message_at na conversa
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let input: z.infer<typeof ChatRequestSchema>;
  try {
    const raw = await req.json();
    const parsed = ChatRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    input = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Garante que existe uma conversa
  let conversationId = input.conversation_id;
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
        // 1. Persiste mensagem do usuário
        if (conversationId) {
          await saveMessage(supabase, conversationId, 'user', input.message);
        }

        // 2. Resolve referências @produto e /goal
        emit({ type: 'status', message: 'Analisando sua mensagem...' });

        const resolved = await resolveReferences(input.message);

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
            ambiguous.flatMap((m) => m.candidates ?? []).map((c: any) => `• @${c.sku} — ${c.name}`).join('\n')
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
        const goal    = extractGoal(resolved);
        const intent  = classifyIntent(
          input.message,
          product !== null,
          goal !== null,
          Boolean(input.pending_pipeline_id),
        );

        // ── Intenção: criar pipeline ──────────────────────────────────────────
        if (intent === 'create_pipeline' && product && goal) {
          emit({ type: 'status', message: `Planejando pipeline para ${goal} no produto ${product.sku}...` });

          const plan = await planPipeline(goal, product.id, input.force_refresh);

          const { pipeline_id } = await persistPipeline(plan, supabase);

          emit({ type: 'plan_preview', plan, pipeline_id });

          const summary = `Plano montado para **${goal}** — ${plan.tasks.filter((t: PlannedTask) => t.status === 'pending').length} tasks novas, ${plan.tasks.filter((t: PlannedTask) => t.status === 'reused').length} reutilizadas. Custo estimado: $${plan.estimated_cost_usd.toFixed(4)}. Posso executar?`;

          if (conversationId) {
            await saveMessage(supabase, conversationId, 'assistant', summary, pipeline_id, { plan_preview: true });
          }
          emit({ type: 'message', content: summary });
        }

        // ── Intenção: aprovar plano ───────────────────────────────────────────
        else if (intent === 'approve_plan' && input.pending_pipeline_id) {
          emit({ type: 'status', message: 'Aprovando plano e enfileirando tarefas...' });

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

            const replyContent = `Pipeline em execução! Você pode acompanhar o progresso nesta conversa ou em /pipelines/${input.pending_pipeline_id}.`;
            if (conversationId) {
              await saveMessage(supabase, conversationId, 'assistant', replyContent, input.pending_pipeline_id);
            }
            emit({ type: 'message', content: replyContent });
          }
        }

        // ── Intenção: verificar status ────────────────────────────────────────
        else if (intent === 'check_status') {
          emit({ type: 'status', message: 'Buscando status do pipeline...' });

          // Busca o pipeline mais recente do produto mencionado (ou o último da conversa)
          let pipeline: unknown = null;

          if (product) {
            const { data } = await supabase
              .from('pipelines')
              .select('id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
              .eq('product_id', product.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            pipeline = data;
          } else if (input.pending_pipeline_id) {
            const { data } = await supabase
              .from('pipelines')
              .select('id, goal, status, cost_so_far_usd, budget_usd, created_at, updated_at')
              .eq('id', input.pending_pipeline_id)
              .maybeSingle();
            pipeline = data;
          }

          if (!pipeline) {
            const replyContent = 'Não encontrei nenhum pipeline ativo para este produto. Deseja iniciar um?';
            if (conversationId) {
              await saveMessage(supabase, conversationId, 'assistant', replyContent);
            }
            emit({ type: 'message', content: replyContent });
          } else {
            emit({ type: 'pipeline_status', pipeline });
            const p = pipeline as any;
            const replyContent = `Pipeline **${p.goal}**: status \`${p.status}\` — custo: $${parseFloat(p.cost_so_far_usd ?? '0').toFixed(4)} / $${p.budget_usd}.`;
            if (conversationId) {
              await saveMessage(supabase, conversationId, 'assistant', replyContent);
            }
            emit({ type: 'message', content: replyContent });
          }
        }

        // ── Intenção: pergunta geral ──────────────────────────────────────────
        else {
          emit({ type: 'status', message: 'Pensando...' });

          // Constrói contexto com produto se disponível
          let context = '';
          if (product) {
            context = `Produto mencionado: ${product.name} (SKU: ${product.sku})`;
          }

          const replyContent = await callJarvisGemini(input.message, context);

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
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // desativa buffering em Nginx/Vercel
    },
  });
}
