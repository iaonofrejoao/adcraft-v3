/**
 * Salva artefato video_assets com cenas 1 + 2 (cena 2 com prompt direto, sem skill).
 * Supersede o artefato anterior que só tinha a cena 1.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { eq } from 'drizzle-orm'
import { db } from '../workers/lib/db'
import { pipelines, tasks } from '../frontend/lib/schema/index'
import { saveArtifact } from '../workers/lib/knowledge'
import { supabase } from '../workers/lib/db'

const PIPELINE_ID    = '3e33995e-a511-44ad-b087-82b4c185c72a'
const COMBINATION_ID = '546d21f9-9271-4d71-8ff2-6254507431a3'

async function main() {
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, PIPELINE_ID as any))
  if (!pipeline) throw new Error(`Pipeline ${PIPELINE_ID} não encontrado`)

  const pipelineTasks = await db.select().from(tasks).where(eq(tasks.pipeline_id, PIPELINE_ID as any)).limit(1)
  const taskId = pipelineTasks[0]?.id ?? 'manual-video-maker'

  const artifactData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_video_assets_s1_s2.json'), 'utf-8'))

  const artifactId = await saveArtifact({
    product_id:          pipeline.product_id as string,
    product_version:     pipeline.product_version,
    artifact_type:       'video_assets',
    artifact_data:       artifactData,
    source_pipeline_id:  PIPELINE_ID,
    source_task_id:      taskId,
    copy_combination_id: COMBINATION_ID,
  })

  console.log('Artefato video_assets (s1+s2) salvo:', artifactId)

  // Buscar o final_video_id para esta combinação
  const { data: fv } = await supabase
    .from('final_videos')
    .select('id, status')
    .eq('copy_combination_id', COMBINATION_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fv) {
    console.log(`final_video_id: ${fv.id} (status: ${fv.status})`)
    console.log(`\nPara gerar só a cena 2:`)
    console.log(`npx tsx scripts/video/generate-scenes.ts --final-video-id ${fv.id} --scene 2`)
  } else {
    console.log('Nenhum final_video encontrado para esta combinação.')
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
