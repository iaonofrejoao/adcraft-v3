import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env') })
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  const pipelines = await sql`
    SELECT p.id as pipeline_id, pr.sku, pr.id as product_id, p.created_at
    FROM pipelines p
    JOIN products pr ON pr.id = p.product_id
    WHERE pr.sku = 'BWNP'
    ORDER BY p.created_at DESC
    LIMIT 5
  `
  console.log('=== PIPELINES BWNP ===')
  console.log(JSON.stringify(pipelines, null, 2))

  const combinations = await sql`
    SELECT cc.id, cc.tag, cc.pipeline_id
    FROM copy_combinations cc
    JOIN pipelines p ON p.id = cc.pipeline_id
    JOIN products pr ON pr.id = p.product_id
    WHERE pr.sku = 'BWNP' AND cc.tag LIKE '%H2_B1_C2%'
    ORDER BY cc.created_at DESC
    LIMIT 5
  `
  console.log('=== COMBINATIONS H2_B1_C2 ===')
  console.log(JSON.stringify(combinations, null, 2))

  const knowledge = await sql`
    SELECT pk.id, pk.artifact_type, pk.status, pk.copy_combination_id, pk.created_at
    FROM product_knowledge pk
    JOIN products pr ON pr.id = pk.product_id
    WHERE pr.sku = 'BWNP' AND pk.artifact_type IN ('keyframes', 'character', 'video_assets', 'script', 'viral_brief')
    ORDER BY pk.created_at DESC
    LIMIT 20
  `
  console.log('=== PRODUCT KNOWLEDGE BWNP ===')
  console.log(JSON.stringify(knowledge, null, 2))

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
