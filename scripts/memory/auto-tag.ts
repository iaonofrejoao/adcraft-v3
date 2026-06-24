/**
 * Auto-tagger retroativo de memórias
 *
 * Este script opera em dois modos:
 *
 * 1. DUMP — lista learnings sem tags para revisão do Claude Code:
 *    npx tsx scripts/memory/auto-tag.ts --dump [--limit=N]
 *    Saída: JSON com id + observation + category
 *
 * 2. APPLY — aplica tags geradas (pelo Claude Code ou manualmente):
 *    npx tsx scripts/memory/auto-tag.ts --apply=<arquivo.json>
 *    O arquivo deve ser Array<{ id: string; tags: string[] }>
 *
 * Fluxo recomendado sem créditos de API:
 *   1. npx tsx scripts/memory/auto-tag.ts --dump > /tmp/untagged.json
 *   2. Claude Code lê o arquivo, gera as tags e grava /tmp/tagged.json
 *   3. npx tsx scripts/memory/auto-tag.ts --apply=/tmp/tagged.json
 */

import { readFileSync }      from 'fs'
import { eq, sql }           from 'drizzle-orm'
import { db }                from '../../workers/lib/db'
import { executionLearnings } from '../../frontend/lib/schema/index'

const VALID_TAG = /^#(avatar|dor|mecanismo|mercado|formato|canal|fase)\/[\w-]+$/

function validateTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .filter((t): t is string => typeof t === 'string' && VALID_TAG.test(t))
    .slice(0, 5)
}

async function runDump(limit: number) {
  const rows = await db
    .select({ id: executionLearnings.id, observation: executionLearnings.observation, category: executionLearnings.category })
    .from(executionLearnings)
    .where(sql`array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0`)
    .limit(limit)

  if (rows.length === 0) {
    console.info('[auto-tag] nenhum learning sem tags encontrado')
    return
  }

  console.info(`[auto-tag] ${rows.length} learnings sem tags:`)
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
}

async function runApply(filepath: string) {
  const raw = JSON.parse(readFileSync(filepath, 'utf-8')) as { id: string; tags: unknown }[]
  let updated = 0
  for (const entry of raw) {
    const tags = validateTags(entry.tags)
    if (!tags.length) { console.warn(`[skip] ${entry.id} — sem tags válidas`); continue }
    await db.update(executionLearnings).set({ tags }).where(eq(executionLearnings.id, entry.id))
    console.info(`  ✓ ${entry.id.slice(0, 8)}… ${tags.join(' ')}`)
    updated++
  }
  console.info(`\n[auto-tag] ${updated} learnings atualizados`)
}

async function main() {
  const args      = process.argv.slice(2)
  const limit     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '100', 10)
  const applyFile = args.find(a => a.startsWith('--apply='))?.split('=').slice(1).join('=')

  if (applyFile) {
    await runApply(applyFile)
  } else {
    await runDump(limit)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
