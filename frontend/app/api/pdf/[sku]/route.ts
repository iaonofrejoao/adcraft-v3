// GET /api/pdf/[sku] — gera e retorna o estudo completo do produto em PDF
// Sem parâmetros obrigatórios; busca todos os artefatos disponíveis automaticamente.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement, type JSXElementConstructor } from 'react'
import { ProductStudyPDF } from '@/lib/pdf/document'
import type { CopyComponent } from '@/lib/pdf/sections/copy'

export const runtime = 'nodejs'
// Aumenta timeout para geração do PDF (máx. 60s no Vercel)
export const maxDuration = 60

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function GET(
  _req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params
  const supabase = getServiceClient()

  // 1. Buscar produto pelo SKU
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select(`
      id, name, sku, platform, ticket_price, commission_percent,
      target_country, target_language, status,
      niches ( name )
    `)
    .eq('sku', sku)
    .maybeSingle()

  if (productErr) {
    return NextResponse.json({ error: productErr.message }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  // 2. Buscar todos os artefatos frescos do produto
  const { data: knowledge, error: knowledgeErr } = await supabase
    .from('product_knowledge')
    .select('artifact_type, artifact_data, created_at')
    .eq('product_id', product.id)
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })

  if (knowledgeErr) {
    return NextResponse.json({ error: knowledgeErr.message }, { status: 500 })
  }

  // Pega o artefato mais recente de cada tipo
  const artifacts: Record<string, { data: Record<string, unknown>; createdAt: string }> = {}
  for (const row of knowledge ?? []) {
    if (!artifacts[row.artifact_type]) {
      artifacts[row.artifact_type] = {
        data:      row.artifact_data as Record<string, unknown>,
        createdAt: row.created_at,
      }
    }
  }

  // 3. Buscar copy components
  const { data: copyRows } = await supabase
    .from('copy_components')
    .select('component_type, tag, content, rationale, register, intensity, approval_status')
    .eq('product_id', product.id)
    .order('slot_number', { ascending: true })

  const copyComponents: CopyComponent[] = (copyRows ?? []).map((r) => ({
    component_type:  r.component_type,
    tag:             r.tag,
    content:         r.content,
    rationale:       r.rationale,
    register:        r.register,
    intensity:       r.intensity,
    approval_status: r.approval_status,
  }))

  // 4. Montar estrutura do produto para o PDF
  const productData = {
    name:               product.name,
    sku:                product.sku,
    platform:           product.platform,
    ticket_price:       product.ticket_price,
    commission_percent: product.commission_percent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    niche_name:         (product as any).niches?.name ?? null,
  }

  // 5. Renderizar o PDF
  let buffer: Buffer
  try {
    const element = createElement(ProductStudyPDF, {
      product:        productData,
      sku:            sku,
      artifacts:      artifacts,
      copyComponents: copyComponents,
    }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>

    buffer = await renderToBuffer(element)
  } catch (err) {
    console.error('[PDF] Erro ao renderizar:', err)
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 })
  }

  // 6. Retornar o arquivo
  const filename = `estudo-${sku}-${new Date().toISOString().slice(0, 10)}.pdf`
  const uint8    = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(uint8.byteLength),
      'Cache-Control':       'no-store',
    },
  })
}
