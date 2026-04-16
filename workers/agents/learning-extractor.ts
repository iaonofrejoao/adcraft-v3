// Agente extrator de learnings — Fase E (Sistema de Memória Cumulativa)
//
// Responsabilidade:
//   Disparado automaticamente após cada pipeline concluído com sucesso.
//   Analisa os outputs do pipeline via Claude Sonnet e persiste aprendizados
//   atômicos na tabela `execution_learnings`, enfileirando embeddings.
//
// Trigger: task-runner.ts → pipeline completed → extractLearningsAsync()
// Modelo: claude-sonnet-4-6 (custo-benefício para análise estruturada)
// Nunca bloqueia o task-runner: roda em background via setTimeout(0)

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { eq, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  pipelines, tasks, products,
  executionLearnings, embeddings,
} from '../../frontend/lib/schema/index';

const MODEL = 'claude-sonnet-4-6';
const MAX_LEARNINGS = 8;

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface RawLearning {
  category:    string;
  observation: string;
  evidence:    Record<string, unknown>;
  confidence:  number;
}

interface PipelineSummary {
  pipeline_id: string;
  product_id:  string | null;
  niche_id:    string | null;
  goal:        string;
  product_name: string | null;
  tasks: Array<{
    agent_name: string;
    status:     string;
    output:     Record<string, unknown> | null;
  }>;
}

// ── Loader do system prompt ────────────────────────────────────────────────────

function loadSystemPrompt(): string {
  const promptPath = path.join(__dirname, 'prompts', 'learning_extractor.md');
  return fs.readFileSync(promptPath, 'utf-8');
}

// ── Coleta de dados do pipeline ───────────────────────────────────────────────

async function buildPipelineSummary(pipelineId: string): Promise<PipelineSummary | null> {
  const pipeline = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!pipeline) return null;

  let product_name: string | null = null;
  if (pipeline.product_id) {
    const product = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, pipeline.product_id))
      .limit(1)
      .then((r) => r[0] ?? null);
    product_name = product?.name ?? null;
  }

  const taskRows = await db
    .select({
      agent_name: tasks.agent_name,
      status:     tasks.status,
      output:     tasks.output,
    })
    .from(tasks)
    .where(eq(tasks.pipeline_id as any, pipelineId));

  return {
    pipeline_id:  pipelineId,
    product_id:   pipeline.product_id ?? null,
    niche_id:     null, // não temos niche_id diretamente no pipeline — poderia vir do produto
    goal:         pipeline.goal,
    product_name,
    tasks: taskRows.map((t) => ({
      agent_name: t.agent_name,
      status:     t.status ?? 'unknown',
      output:     t.output as Record<string, unknown> | null,
    })),
  };
}

// ── Serialização do pipeline para o prompt ─────────────────────────────────────

function serializeSummary(summary: PipelineSummary): string {
  const lines: string[] = [
    `Pipeline ID: ${summary.pipeline_id}`,
    `Goal: ${summary.goal}`,
    `Produto: ${summary.product_name ?? 'desconhecido'}`,
    '',
    '## Outputs dos Agentes',
  ];

  for (const t of summary.tasks) {
    if (t.status !== 'completed' || !t.output) continue;

    lines.push(`\n### ${t.agent_name}`);

    // Serializa só os campos mais relevantes (limita tamanho do contexto)
    const outputStr = JSON.stringify(t.output, null, 2);
    const truncated = outputStr.length > 2000
      ? outputStr.slice(0, 2000) + '\n... [truncado]'
      : outputStr;

    lines.push(truncated);
  }

  return lines.join('\n');
}

// ── Extração via Claude ────────────────────────────────────────────────────────

async function extractWithClaude(summary: PipelineSummary): Promise<RawLearning[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = loadSystemPrompt();
  const userMessage  = `Analise este pipeline concluído e extraia aprendizados:\n\n${serializeSummary(summary)}`;

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text block');
  }

  // Parse JSON — Claude deve retornar JSON puro conforme o prompt
  let parsed: { learnings: RawLearning[] };
  try {
    // Remove possível markdown fence caso Claude adicione
    const jsonStr = textBlock.text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude JSON: ${textBlock.text.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.learnings)) {
    throw new Error('Claude response missing learnings array');
  }

  return parsed.learnings.slice(0, MAX_LEARNINGS);
}

// ── Persistência ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(['angle', 'copy', 'persona', 'creative', 'targeting', 'compliance', 'other']);

async function persistLearnings(
  summary:  PipelineSummary,
  rawList:  RawLearning[],
): Promise<number> {
  let saved = 0;

  for (const raw of rawList) {
    if (!raw.observation?.trim()) continue;

    const category = VALID_CATEGORIES.has(raw.category) ? raw.category : 'other';
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0.5));

    const learningId = randomUUID();

    await db.insert(executionLearnings).values({
      id:          learningId,
      pipeline_id: summary.pipeline_id,
      product_id:  summary.product_id ?? undefined,
      niche_id:    summary.niche_id ?? undefined,
      category,
      observation: raw.observation.trim(),
      evidence:    raw.evidence ?? {},
      confidence:  String(confidence),
      status:      'active',
    });

    // Enfileira embedding usando o queue system existente
    await db.insert(embeddings).values({
      id:           randomUUID(),
      source_table: 'execution_learnings',
      source_id:    learningId,
      // embedding será preenchido pelo batchEmbeddingsWorker
    });

    saved++;
  }

  return saved;
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

/**
 * Extrai learnings de um pipeline concluído.
 * Deve ser chamado de forma não-bloqueante no task-runner:
 *   extractLearningsAsync(pipelineId).catch(...)
 */
export async function extractLearningsAsync(pipelineId: string): Promise<void> {
  const log = (msg: string) => console.info(`[learning-extractor] ${pipelineId.slice(0, 8)} — ${msg}`);

  try {
    log('building summary…');
    const summary = await buildPipelineSummary(pipelineId);

    if (!summary) {
      log('pipeline not found, skipping');
      return;
    }

    const completedTasks = summary.tasks.filter((t) => t.status === 'completed' && t.output);
    if (completedTasks.length === 0) {
      log('no completed tasks with output, skipping');
      return;
    }

    log(`calling Claude (${completedTasks.length} agent outputs)…`);
    const rawLearnings = await extractWithClaude(summary);

    log(`extracted ${rawLearnings.length} learnings, persisting…`);
    const saved = await persistLearnings(summary, rawLearnings);

    log(`done — ${saved} learnings saved`);
  } catch (err) {
    // Nunca falha silenciosamente — mas não propaga (não deve interromper o task-runner)
    console.error(`[learning-extractor] ${pipelineId.slice(0, 8)} — ERROR:`, err);
  }
}
