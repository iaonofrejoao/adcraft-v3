// Lógica central do aggregator de learnings — extraída para ser chamável tanto
// pelo cron job quanto por API routes (trigger manual via UI).
//
// Entrada: execution_learnings dos últimos 30 dias (status=active, não invalidados)
// Saída:   upsert em learning_patterns + INSERT em insights (quando elegível)

import { randomUUID } from 'crypto';
import { sql, eq, and, gte, isNull, or } from 'drizzle-orm';
import { db } from './db';
import { executionLearnings, learningPatterns, insights } from '../../frontend/lib/schema/index';
import { callTextClaude } from './llm/claude-provider';

const LOOKBACK_DAYS              = 30;
const MIN_LEARNINGS_FOR_PATTERN  = 3;
const MIN_LEARNINGS_FOR_INSIGHT  = 5;
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

export interface AggregatorResult {
  patternsUpdated:   number;
  insightsGenerated: number;
  groupsProcessed:   number;
}

// ── Coleta de learnings ───────────────────────────────────────────────────────

async function collectLearningGroups(): Promise<LearningGroup[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

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
        or(
          isNull(executionLearnings.validated_by_user),
          eq(executionLearnings.validated_by_user, true),
        ),
        gte(executionLearnings.created_at, new Date(since)),
      ),
    );

  if (rows.length === 0) return [];

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

  const text = await callTextClaude('learning_aggregator', systemPrompt, userMessage);

  try {
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed  = JSON.parse(jsonStr);
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

// ── Geração de insight de alto nível ─────────────────────────────────────────

async function maybeGenerateInsight(
  group:       LearningGroup,
  patternId:   string,
  patternText: string,
  confidence:  number,
): Promise<boolean> {
  if (
    group.learnings.length < MIN_LEARNINGS_FOR_INSIGHT ||
    confidence < MIN_CONFIDENCE_FOR_INSIGHT
  ) return false;

  const systemPrompt = 'Você é um consultor sênior de marketing de performance. Responda APENAS com JSON válido, sem markdown fences.';
  const userMessage  = `Padrão identificado (baseado em ${group.learnings.length} campanhas):
"${patternText}"

Categoria: ${group.category}
Confidence: ${confidence}

Escreva um insight estratégico curto (máximo 3 frases) que explique a implicação prática deste padrão para um profissional de marketing.

Responda APENAS com JSON:
{"title": "Título do insight em até 8 palavras", "body": "Texto do insight aqui."}`;

  const text = await callTextClaude('learning_aggregator_insight', systemPrompt, userMessage);

  try {
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed  = JSON.parse(jsonStr);
    if (!parsed.title || !parsed.body) return false;

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

    return true;
  } catch {
    console.warn('[aggregator] failed to generate insight');
    return false;
  }
}

// ── Upsert de pattern ─────────────────────────────────────────────────────────

async function upsertPattern(
  group:       LearningGroup,
  patternText: string,
  confidence:  number,
): Promise<string> {
  const learningIds = group.learnings.map((l) => l.id);

  const existing = await db.execute(sql`
    SELECT id FROM learning_patterns
    WHERE  category = ${group.category}
      AND  (
        niche_id = ${group.niche_id ?? null}::uuid
        OR (niche_id IS NULL AND ${group.niche_id ?? null} IS NULL)
      )
      AND  status = 'active'
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

// ── Ponto de entrada exportável ───────────────────────────────────────────────

export async function runLearningAggregator(): Promise<AggregatorResult> {
  console.info('[aggregator] iniciando aggregation de learnings…');

  const groups = await collectLearningGroups();
  console.info(`[aggregator] ${groups.length} grupo(s) elegíveis para aggregation`);

  let patternsUpdated   = 0;
  let insightsGenerated = 0;

  for (const group of groups) {
    try {
      const result = await generatePattern(group);
      if (!result) continue;

      const patternId = await upsertPattern(group, result.pattern_text, result.confidence);
      patternsUpdated++;

      console.info(
        `[aggregator] pattern ${patternId.slice(0, 8)} — ` +
        `${group.category} / niche:${group.niche_id?.slice(0, 8) ?? 'global'} — ` +
        `confidence: ${result.confidence.toFixed(2)}`,
      );

      const generated = await maybeGenerateInsight(group, patternId, result.pattern_text, result.confidence);
      if (generated) {
        insightsGenerated++;
        console.info(`[aggregator] insight gerado para pattern ${patternId.slice(0, 8)}`);
      }
    } catch (err) {
      console.error(`[aggregator] erro ao processar grupo ${group.category}:`, err);
    }
  }

  console.info(
    `[aggregator] concluído — ${patternsUpdated} patterns, ${insightsGenerated} insights gerados`,
  );

  return { patternsUpdated, insightsGenerated, groupsProcessed: groups.length };
}
