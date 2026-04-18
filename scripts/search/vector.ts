/**
 * scripts/search/vector.ts
 * Busca semântica nos learnings do nicho via pgvector.
 * Usado pelo orquestrador antes de agentes de pesquisa para injetar contexto acumulado.
 *
 * Uso:
 *   npx tsx scripts/search/vector.ts \
 *     --query "produto emagrecimento termogênico" \
 *     --niche-id <uuid> \
 *     [--limit 5]
 *
 * Output (stdout): JSON array com learnings relevantes
 *
 * NOTA: Requer extensão pgvector e modelo de embedding disponível.
 * Quando MCP Supabase estiver conectado, esta busca pode ser feita diretamente
 * via query SQL sem necessidade deste script.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { db } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function generateQueryEmbedding(query: string): Promise<number[]> {
  // Chama a API de embeddings do Gemini para gerar vetor da query
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não definida');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: query }] },
      }),
    }
  );

  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
  const data = await res.json() as any;
  return data.embedding.values as number[];
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'query':    { type: 'string' },
      'niche-id': { type: 'string' },
      'limit':    { type: 'string', default: '5' },
    },
  });

  const query   = values['query'];
  const nicheId = values['niche-id'];
  const limit   = parseInt(values['limit'] as string);

  if (!query || !nicheId) {
    console.error('Erro: --query e --niche-id são obrigatórios');
    process.exit(1);
  }

  const embedding = await generateQueryEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  // Busca learnings similares usando cosine distance
  const rows = await db.execute(sql`
    SELECT
      nl.content,
      nl.learning_type,
      nl.confidence,
      nl.occurrences,
      e.embedding <=> ${vectorStr}::vector AS distance
    FROM   niche_learnings nl
    JOIN   embeddings e ON e.source_table = 'niche_learnings' AND e.source_id = nl.id
    WHERE  nl.niche_id = ${nicheId}
      AND  nl.status   = 'active'
      AND  e.embedding IS NOT NULL
    ORDER  BY distance ASC
    LIMIT  ${limit}
  `);

  // Também busca execution_learnings relevantes
  const execRows = await db.execute(sql`
    SELECT
      el.observation AS content,
      el.category    AS learning_type,
      el.confidence,
      1              AS occurrences,
      e.embedding <=> ${vectorStr}::vector AS distance
    FROM   execution_learnings el
    JOIN   embeddings e ON e.source_table = 'execution_learnings' AND e.source_id = el.id
    WHERE  el.niche_id = ${nicheId}
      AND  el.status   = 'active'
      AND  e.embedding IS NOT NULL
    ORDER  BY distance ASC
    LIMIT  ${Math.ceil(limit / 2)}
  `);

  const combined = [...(rows as any[]), ...(execRows as any[])]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(r => ({
      content:       r.content,
      learning_type: r.learning_type,
      confidence:    r.confidence,
      occurrences:   r.occurrences,
    }));

  console.log(JSON.stringify(combined, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('[vector-search] erro:', err);
  process.exit(1);
});
