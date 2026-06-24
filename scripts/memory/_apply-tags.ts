/**
 * Aplica tags geradas manualmente (pelo próprio Claude) nos 16 learnings sem tag.
 * Zero custo de API.
 */
import { eq }                from 'drizzle-orm'
import { db }                from '../../workers/lib/db'
import { executionLearnings } from '../../frontend/lib/schema/index'

const TAGS: Record<string, string[]> = {
  'ee85aaa4-87fc-4945-b6ad-65a4fa278471': ['#mecanismo/termogenese', '#mercado/eua', '#dor/peso-corporal', '#fase/topo'],
  '622580fd-9109-4c12-aeda-4cf4b215db72': ['#avatar/mulher-40-54', '#mercado/eua', '#dor/peso-corporal', '#mecanismo/absolvicao-biologica', '#fase/topo'],
  '51dd9e31-3702-408a-9c52-06f40b063faa': ['#canal/facebook', '#avatar/mulher-40-60', '#mercado/eua', '#dor/peso-corporal', '#fase/topo'],
  'c67e2e3c-739a-49e3-9b91-684b130ca07a': ['#mecanismo/espelhamento-emocional', '#formato/copy-body', '#dor/peso-corporal', '#fase/topo'],
  '4ad53c8c-12a1-4773-9cd6-5619a8145dcd': ['#mecanismo/garantia', '#fase/fundo', '#mercado/eua', '#dor/peso-corporal'],
  '70fb043e-7575-4476-8906-4c7a031b704e': ['#canal/google', '#mercado/eua', '#dor/peso-corporal', '#avatar/mulher-40-60', '#fase/topo'],
  '21560d75-8529-4ea6-9214-33e5efcaf8c3': ['#canal/facebook', '#mercado/eua', '#dor/peso-corporal'],
  '9e3d10bc-27f5-4be0-8c53-2eadf12d4af8': ['#canal/google', '#mercado/eua'],
  'a1b2c3d4-0001-0001-0001-000000000001': ['#canal/facebook', '#mercado/eua', '#dor/peso-corporal'],
  'a1b2c3d4-0001-0001-0001-000000000002': ['#mecanismo/diferenciacao-proprietaria', '#mercado/eua', '#canal/google', '#dor/peso-corporal', '#fase/topo'],
  'a1b2c3d4-0001-0001-0001-000000000003': ['#formato/hook-video', '#mecanismo/especificidade-temporal', '#dor/peso-corporal', '#fase/topo'],
  'a1b2c3d4-0001-0001-0001-000000000004': ['#avatar/mulher-38-55', '#mecanismo/absolvicao-biologica', '#dor/peso-corporal', '#mercado/eua', '#fase/topo'],
  'a1b2c3d4-0001-0001-0001-000000000005': ['#canal/facebook', '#mercado/eua', '#dor/peso-corporal', '#avatar/mulher-40-60', '#fase/topo'],
  'a1b2c3d4-0001-0001-0001-000000000006': ['#canal/facebook', '#mercado/eua', '#dor/peso-corporal'],
  'a1b2c3d4-0001-0001-0001-000000000007': ['#canal/google', '#mercado/eua', '#dor/peso-corporal', '#fase/topo'],
  'a1b2c3d4-0001-0001-0001-000000000008': ['#formato/vsl', '#mecanismo/angulo-multiplo', '#dor/peso-corporal', '#mercado/eua'],
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.info(`[apply-tags] ${Object.keys(TAGS).length} learnings — dry-run=${dryRun}`)

  let updated = 0
  for (const [id, tags] of Object.entries(TAGS)) {
    process.stdout.write(`  → ${id.slice(0, 8)}… ${tags.join(' ')}`)
    if (!dryRun) {
      await db.update(executionLearnings).set({ tags }).where(eq(executionLearnings.id, id))
      updated++
    }
    console.info('')
  }

  console.info(`\n[apply-tags] ${dryRun ? '(dry-run)' : `${updated} atualizados`}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
