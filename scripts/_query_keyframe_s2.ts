import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { supabase } from '../workers/lib/db'

async function main() {
  const { data, error } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('id', '24d038d5-cf1b-4b26-8c9e-627d25508e57')
    .single()
  if (error) throw error
  const ad = data!.artifact_data as any
  console.log('artifact_data keys:', Object.keys(ad ?? {}))
  const scenes = (ad?.scenes ?? ad?.keyframes ?? []) as any[]
  console.log('Total cenas:', scenes.length)
  const s3 = scenes.find((s: any) => s.scene_number === 3)
  console.log('CENA 3:\n', JSON.stringify(s3, null, 2))
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
