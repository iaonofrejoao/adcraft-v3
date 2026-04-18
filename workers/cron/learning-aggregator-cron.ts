// Cron diário do aggregator de learnings — Fase E (Sistema de Memória Cumulativa)
//
// Executa uma vez quando invocado; agendar via OS cron ou scheduler externo:
//   0 3 * * *  node /app/workers/dist/cron/learning-aggregator-cron.js
//
// Lógica:
//   1. Busca execution_learnings dos últimos 30 dias (status='active', validated_by_user != false)
//   2. Agrupa por (category, niche_id) usando query SQL
//   3. Para grupos com ≥ 3 learnings: gera um pattern via Gemini Flash
//   4. Upsert em learning_patterns
//   5. Para patterns de alta confidence (≥ 0.7) com ≥ 5 learnings: considera virar insight
//
// Modelo: gemini-2.5-flash
// Fase E

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { sql, eq, and, gte, ne, isNull, or } from 'drizzle-orm';
import { db } from '../lib/db';
import { executionLearnings, learningPatterns, insights } from '../../frontend/lib/schema/index';
import { callTextGemini } from '../lib/llm/gemini-client';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MODEL             = 'gemini-2.5-flash';
const LOOKBACK_DAYS     = 30;
const MIN_LEARNINGS_FOR_PATTERN = 3;
const MIN_LEARNINGS_FOR_INSIGHT = 5;
const MIN_CONFIDENCE_FOR_INSIGHT = 0.70;

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface LearningGroup {
  category:  string;
  niche_id:  string | null;
  learnings: Array<{
    id:          string;
    observation: string;
    evidence:    Record<string, unknown> | null;
    confidence:  number;
  }>;
}

// ── Coleta de learnings ────────────────────────────────────────────────────────

async function collectLearningGroups(): Promise<LearningGroup[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Busca learnings válidos dos últimos 30 dias
  const rows = await db
    .select({
      id:          executionLearnings.id,
      category:    executionLearnings.category,
      niche_id:    executionLearnings.niche_id,
      observation: executionLearnings.observation,
      evidence:    executionLearnings.evidence,
      confidence:  executionLearnings.confidence,
    })
    .from(executionLearnings)
    .where(
      and(
        eq(executionLearnings.status, 'active'),
        // Exclui learnings explicitamente invalidados pelo usuário
        or(
          isNull(executionLearnings.validated_by_user),
          eq(executionLearnings.validated_by_user, true),
        ),
        gte(executionLearnings.created_at, new Date(since)),
      )
    );

  if (rows.length === 0) return [];

  // Agrupa por category + niche_id
  const groupMap = new Map<string, LearningGroup>();

  for (const row of rows) {
    const key = `${row.category}::${row.niche_id ?? 'global'}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        category: row.category,
        niche_id: row.niche_id ?? null,
        learnings: [],
      });
    }

    groupMap.get(key)!.learnings.push({
      id:          row.id,
      observation: row.observation,
      evidence:    row.evidence as Record<string, unknown> | null,
      confidence:  parseFloat(row.confidence ?? '0.5'),
    });
  }

  return [...groupMap.values()].filter((g) => g.learnings.length >= MIN_LEARNINGS_FOR_PATTERN);
}

// ── Geração de pattern via Gemini ─────────────────────────────────────────────

async function generatePattern(
  group: LearningGroup,
): Promise<{ pattern_text: string; confidence: number } | null> {
  const learningsText = group.learnings
    .map((l, i) => `${i + 1}. [confidence: ${l.confidence}] ${l.observation}`)
    .join('\n');

  const systemPrompt = 'Você é um analista de marketing de performance. Responda APENAS com JSON válido, sem markdown fences.';
  const userMessage  = `Abaixo estão ${group.learnings.length} aprendizados individuais da categoria "${group.category}"${group.niche_id ? ` para o nicho ${group.niche_id}` : ' (global)'}.

${learningsText}

Sintetize esses aprendizados em UM padrão agregado. O padrão deve:
- Ser uma afirmação factual e específica (não genérica)
- Capturar o que é recorrente nos learnings
- Ter entre 1 e 3 frases

Responda APENAS com JSON:
{"pattern_text": "...", "confidence": 0.XX}

confidence deve ser entre 0.40 e 0.90, refletindo a consistência dos learnings.`;

  const text = await callTextGemini('learning_aggregator', MODEL, systemPrompt, userMessage);

  try {
    const jsonStr = text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed.pattern_text) return null;
    return {
      pattern_text: String(parsed.pattern_text).trim(),
      confidence:   Math.min(0.9, Math.max(0.4, Number(parsed.confidence) || 0.5)),
    };
  } catch {
    console.warn('[aggregator] failed to parse Gemini pattern response');
    return null;
  }
}

// ── Geração de insight de alto nível ──────────────────────────────────────────

async function maybeGenerateInsight(
  group:       LearningGroup,
  patternId:   string,
  patternText: string,
  confidence:  number,
): Promise<void> {
  if (
    group.learnings.length < MIN_LEARNINGS_FOR_INSIGHT ||
    confidence < MIN_CONFIDENCE_FOR_INSIGHT
  ) return;

  const systemPrompt = 'Você é um consultor sênior de marketing de performance. Responda APENAS com JSON válido, sem markdown fences.';
  const userMessage  = `Padrão identificado (baseado em ${group.learnings.length} campanhas):
"${patternText}"

Categoria: ${group.category}
Confidence: ${confidence}

Escreva um insight estratégico curto (máximo 3 frases) que explique a implicação prática deste padrão para um profissional de marketing.

Responda APENAS com JSON:
{"title": "Título do insight em até 8 palavras", "body": "Texto do insight aqui."}`;

  const text = await callTextGemini('learning_aggregator_insight', MODEL, systemPrompt, userMessage);

  try {
    const jsonStr = text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    const parsed = JSON.parse(jsonStr);
    if (!parsed.title || !parsed.body) return;

    const importance = group.learnings.length >= 10 ? 5
                     : group.learnings.length >= 7  ? 4
                     : 3;

    await db.insert(insights).values({
      id:          randomUUID(),
      title:       parsed.title,
      body:        parsed.body,
      importance,
      source:      'aggregator',
      pattern_ids: [patternId],
    });

    console.info(`[aggregator] insight gerado para pattern ${patternId.slice(0, 8)}`);
  } catch {
    console.warn('[aggregator] failed to generate insight');
  }
}

// ── Upsert de pattern ─────────────────────────────────────────────────────────

async function upsertPattern(
  group:        LearningGroup,
  patternText:  string,
  confidence:   number,
): Promise<string> {
  const learningIds = group.learnings.map((l) => l.id);

  // Busca pattern existente para este grupo (category + niche_id) para upsert
  const existing = await db.execute(sql`
    SELECT id FROM learning_patterns
    WHERE category = ${group.category}
      AND (niche_id = ${group.niche_id ?? null}::uuid OR (niche_id IS NULL AND ${group.niche_id ?? null} IS NULL))
      AND status = 'active'
    LIMIT 1
  `);

  const existingRow = (existing as unknown as { id: string }[])[0];

  if (existingRow) {
    await db
      .update(learningPatterns)
      .set({
        pattern_text:            patternText,
        supporting_learning_ids: learningIds,
        supporting_count:        learningIds.length,
        confidence:              String(confidence),
        updated_at:              new Date(),
      })
      .where(eq(learningPatterns.id, existingRow.id));

    return existingRow.id;
  }

  const newId = randomUUID();
  await db.insert(learningPatterns).values({
    id:                      newId,
    pattern_text:            patternText,
    category:                group.category,
    niche_id:                group.niche_id ?? undefined,
    supporting_learning_ids: learningIds,
    supporting_count:        learningIds.length,
    confidence:              String(confidence),
    status:                  'active',
  });

  return newId;
}

// ── Ponto de entrada ──────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.info('[aggregator] iniciando aggregation de learnings…');

  const groups = await collectLearningGroups();
  console.info(`[aggregator] ${groups.length} grupo(s) elegíveis para aggregation`);

  let patternsCreated   = 0;
  let insightsGenerated = 0;

  for (const group of groups) {
    try {
      const result = await generatePattern(group);
      if (!result) continue;

      const patternId = await upsertPattern(group, result.pattern_text, result.confidence);

      patternsCreated++;

      console.info(
        `[aggregator] pattern ${patternId.slice(0, 8)} — ` +
        `${group.category} / niche:${group.niche_id?.slice(0, 8) ?? 'global'} — ` +
        `confidence: ${result.confidence.toFixed(2)}`
      );

      // Tenta gerar insight de alto nível para patterns fortes
      const insightsBefore = insightsGenerated;
      await maybeGenerateInsight(group, patternId, result.pattern_text, result.confidence);
      if (insightsGenerated > insightsBefore) insightsGenerated++;

    } catch (err) {
      console.error(`[aggregator] erro ao processar grupo ${group.category}:`, err);
      // Continua para os outros grupos
    }
  }

  console.info(
    `[aggregator] concluído — ` +
    `${patternsCreated} patterns, ${insightsGenerated} insights gerados`,
  );
}

run().catch((err) => {
  console.error('[aggregator] FATAL:', err);
  process.exit(1);
});
