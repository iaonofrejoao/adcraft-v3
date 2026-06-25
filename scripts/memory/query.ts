/**
 * scripts/memory/query.ts
 *
 * Busca memórias relevantes combinando filtro por tags + busca vetorial.
 * Usado pelo orquestrador para injetar contexto acumulado ANTES de cada agente.
 *
 * Modos de uso:
 *
 *   # 1. Por tags — zero API, instantâneo
 *   npx tsx scripts/memory/query.ts \
 *     --tags "#mercado/eua,#dor/peso-corporal" \
 *     --limit 10
 *
 *   # 2. Por similaridade semântica — requer GEMINI_API_KEY com créditos
 *   npx tsx scripts/memory/query.ts \
 *     --query "copy emocional mulher 40+ emagrecimento" \
 *     --niche-id <uuid> \
 *     --limit 8
 *
 *   # 3. Combinado — tags filtram, vetor ranqueia dentro do filtro
 *   npx tsx scripts/memory/query.ts \
 *     --tags "#mercado/eua,#dor/peso-corporal" \
 *     --query "ângulo diferenciado mecanismo proprietário" \
 *     --niche-id <uuid> \
 *     --limit 8
 *
 * Flags opcionais:
 *   --category angle|copy|persona|targeting|compliance|creative
 *   --min-confidence 0.5    (padrão 0.4)
 *   --include-patterns      (inclui learning_patterns além de learnings)
 *   --format md|json        (padrão: md — pronto para injeção em prompt)
 *
 * Output padrão (Markdown):
 *   Bloco "## Memória relevante" pronto para colar num prompt de agente.
 */

import { parseArgs } from 'node:util'
import { sql }       from 'drizzle-orm'
import { db }        from '../../workers/lib/db'

// ── CLI ───────────────────────────────────────────────────────────────────────
const { values: argv } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'tags':             { type: 'string'  },
    'query':            { type: 'string'  },
    'niche-id':         { type: 'string'  },
    'category':         { type: 'string'  },
    'limit':            { type: 'string', default: '8'   },
    'min-confidence':   { type: 'string', default: '0.4' },
    'include-patterns': { type: 'boolean', default: false },
    'format':           { type: 'string', default: 'md'  },
  },
  strict: false,
})

const tagsArg      = argv['tags']    ? (argv['tags'] as string).split(',').map(t => t.trim()) : []
const queryText    = (argv['query']    as string | undefined) ?? null
const nicheId      = (argv['niche-id'] as string | undefined) ?? null
const category     = (argv['category'] as string | undefined) ?? null
const limit        = parseInt(argv['limit'] as string, 10)
const minConf      = parseFloat(argv['min-confidence'] as string)
const inclPatterns = argv['include-patterns'] as boolean
const format       = argv['format'] as string

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface MemRow {
  id:          string
  type:        'learning' | 'pattern'
  category:    string | null
  content:     string
  tags:        string[]
  confidence:  number
  created_at:  string
  distance?:   number
}

// ── Embedding via Gemini (usado quando --query é passado) ─────────────────────
async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } }),
      }
    )
    if (!res.ok) return null
    const data = await res.json() as { embedding: { values: number[] } }
    return data.embedding.values
  } catch { return null }
}

// ── Busca principal ───────────────────────────────────────────────────────────
async function fetchLearnings(embedding: number[] | null): Promise<MemRow[]> {
  const tagFilter  = tagsArg.length > 0 ? sql`AND tags && ARRAY[${sql.join(tagsArg.map(t => sql`${t}`), sql`, `)}]::text[]` : sql``
  const catFilter  = category ? sql`AND category = ${category}` : sql``
  const nicheFilter = nicheId ? sql`AND niche_id = ${nicheId}` : sql``

  if (embedding) {
    const vec = `[${embedding.join(',')}]`
    const rows = await db.execute(sql`
      SELECT
        el.id,
        'learning'        AS type,
        el.category,
        el.observation    AS content,
        COALESCE(el.tags, ARRAY[]::text[]) AS tags,
        el.confidence::float,
        el.created_at::text,
        e.embedding <=> ${vec}::vector AS distance
      FROM   execution_learnings el
      LEFT JOIN embeddings e
             ON e.source_table = 'execution_learnings' AND e.source_id = el.id
      WHERE  el.status = 'active'
        AND  el.confidence >= ${minConf}
        ${tagFilter}
        ${catFilter}
        ${nicheFilter}
      ORDER  BY distance ASC NULLS LAST, el.confidence DESC
      LIMIT  ${limit}
    `)
    return (rows as MemRow[])
  }

  // Sem embedding — ordena por confiança
  const rows = await db.execute(sql`
    SELECT
      id,
      'learning'      AS type,
      category,
      observation     AS content,
      COALESCE(tags, ARRAY[]::text[]) AS tags,
      confidence::float,
      created_at::text
    FROM   execution_learnings
    WHERE  status = 'active'
      AND  confidence >= ${minConf}
      ${tagFilter}
      ${catFilter}
      ${nicheFilter}
    ORDER  BY confidence DESC
    LIMIT  ${limit}
  `)
  return (rows as MemRow[])
}

async function fetchPatterns(embedding: number[] | null): Promise<MemRow[]> {
  const tagFilter  = tagsArg.length > 0 ? sql`AND tags && ARRAY[${sql.join(tagsArg.map(t => sql`${t}`), sql`, `)}]::text[]` : sql``
  const catFilter  = category ? sql`AND category = ${category}` : sql``
  const nicheFilter = nicheId ? sql`AND niche_id = ${nicheId}` : sql``
  const patLimit   = Math.ceil(limit / 3)

  if (embedding) {
    const vec = `[${embedding.join(',')}]`
    const rows = await db.execute(sql`
      SELECT
        lp.id,
        'pattern'         AS type,
        lp.category,
        lp.pattern_text   AS content,
        COALESCE(lp.tags, ARRAY[]::text[]) AS tags,
        lp.confidence::float,
        lp.updated_at::text AS created_at,
        e.embedding <=> ${vec}::vector AS distance
      FROM   learning_patterns lp
      LEFT JOIN embeddings e
             ON e.source_table = 'learning_patterns' AND e.source_id = lp.id
      WHERE  lp.status = 'active'
        AND  lp.confidence >= ${minConf}
        ${tagFilter}
        ${catFilter}
        ${nicheFilter}
      ORDER  BY distance ASC NULLS LAST, lp.supporting_count DESC
      LIMIT  ${patLimit}
    `)
    return (rows as MemRow[])
  }

  const rows = await db.execute(sql`
    SELECT
      id,
      'pattern'       AS type,
      category,
      pattern_text    AS content,
      COALESCE(tags, ARRAY[]::text[]) AS tags,
      confidence::float,
      updated_at::text AS created_at
    FROM   learning_patterns
    WHERE  status = 'active'
      AND  confidence >= ${minConf}
      ${tagFilter}
      ${catFilter}
      ${nicheFilter}
    ORDER  BY supporting_count DESC, confidence DESC
    LIMIT  ${patLimit}
  `)
  return (rows as MemRow[])
}

// ── Formatação ─────────────────────────────────────────────────────────────────
function renderMarkdown(rows: MemRow[], hadEmbedding: boolean): string {
  if (rows.length === 0) {
    return '## Memória relevante\n\n_(nenhum resultado para os filtros aplicados)_\n'
  }

  const filterSummary = [
    tagsArg.length  ? `tags: ${tagsArg.join(', ')}` : null,
    queryText       ? `query: "${queryText}"` : null,
    category        ? `categoria: ${category}` : null,
    nicheId         ? `niche_id: ${nicheId}` : null,
    !hadEmbedding && queryText ? '_(sem embedding — ranqueado por confiança)_' : null,
  ].filter(Boolean).join(' · ')

  const lines: string[] = [
    `## Memória relevante (${rows.length} resultados)`,
    filterSummary ? `_Filtros: ${filterSummary}_` : '',
    '',
  ]

  for (const r of rows) {
    const typeLabel = r.type === 'pattern' ? '📌 Padrão' : '💡 Learning'
    const confPct   = Math.round(r.confidence * 100)
    const tagStr    = Array.isArray(r.tags) && r.tags.length ? r.tags.join(' ') : ''
    const dist      = r.distance != null ? ` · dist: ${Number(r.distance).toFixed(3)}` : ''

    lines.push(`### ${typeLabel} · ${r.category ?? 'geral'} · ${confPct}% confiança${dist}`)
    if (tagStr) lines.push(tagStr)
    lines.push(`> ${r.content.replace(/\n/g, '\n> ')}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const embedding   = queryText ? await getEmbedding(queryText) : null
  const hadEmbedding = !!embedding

  const learnings = await fetchLearnings(embedding)
  const patterns  = inclPatterns ? await fetchPatterns(embedding) : []

  const combined = [...patterns, ...learnings]
    .sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance
      return b.confidence - a.confidence
    })
    .slice(0, limit)

  if (format === 'json') {
    process.stdout.write(JSON.stringify(combined, null, 2) + '\n')
  } else {
    process.stdout.write(renderMarkdown(combined, hadEmbedding) + '\n')
  }

  process.exit(0)
}

main().catch(e => { console.error('[memory/query]', e); process.exit(1) })
