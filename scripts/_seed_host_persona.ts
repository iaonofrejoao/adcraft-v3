/**
 * Semeia character_boards_by_persona['host'] com board-1.png já existente em disco.
 * Evita nova chamada ao Nano Banana quando a cota está esgotada.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { supabase } from '../workers/lib/db'

const PRODUCT_ID = 'ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3'
const BOARD_IMAGE = 'C:\\Videos\\AdCraft\\personas\\BWNP\\board-1.png'

async function main() {
  // Verificar se imagem existe
  if (!fs.existsSync(BOARD_IMAGE)) throw new Error(`Imagem não encontrada: ${BOARD_IMAGE}`)
  console.log(`Imagem existente: ${BOARD_IMAGE} (${(fs.statSync(BOARD_IMAGE).size / 1024).toFixed(1)} KB)`)

  // Buscar persona_asset
  const { data: asset, error } = await supabase
    .from('persona_assets')
    .select('id, character_boards_by_persona')
    .eq('product_id', PRODUCT_ID)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !asset) throw new Error(`persona_asset não encontrado: ${error?.message}`)
  console.log(`persona_asset: ${asset.id}`)

  const boards = { ...(asset.character_boards_by_persona ?? {}) } as Record<string, unknown>
  boards['host'] = {
    image_url:    BOARD_IMAGE,
    prompt:       'seeded from existing board-1.png',
    generated_at: new Date().toISOString(),
  }

  const { error: updateErr } = await supabase
    .from('persona_assets')
    .update({ character_boards_by_persona: boards })
    .eq('id', asset.id)

  if (updateErr) throw updateErr
  console.log(`character_boards_by_persona['host'] → ${BOARD_IMAGE}`)
  console.log('Pronto. Rode generate-scenes.ts novamente — não chamará a API.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
