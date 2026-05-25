/**
 * scripts/creative/generate-scripts-for-combination.ts
 *
 * Busca contexto completo de uma combinação de copy para que o Claude Code
 * possa rodar os agentes criativos (script_writer, character_generator,
 * keyframe_generator, video_maker) via Agent tool.
 *
 * NÃO executa agentes — apenas imprime o contexto estruturado.
 * O Claude Code lê esse output e spawna os agentes.
 *
 * Uso:
 *   npx tsx scripts/creative/generate-scripts-for-combination.ts --combination-id <uuid>
 *
 * Para processar toda a fila de um produto:
 *   npx tsx scripts/creative/generate-scripts-for-combination.ts --product-id <uuid>
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'combination-id': { type: 'string' },
    'product-id':     { type: 'string' },
  },
})

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios')
  return createClient(url, key)
}

async function fetchCombinationContext(combinationId: string) {
  const supabase = getClient()

  // Combination
  const { data: combo, error: comboErr } = await supabase
    .from('copy_combinations')
    .select('id, product_id, pipeline_id, tag, hook_id, body_id, cta_id, full_text, script_status')
    .eq('id', combinationId)
    .single()

  if (comboErr || !combo) throw new Error(`Combinação não encontrada: ${combinationId}`)

  // Copy components
  const { data: components } = await supabase
    .from('copy_components')
    .select('id, component_type, tag, content')
    .in('id', [combo.hook_id, combo.body_id, combo.cta_id])

  const hook = components?.find((c: { id: string }) => c.id === combo.hook_id)
  const body = components?.find((c: { id: string }) => c.id === combo.body_id)
  const cta  = components?.find((c: { id: string }) => c.id === combo.cta_id)

  // Pipeline-level artifacts
  const { data: artifacts } = await supabase
    .from('product_knowledge')
    .select('artifact_type, artifact_data')
    .eq('source_pipeline_id', combo.pipeline_id)
    .is('copy_combination_id', null)
    .in('artifact_type', ['product', 'avatar', 'angles', 'campaign_strategy'])
    .eq('status', 'fresh')

  const ctx: Record<string, unknown> = {}
  for (const row of artifacts ?? []) {
    ctx[(row as { artifact_type: string }).artifact_type] = (row as { artifact_data: unknown }).artifact_data
  }

  // Product info
  const { data: product } = await supabase
    .from('products')
    .select('id, name, sku, target_country, target_language')
    .eq('id', combo.product_id)
    .single()

  return { combo, hook, body, cta, artifacts: ctx, product }
}

async function main() {
  const combinationId = args['combination-id']
  const productId     = args['product-id']

  if (!combinationId && !productId) {
    console.error('Uso: --combination-id <uuid>  ou  --product-id <uuid>')
    process.exit(1)
  }

  const supabase = getClient()
  let combinationIds: string[] = []

  if (combinationId) {
    combinationIds = [combinationId]
  } else {
    // Busca todas as combinações na fila do produto
    const { data: queued } = await supabase
      .from('copy_combinations')
      .select('id, tag, script_status')
      .eq('product_id', productId)
      .in('script_status', ['queued', 'error'])
      .order('created_at', { ascending: true })

    if (!queued || queued.length === 0) {
      console.log('Nenhuma combinação na fila para este produto.')
      process.exit(0)
    }

    combinationIds = queued.map((c: { id: string }) => c.id)
    console.log(`\n${combinationIds.length} combinação(ões) na fila:\n`)
    queued.forEach((c: { tag: string; script_status: string }) =>
      console.log(`  • ${c.tag} (${c.script_status})`)
    )
    console.log()
  }

  for (const id of combinationIds) {
    const ctx = await fetchCombinationContext(id)

    console.log('═'.repeat(72))
    console.log(`COMBINATION: ${ctx.combo.tag}  (id: ${id})`)
    console.log('═'.repeat(72))
    console.log()
    console.log('## Produto')
    console.log(JSON.stringify(ctx.product, null, 2))
    console.log()
    console.log('## Copy desta combinação')
    console.log(`Hook  [${(ctx.hook as { tag?: string })?.tag}]: ${(ctx.hook as { content?: string })?.content}`)
    console.log(`Body  [${(ctx.body as { tag?: string })?.tag}]: ${(ctx.body as { content?: string })?.content}`)
    console.log(`CTA   [${(ctx.cta as { tag?: string })?.tag}]:  ${(ctx.cta as { content?: string })?.content}`)
    console.log()
    console.log('## Contexto do pipeline')
    console.log(JSON.stringify(ctx.artifacts, null, 2))
    console.log()
    console.log(`→ Marcar como generating: UPDATE copy_combinations SET script_status = 'generating' WHERE id = '${id}';`)
    console.log(`→ Marcar como ready:      UPDATE copy_combinations SET script_status = 'ready'      WHERE id = '${id}';`)
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
