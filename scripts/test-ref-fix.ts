import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { getAuthHeaders, getProjectId } from './video/google-auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='

async function main() {
  const projectId = await getProjectId()
  const endpoint  = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-capability-002:predict`

  // Teste 1: PNG mínimo com campo corrigido (referenceImage, não image)
  console.log('--- Teste 1: PNG mínimo + referenceImage correto ---')
  const r1 = await fetch(endpoint, {
    method: 'POST', headers: await getAuthHeaders(),
    body: JSON.stringify({
      instances: [{
        prompt: 'A woman walking outdoors, UGC style, photorealistic',
        referenceImages: [{
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: 1,
          referenceImage: { bytesBase64Encoded: TINY_PNG },
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        }],
      }],
      parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
    }),
  })
  const t1 = await r1.text()
  const ok1 = r1.ok
  console.log(r1.status, ok1 ? `✓ OK — ${JSON.parse(t1).predictions?.[0]?.bytesBase64Encoded?.length} chars` : t1.slice(0, 250))

  if (!ok1) return

  // Teste 2: imagem real do personagem Jennifer
  console.log('\n--- Teste 2: imagem real do personagem ---')
  const { data: output } = await sb
    .from('canvas_node_outputs')
    .select('drive_url')
    .eq('node_id', 'df909972-9e19-4b15-b9f5-f4331b9f829d')
    .eq('is_active', true)
    .maybeSingle()

  const proxyRes = await fetch(`http://localhost:3000/api/drive-image?url=${encodeURIComponent(output!.drive_url!)}`)
  const refB64   = Buffer.from(await proxyRes.arrayBuffer()).toString('base64')
  console.log(`Referência: ${refB64.length} chars base64`)

  const r2 = await fetch(endpoint, {
    method: 'POST', headers: await getAuthHeaders(),
    body: JSON.stringify({
      instances: [{
        prompt: 'White American woman early 40s wavy brown hair sage sweatshirt, sitting at kitchen table looking worried at phone, UGC selfie style, photorealistic, vertical',
        referenceImages: [{
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: 1,
          referenceImage: { bytesBase64Encoded: refB64 },
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
        }],
      }],
      parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
    }),
  })
  const t2 = await r2.text()
  console.log(r2.status, r2.ok ? `✓ OK — ${JSON.parse(t2).predictions?.[0]?.bytesBase64Encoded?.length} chars` : t2.slice(0, 250))
}

main().catch(console.error)
