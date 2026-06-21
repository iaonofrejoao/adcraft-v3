import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { supabase } from '../../workers/lib/db'

async function main() {
  const jsonPath = path.resolve(__dirname, '_tmp_video_assets.json')
  const artifactData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  const pipelineId     = '0b3138ca-e909-4707-9100-903ba2c006c5'
  const combinationId  = '45a8d78e-ab3d-4040-b413-c83e930c8c1e'
  const productId      = '1fa36147-17d1-4b71-9d83-7af64cb7ba79'
  const taskId         = '39c459ac-ce98-489d-8fab-3a3c57265446'

  // Marcar artefatos anteriores como superseded
  await supabase
    .from('product_knowledge')
    .update({ status: 'superseded', superseded_at: new Date().toISOString() })
    .eq('product_id', productId)
    .eq('artifact_type', 'video_assets')
    .eq('status', 'fresh')
    .eq('copy_combination_id', combinationId)

  // Inserir novo artefato
  const { data, error } = await supabase
    .from('product_knowledge')
    .insert({
      product_id:           productId,
      artifact_type:        'video_assets',
      artifact_data:        artifactData,
      source_pipeline_id:   pipelineId,
      source_task_id:       taskId,
      copy_combination_id:  combinationId,
      status:               'fresh',
    })
    .select('id')
    .single()

  if (error) throw error
  console.log('video_assets artifact salvo — id:', data.id)

  // Criar registro final_video
  const { data: fv, error: fvErr } = await supabase
    .from('final_videos')
    .insert({
      product_id:          productId,
      pipeline_id:         pipelineId,
      copy_combination_id: combinationId,
      status:              'queued',
    })
    .select('id')
    .single()

  if (fvErr) throw fvErr
  console.log('final_video criado — id:', fv.id)
  console.log('\nPróximo passo:')
  console.log(`npx tsx --env-file=.env scripts/video/generate-scenes.ts --final-video-id ${fv.id} --scene 1`)
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
