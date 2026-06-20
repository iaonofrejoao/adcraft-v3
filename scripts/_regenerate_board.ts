/**
 * Regenera o character board usando o canonical_personas_prompt do video_assets
 * (Banana Pro Director 2.0 grammar), em vez do image_prompt_en do artefato character.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { supabase } from '../workers/lib/db'
import { generateCharacterBoard } from './video/nano-banana-client'
import { savePersonaImages } from './video/local-storage'

const PRODUCT_ID       = 'ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3'
const COMBINATION_ID   = '546d21f9-9271-4d71-8ff2-6254507431a3'
const SKU              = 'BWNP'

async function main() {
  // 1. Buscar canonical_personas_prompt do novo video_assets
  const { data: va, error: vaErr } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', PRODUCT_ID)
    .eq('artifact_type', 'video_assets')
    .eq('status', 'fresh')
    .eq('copy_combination_id', COMBINATION_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (vaErr || !va) throw new Error(`video_assets não encontrado: ${vaErr?.message}`)

  const canonicalPrompt = (va.artifact_data as any).canonical_personas_prompt as string
  if (!canonicalPrompt) throw new Error('canonical_personas_prompt não encontrado no video_assets')

  console.log('=== Regenerando character board com Banana Pro Director 2.0 ===\n')
  console.log(`Prompt (primeiros 120 chars): "${canonicalPrompt.slice(0, 120)}..."\n`)

  // 2. Buscar persona_asset existente
  const { data: asset } = await supabase
    .from('persona_assets')
    .select('id, status')
    .eq('product_id', PRODUCT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!asset) throw new Error('persona_asset não encontrado')
  console.log(`persona_asset: ${asset.id} (status: ${asset.status})\n`)

  // 3. Gerar novo board
  console.log('Gerando character board via Nano Banana (4 imagens)...')
  const boardImages = await generateCharacterBoard(canonicalPrompt)
  console.log(`Board gerado: ${boardImages.length} imagens`)

  // 4. Salvar imagens (sobrescreve as antigas em C:\Videos\AdCraft\personas\BWNP\)
  console.log(`\nSalvando em C:\\Videos\\AdCraft\\personas\\${SKU}\\...`)
  const imagePaths = await savePersonaImages(boardImages, SKU)
  for (const p of imagePaths) console.log(`  → ${p}`)

  // 5. Atualizar persona_asset no banco
  const { error: updateErr } = await supabase
    .from('persona_assets')
    .update({
      nano_banana_character_board: {
        image_urls:   imagePaths,
        generated_at: new Date().toISOString(),
        prompt_version: 'banana-pro-director-2.0',
      },
      status:       'ready',
      completed_at: new Date().toISOString(),
    })
    .eq('id', asset.id)

  if (updateErr) throw updateErr
  console.log(`\npersona_asset ${asset.id} atualizado — status: ready`)
  console.log('Character board regenerado com sucesso.')
  process.exit(0)
}

main().catch(e => { console.error('Erro:', e); process.exit(1) })
