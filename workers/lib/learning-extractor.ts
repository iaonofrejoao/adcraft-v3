// Agente extrator de learnings — Fase E (Sistema de Memória Cumulativa)
//
// Responsabilidade:
//   Disparado automaticamente após cada pipeline concluído com sucesso.
//   Analisa os outputs do pipeline via Gemini Flash e persiste aprendizados
//   atômicos na tabela `execution_learnings`, enfileirando embeddings.
//
// Modelo: gemini-2.5-flash (custo-benefício para análise estruturada em JSON)

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import {
  pipelines, tasks, products,
  productKnowledge,
  executionLearnings, embeddings,
} from '../../frontend/lib/schema/index';
import { callTextClaude } from './llm/claude-provider';

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
  let niche_id: string | null = null;
  if (pipeline.product_id) {
    const product = await db
      .select({ name: products.name, niche_id: products.niche_id })
      .from(products)
      .where(eq(products.id, pipeline.product_id))
      .limit(1)
      .then((r) => r[0] ?? null);
    product_name = product?.name ?? null;
    niche_id     = product?.niche_id ?? null;
  }

  const taskRows = await db
    .select({
      agent_name: tasks.agent_name,
      status:     tasks.status,
      output:     tasks.output,
    })
    .from(tasks)
    .where(eq(tasks.pipeline_id as any, pipelineId));

  const mappedTasks = taskRows.map((t) => ({
    agent_name: t.agent_name,
    status:     t.status ?? 'unknown',
    output:     t.output as Record<string, unknown> | null,
  }));

  // Fallback: se nenhuma task tem output, usa artefatos de product_knowledge
  const hasOutput = mappedTasks.some((t) => t.status === 'completed' && t.output);
  if (!hasOutput) {
    const SKIP_TYPES = new Set(['script', 'keyframes', 'video_assets', 'character', 'utms', 'product']);
    const artifacts = await db
      .select({
        artifact_type: productKnowledge.artifact_type,
        artifact_data: productKnowledge.artifact_data,
      })
      .from(productKnowledge)
      .where(eq(productKnowledge.source_pipeline_id as any, pipelineId));

    const artifactTasks = artifacts
      .filter((a) => a.artifact_type && !SKIP_TYPES.has(a.artifact_type))
      .map((a) => ({
        agent_name: a.artifact_type!,
        status:     'completed',
        output:     a.artifact_data as Record<string, unknown> | null,
      }));

    if (artifactTasks.length > 0) {
      return {
        pipeline_id:  pipelineId,
        product_id:   pipeline.product_id ?? null,
        niche_id,
        goal:         pipeline.goal,
        product_name,
        tasks: artifactTasks,
      };
    }
  }

  return {
    pipeline_id:  pipelineId,
    product_id:   pipeline.product_id ?? null,
    niche_id,
    goal:         pipeline.goal,
    product_name,
    tasks: mappedTasks,
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

    const outputStr = JSON.stringify(t.output, null, 2);
    const truncated = outputStr.length > 2000
      ? outputStr.slice(0, 2000) + '\n... [truncado]'
      : outputStr;

    lines.push(truncated);
  }

  return lines.join('\n');
}

// ── Extração via Gemini ────────────────────────────────────────────────────────

async function extractWithGemini(summary: PipelineSummary): Promise<RawLearning[]> {
  const systemPrompt = loadSystemPrompt();
  const userMessage  = `Analise este pipeline concluído e extraia aprendizados:\n\n${serializeSummary(summary)}`;

  const text = await callTextClaude(
    'learning_extractor',
    systemPrompt,
    userMessage,
    summary.product_id ?? undefined,
    summary.niche_id   ?? undefined,
  );

  let parsed: { learnings: RawLearning[] };
  try {
    const jsonStr = text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Gemini JSON: ${text.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.learnings)) {
    throw new Error('Gemini response missing learnings array');
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

    await db.insert(embeddings).values({
      id:           randomUUID(),
      source_table: 'execution_learnings',
      source_id:    learningId,
    });

    saved++;
  }

  return saved;
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

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

    log(`calling Gemini (${completedTasks.length} agent outputs)…`);
    const rawLearnings = await extractWithGemini(summary);

    log(`extracted ${rawLearnings.length} learnings, persisting…`);
    const saved = await persistLearnings(summary, rawLearnings);

    log(`done — ${saved} learnings saved`);
  } catch (err) {
    console.error(`[learning-extractor] ${pipelineId.slice(0, 8)} — ERROR:`, err);
  }
}
