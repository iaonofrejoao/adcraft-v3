// Wrapper único para geração de embeddings via Gemini gemini-embedding-001.
// Usa fetch nativo (funciona em Node.js + browser/Edge runtime).
// Skill: pgvector-search.md — "Wrapper único: lib/embeddings/gemini-embeddings.ts"
//
// IMPORTANTE: Para inserir embeddings no banco, use as funções deste módulo
// e grave via tabela `embeddings` (source_table, source_id, embedding, model).
//
// Env obrigatória: GEMINI_API_KEY

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada no .env');
  return key;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  values: number[];  // vetor de 768 dimensões
  model: string;
}

interface GeminiEmbedResponse {
  embedding: { values: number[] };
}

interface GeminiBatchEmbedResponse {
  embeddings: Array<{ values: number[] }>;
}

// ── Single embedding ──────────────────────────────────────────────────────────

/**
 * Gera embedding para um único texto.
 * Lança erro se a API retornar status != 200.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const key = getApiKey();
  const url = `${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini embedContent error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as GeminiEmbedResponse;
  return { values: data.embedding.values, model: EMBEDDING_MODEL };
}

// ── Batch embeddings ──────────────────────────────────────────────────────────

/**
 * Gera embeddings para múltiplos textos em uma única chamada à API (até 100).
 * Mais eficiente que N chamadas individuais para o worker de batch.
 * Skill: pgvector-search.md — "gera em batch (até 100)"
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];
  if (texts.length > 100) {
    throw new Error('Batch máximo de 100 textos por chamada');
  }

  const key = getApiKey();
  const url = `${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${key}`;

  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIM,
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini batchEmbedContents error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as GeminiBatchEmbedResponse;
  return data.embeddings.map((e) => ({ values: e.values, model: EMBEDDING_MODEL }));
}

// ── Serialização para pgvector ────────────────────────────────────────────────

/**
 * Converte um array de floats para a string que o pgvector aceita no INSERT.
 * Exemplo: [0.1, 0.2, ...] → '[0.1,0.2,...]'
 */
export function embeddingToSql(values: number[]): string {
  return `[${values.join(',')}]`;
}
