/**
 * Testa geração de imagem do personagem Jennifer via Vertex AI.
 * Executa: npx tsx scripts/test-image-gen.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { generateImage } from '../workers/lib/canvas/image-gen'
import { uploadToCanvasFolder } from '../workers/lib/canvas/drive-upload'

// Carrega .env raiz primeiro, depois frontend/.env.local (sobrepõe)
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') })

// Corrige path relativo de credenciais (resolve da raiz do projeto, não de frontend/)
function resolveCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? ''
  if (!raw || path.isAbsolute(raw)) return

  const fromRoot     = path.resolve(process.cwd(), raw)
  const fromFrontend = path.resolve(process.cwd(), 'frontend', raw)

  if (fs.existsSync(fromRoot)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fromRoot
    console.log('✓ Credenciais:', fromRoot)
  } else if (fs.existsSync(fromFrontend)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fromFrontend
    console.log('✓ Credenciais:', fromFrontend)
  } else {
    console.error('✗ Arquivo de credenciais não encontrado:\n ', fromRoot, '\n ', fromFrontend)
    process.exit(1)
  }
}

const NODE_ID = 'df909972-9e19-4b15-b9f5-f4331b9f829d'
const PROMPT  = 'White American woman, early 40s, natural medium brown shoulder-length wavy hair, wearing a soft sage green crew-neck sweatshirt, standing in a clean American suburban kitchen with white cabinets and butcher-block countertop, soft natural side window light, warm-neutral tone, genuine relieved expression, UGC style, photorealistic, frontal view, upper body visible'

async function main() {
  resolveCredentials()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('\n── Gerando imagem via Vertex AI ──')
  console.log('Modelo :', process.env.NANO_BANANA_MODEL_ID ?? 'gemini-2.0-flash-preview-image-generation')
  console.log('Região :', process.env.NANO_BANANA_LOCATION ?? process.env.VEO3_LOCATION ?? 'us-central1')

  await supabase.from('canvas_nodes').update({
    generation_status: 'generating',
    error_message:     null,
    updated_at:        new Date().toISOString(),
  }).eq('id', NODE_ID)

  try {
    console.log('⏳ Chamando Vertex AI…')
    const start   = Date.now()
    const buffers = await generateImage(PROMPT, { count: 1, aspectRatio: '9:16' })
    console.log(`✓ Imagem gerada em ${((Date.now() - start) / 1000).toFixed(1)}s — ${buffers[0].length} bytes`)

    console.log('⏳ Upload para o Drive…')
    const { fileId, driveUrl } = await uploadToCanvasFolder(
      buffers[0], `personagem_${Date.now()}.png`, 'image/png',
      'SUEA', 'test', 'personagens',
    )
    console.log('✓ Drive URL:', driveUrl)

    await supabase.from('canvas_node_outputs').insert({
      node_id:       NODE_ID,
      output_type:   'image',
      drive_file_id: fileId,
      drive_url:     driveUrl,
      is_active:     true,
    })

    await supabase.from('canvas_nodes').update({
      generation_status: 'done',
      error_message:     null,
      updated_at:        new Date().toISOString(),
    }).eq('id', NODE_ID)

    console.log('\n✅ Concluído! Abra/recarregue o canvas para ver a imagem.')
  } catch (err) {
    const msg = String((err as Error).message ?? err)
    console.error('\n✗ ERRO:', msg)
    await supabase.from('canvas_nodes').update({
      generation_status: 'error',
      error_message:     msg.slice(0, 1000),
      updated_at:        new Date().toISOString(),
    }).eq('id', NODE_ID)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
