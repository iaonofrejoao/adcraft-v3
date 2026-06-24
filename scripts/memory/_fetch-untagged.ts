import { sql } from 'drizzle-orm'
import { db } from '../../workers/lib/db'
import { executionLearnings } from '../../frontend/lib/schema/index'

async function main() {
  const rows = await db
    .select({ id: executionLearnings.id, observation: executionLearnings.observation, category: executionLearnings.category })
    .from(executionLearnings)
    .where(sql`array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0`)
    .limit(100)
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
