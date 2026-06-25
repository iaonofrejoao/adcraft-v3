/**
 * Testa imagen-3.0-capability-001 com subject reference.
 */
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

const LOCATION = process.env.VEO3_LOCATION ?? 'us-central1'

async function main() {
  const projectId = await getProjectId()

  // Carrega a imagem do personagem do Drive
  const { data: output } = await sb
    .from('canvas_node_outputs')
    .select('drive_url')
    .eq('node_id', 'df909972-9e19-4b15-b9f5-f4331b9f829d')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!output?.drive_url) { console.error('Sem output do personagem'); process.exit(1) }

  const proxyRes = await fetch(`http://localhost:3000/api/drive-image?url=${encodeURIComponent(output.drive_url)}`)
  if (!proxyRes.ok) { console.error('Proxy falhou:', proxyRes.status); process.exit(1) }
  const refB64 = Buffer.from(await proxyRes.arrayBuffer()).toString('base64')
  console.log(`✓ Referência: ${refB64.length} chars base64`)

  const prompt = 'White American woman early 40s wavy brown hair sage green sweatshirt, looking at phone with worried expression, UGC style, photorealistic, 9:16 vertical'

  // Testa com imagen-3.0-capability-001 (v1)
  for (const [apiVer, model] of [
    ['v1',     'imagen-3.0-capability-001'],
    ['v1beta', 'imagen-3.0-capability-001'],
    ['v1beta', 'imagen-3.0-generate-001'],
  ] as const) {
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/${apiVer}/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${model}:predict`
    console.log(`\nTestando ${apiVer}/${model}...`)

    const body = {
      instances: [{
        prompt,
        referenceImages: [{
          referenceId:        1,
          referenceType:      'REFERENCE_TYPE_SUBJECT',
          subjectImageConfig: { subjectType: 'SUBJECT_TYPE_PERSON' },
          image: { bytesBase64Encoded: refB64 },
        }],
      }],
      parameters: {
        sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult', safetySetting: 'block_few',
      },
    }

    const res = await fetch(endpoint, {
      method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> }
      const bytes = data.predictions?.[0]?.bytesBase64Encoded?.length ?? 0
      console.log(`✓ OK — ${bytes} chars base64`)
    } else {
      const text = await res.text()
      console.log(`✗ ${res.status}: ${text.slice(0, 200)}`)
    }
  }
}

main().catch(console.error)
