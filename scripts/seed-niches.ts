/**
 * scripts/seed-niches.ts
 *
 * Popula a tabela niches com os 12 nichos base de marketing direto brasileiro
 * e gera o embedding de cada um via Gemini, inserindo em `embeddings`.
 *
 * Idempotente: ON CONFLICT (slug) DO NOTHING — rodar novamente não duplica.
 *
 * Uso:
 *   pnpm tsx --env-file=.env scripts/seed-niches.ts
 *
 * Pré-requisito: root .env com DATABASE_URL e GEMINI_API_KEY.
 * O --env-file injeta as vars antes de qualquer import (dotenv não necessário aqui).
 */

import { randomUUID } from 'crypto';
import postgres from 'postgres';
import { callEmbedding } from '../workers/lib/llm/gemini-client';

// ── Dados dos niches ──────────────────────────────────────────────────────────

const NICHES = [
  {
    slug: 'emagrecimento',
    name: 'Emagrecimento',
    embedding_anchor: 'produtos para perda de peso, queima de gordura, metabolismo, termogênicos',
  },
  {
    slug: 'libido',
    name: 'Libido e Performance',
    embedding_anchor: 'produtos para libido masculina, disfunção erétil, performance sexual',
  },
  {
    slug: 'longevidade',
    name: 'Longevidade',
    embedding_anchor: 'suplementos antienvelhecimento, energia, vitalidade após os 40',
  },
  {
    slug: 'beleza',
    name: 'Beleza e Estética',
    embedding_anchor: 'produtos para pele, cabelo, unhas, anti-idade, estética',
  },
  {
    slug: 'memoria',
    name: 'Memória e Foco',
    embedding_anchor: 'suplementos para memória, concentração, foco mental, nootropics',
  },
  {
    slug: 'articulacoes',
    name: 'Articulações',
    embedding_anchor: 'produtos para dor articular, artrite, flexibilidade',
  },
  {
    slug: 'digestao',
    name: 'Digestão',
    embedding_anchor: 'produtos para intestino, digestão, inchaço, microbiota',
  },
  {
    slug: 'sono',
    name: 'Sono',
    embedding_anchor: 'produtos para dormir, insônia, relaxamento',
  },
  {
    slug: 'imunidade',
    name: 'Imunidade',
    embedding_anchor: 'vitaminas, suplementos para imunidade, defesas do corpo',
  },
  {
    slug: 'financas',
    name: 'Finanças Pessoais',
    embedding_anchor: 'cursos de investimento, renda extra, educação financeira',
  },
  {
    slug: 'relacionamentos',
    name: 'Relacionamentos',
    embedding_anchor: 'cursos de conquista, sedução, relacionamento amoroso',
  },
  {
    slug: 'espiritualidade',
    name: 'Espiritualidade',
    embedding_anchor: 'produtos sobre manifestação, lei da atração, oração',
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres.yocbgubxvxpqctbpgpfz:2UhYCyYFJxZTn8hF@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sql = postgres(DB_URL);

  console.log(`\nSeed-niches: ${NICHES.length} nichos a processar\n`);

  let inserted = 0;
  let skipped  = 0;
  let embeds   = 0;

  for (const niche of NICHES) {
    // 1. INSERT niche (idempotente)
    const [row] = await sql<{ id: string; already_existed: boolean }[]>`
      INSERT INTO niches (id, slug, name, embedding_anchor, status)
      VALUES (
        gen_random_uuid(),
        ${niche.slug},
        ${niche.name},
        ${niche.embedding_anchor},
        'active'
      )
      ON CONFLICT (slug) DO UPDATE
        SET embedding_anchor = EXCLUDED.embedding_anchor
      RETURNING id,
        (xmax <> 0) AS already_existed
    `;

    const nicheId = row.id;
    const existed = row.already_existed;

    if (existed) {
      skipped++;
      console.log(`  [skip]   ${niche.slug} (já existe, id=${nicheId})`);
    } else {
      inserted++;
      console.log(`  [insert] ${niche.slug} (id=${nicheId})`);
    }

    // 2. Verifica se já tem embedding para evitar duplicata
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM embeddings
      WHERE source_table = 'niches'
        AND source_id = ${nicheId}::uuid
    `;

    if (parseInt(count) > 0) {
      console.log(`           └─ embedding já existe, pulando`);
      continue;
    }

    // 3. Gera embedding via callEmbedding (Regra 18)
    process.stdout.write(`           └─ gerando embedding … `);
    const vectors = await callEmbedding({
      texts:       niche.embedding_anchor,
      source_table: 'niches',
      source_id:   nicheId,
      niche_id:    nicheId,
    });

    const vector = vectors[0];
    if (!vector || vector.length === 0) {
      console.log(`FALHOU (vetor vazio)`);
      continue;
    }

    // 4. Insere embedding em embeddings
    const pgVectorStr = `[${vector.join(',')}]`;
    await sql`
      INSERT INTO embeddings (id, source_table, source_id, embedding, model)
      VALUES (
        ${randomUUID()},
        'niches',
        ${nicheId}::uuid,
        ${pgVectorStr}::vector(768),
        'gemini-embedding-001'
      )
      ON CONFLICT DO NOTHING
    `;

    embeds++;
    console.log(`OK (${vector.length} dims)`);
  }

  // 5. Relatório final
  console.log('\n─────────────────────────────────────');
  console.log(`Nichos inseridos:  ${inserted}`);
  console.log(`Nichos existentes: ${skipped}`);
  console.log(`Embeddings gerados: ${embeds}`);

  // 6. Confirmação via SELECT
  console.log('\nVerificação final:');
  const rows = await sql<{ slug: string; name: string; emb: string }[]>`
    SELECT
      n.slug,
      n.name,
      COUNT(e.id)::text AS emb
    FROM niches n
    LEFT JOIN embeddings e
      ON e.source_table = 'niches'
      AND e.source_id = n.id
    GROUP BY n.id, n.slug, n.name
    ORDER BY n.slug
  `;

  const colW = 20;
  console.log(`\n  ${'slug'.padEnd(colW)} ${'name'.padEnd(colW)} emb`);
  console.log(`  ${'-'.repeat(colW)} ${'-'.repeat(colW)} ---`);
  for (const r of rows) {
    const ok = parseInt(r.emb) >= 1 ? '✓' : '✗';
    console.log(`  ${r.slug.padEnd(colW)} ${r.name.padEnd(colW)} ${r.emb}  ${ok}`);
  }

  const allOk = rows.every(r => parseInt(r.emb) >= 1);
  console.log(allOk ? '\n✔ Todos os niches têm embedding.' : '\n✗ Alguns niches sem embedding!');

  await sql.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
