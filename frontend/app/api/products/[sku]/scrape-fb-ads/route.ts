// POST /api/products/[sku]/scrape-fb-ads
// Dispara scripts/video/scrape-fb-ads.ts para coletar anúncios do Facebook Ads Library via Apify.
//
// Body: { query: string, country?: string, max?: number }
// Response: { ok: true, count: number } | { error: string }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import * as path from 'path'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function POST(
  req: Request,
  { params }: { params: { sku: string } }
) {
  try {
    const body    = await req.json()
    const query   = (body.query as string | undefined)?.trim()
    const country = (body.country as string | undefined)?.trim() ?? 'US'
    const max     = Math.min(parseInt(body.max ?? '10', 10), 30)

    if (!query) return NextResponse.json({ error: 'query é obrigatório' }, { status: 400 })

    const supabase = getServiceClient()
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', params.sku)
      .maybeSingle()

    if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 })
    if (!product)   return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const productId   = (product as { id: string }).id
    const projectRoot = path.join(process.cwd(), '..')
    const scriptPath  = path.join(projectRoot, 'scripts', 'video', 'scrape-fb-ads.ts')

    const result = await runScript(projectRoot, scriptPath, productId, query, country, max)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function runScript(
  cwd: string,
  scriptPath: string,
  productId: string,
  query: string,
  country: string,
  max: number,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['tsx', scriptPath, '--product-id', productId, '--query', query, '--country', country, '--max', String(max)],
      {
        cwd,
        env: { ...process.env },
        shell: process.platform === 'win32',
      }
    )

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill()
      resolve({ ok: false, error: 'Timeout: scraping demorou mais de 5 minutos' })
    }, 300_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        const msg = stderr.split('\n').find(l => l.includes('ERRO') || l.includes('error')) ?? (stderr || stdout)
        resolve({ ok: false, error: msg.trim() || 'Script falhou' })
        return
      }
      const match = stdout.match(/(\d+) anúncios salvos/)
      resolve({ ok: true, count: match ? parseInt(match[1]) : 0 })
    })
  })
}
