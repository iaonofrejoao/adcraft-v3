// Worker de geração de embeddings em batch.
// Lê a fila `embeddings WHERE embedding IS NULL`, gera em batch via Gemini,
// e grava os vetores de volta. Roda a cada 30s via task-runner ou standalone.
//
// Lazy generation rules (Skill pgvector-search.md):
//   - niche_learnings: só processa se confidence >= 0.5
//   - product_knowledge: sempre processa
//   - niches: sempre processa (usa embedding_anchor)
//
// Modelo: gemini-embedding-001, dim 768 (PRD seção 2 / schema padrão).
// Fase 2.7.3

import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { embeddings, nicheLearnings, productKnowledge } from '../../../frontend/lib/schema/index';
import { eq, isNull, sql } from 'drizzle-orm';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-embedding-001';
const OUTPUT_DIM = 768;
const MAX_BATCH = 100;
const MIN_CONFIDENCE_FOR_EMBEDDING = 0.5;

// ── Tipos internos ────────────────────────────────────────────────────────────

interface PendingEmbeddingRow {
  embedding_id: string;
  source_table: string;
  source_id: string;
}

interface EmbeddingInput {
  embedding_id: string;
  text: string;
}

// ── Geração de embedding (single) ────────────────────────────────────────────

export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: text,
    config: { outputDimensionality: OUTPUT_DIM },
  });
  return response.embeddings?.[0]?.values ?? [];
}

// ── Geração em batch ─────────────────────────────────────────────────────────

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // A API `embedContent` aceita múltiplos contents em uma chamada
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: texts,
    config: { outputDimensionality: OUTPUT_DIM },
  });

  return (response.embeddings ?? []).map((e) => e.values ?? []);
}

// ── Resolução de texto por source_table ─────────────────────────────────────

/**
 * Para cada row pendente, busca o texto que deve ser embeddado.
 * Aplica regra de lazy generation: niche_learnings apenas se confidence >= 0.5.
 * Retorna apenas os rows que devem ser processados.
 */
async function resolveTexts(
  pendingRows: PendingEmbeddingRow[]
): Promise<EmbeddingInput[]> {
  const result: EmbeddingInput[] = [];

  // Agrupa por source_table para fazer JOINs eficientes
  const byTable = new Map<string, PendingEmbeddingRow[]>();
  for (const row of pendingRows) {
    const arr = byTable.get(row.source_table) ?? [];
    arr.push(row);
    byTable.set(row.source_table, arr);
  }

  // ── product_knowledge ──
  const pkRows = byTable.get('product_knowledge') ?? [];
  if (pkRows.length > 0) {
    const ids = pkRows.map((r) => r.source_id);
    const records = await db
      .select({ id: productKnowledge.id, artifact_data: productKnowledge.artifact_data })
      .from(productKnowledge)
      .where(sql`${productKnowledge.id} = ANY(${ids})`);

    const byId = new Map(records.map((r) => [r.id, r]));
    for (const row of pkRows) {
      const record = byId.get(row.source_id);
      if (!record) continue;
      const text = JSON.stringify(record.artifact_data ?? {});
      result.push({ embedding_id: row.embedding_id, text });
    }
  }

  // ── niche_learnings ── (lazy: só se confidence >= 0.5)
  const nlRows = byTable.get('niche_learnings') ?? [];
  if (nlRows.length > 0) {
    const ids = nlRows.map((r) => r.source_id);
    const records = await db
      .select({ id: nicheLearnings.id, content: nicheLearnings.content, confidence: nicheLearnings.confidence })
      .from(nicheLearnings)
      .where(sql`${nicheLearnings.id} = ANY(${ids})`);

    const byId = new Map(records.map((r) => [r.id, r]));
    for (const row of nlRows) {
      const record = byId.get(row.source_id);
      if (!record) continue;
      const confidence = parseFloat(record.confidence ?? '0');
      if (confidence < MIN_CONFIDENCE_FOR_EMBEDDING) continue; // lazy generation rule
      result.push({ embedding_id: row.embedding_id, text: record.content ?? '' });
    }
  }

  // ── niches ── (usa embedding_anchor como texto representativo)
  const nicheRows = byTable.get('niches') ?? [];
  if (nicheRows.length > 0) {
    const ids = nicheRows.map((r) => r.source_id);
    // niches table vem do v1 — usa raw SQL para não precisar de schema Drizzle v1
    const records = await db.execute<{ id: string; embedding_anchor: string | null }>(
      sql`SELECT id, embedding_anchor FROM niches WHERE id = ANY(${ids})`
    );
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const row of nicheRows) {
      const record = byId.get(row.source_id);
      if (!record?.embedding_anchor) continue; // sem anchor text: não pode embeddizar
      result.push({ embedding_id: row.embedding_id, text: record.embedding_anchor });
    }
  }

  return result;
}

// ── Worker principal ─────────────────────────────────────────────────────────

/**
 * Roda um ciclo de batch embedding:
 * 1. Busca até MAX_BATCH rows com embedding IS NULL
 * 2. Resolve texto por source_table (aplicando lazy generation rules)
 * 3. Gera embeddings em batch via Gemini
 * 4. Grava vetores de volta em `embeddings`
 *
 * Retorna número de embeddings gerados neste ciclo.
 */
export async function batchEmbeddingsWorker(): Promise<number> {
  // 1. Busca fila pendente
  const pending = await db
    .select({
      embedding_id: embeddings.id,
      source_table: embeddings.source_table,
      source_id:    embeddings.source_id,
    })
    .from(embeddings)
    .where(isNull(embeddings.embedding))
    .limit(MAX_BATCH);

  if (pending.length === 0) return 0;

  const validPending = pending.filter(
    (r): r is PendingEmbeddingRow =>
      r.source_table !== null && r.source_id !== null
  );

  // 2. Resolve textos (com lazy generation rules)
  const inputs = await resolveTexts(validPending);

  if (inputs.length === 0) return 0;

  // 3. Gera embeddings em batch
  const texts = inputs.map((i) => i.text);
  let vectors: number[][];
  try {
    vectors = await generateEmbeddingsBatch(texts);
  } catch (err) {
    console.error('[embeddings-worker] batch generation failed:', err);
    throw err;
  }

  // 4. Persiste vetores
  let written = 0;
  for (let i = 0; i < inputs.length; i++) {
    const vector = vectors[i];
    if (!vector || vector.length !== OUTPUT_DIM) {
      console.warn(`[embeddings-worker] embedding ${inputs[i].embedding_id} returned ${vector?.length ?? 0} dims, expected ${OUTPUT_DIM} — skipping`);
      continue;
    }
    const pgVector = `[${vector.join(',')}]`;
    await db
      .update(embeddings)
      .set({ embedding: vector })
      .where(eq(embeddings.id, inputs[i].embedding_id));
    written++;
  }

  console.log(`[embeddings-worker] generated ${written}/${inputs.length} embeddings (${validPending.length} rows in queue, ${validPending.length - inputs.length} skipped by lazy rules)`);
  return written;
}
