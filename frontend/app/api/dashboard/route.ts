// GET /api/dashboard — estatísticas agregadas para o dashboard home
// Retorna: products_total, pipelines_running, pipelines_completed_30d,
//          total_cost_30d_usd, recent_pipelines (últimas 8)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

export async function GET() {
  try {
    const supabase = getServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      productsRes,
      runningRes,
      completedRes,
      costRes,
      recentRes,
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("inactive","archived")'),
      supabase
        .from('pipelines')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'running'),
      supabase
        .from('pipelines')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('pipelines')
        .select('cost_so_far_usd')
        .gte('created_at', thirtyDaysAgo)
        .neq('status', 'deleted'),
      supabase
        .from('pipelines')
        .select('id, goal, status, cost_so_far_usd, created_at, updated_at, product_id, products(name, sku)')
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(8),
    ])

    const totalCost = (costRes.data ?? []).reduce(
      (sum, p) => sum + (p.cost_so_far_usd ?? 0),
      0,
    )

    return NextResponse.json({
      products_total:          productsRes.count  ?? 0,
      pipelines_running:       runningRes.count   ?? 0,
      pipelines_completed_30d: completedRes.count ?? 0,
      total_cost_30d_usd:      totalCost,
      recent_pipelines:        recentRes.data     ?? [],
    })
  } catch (err) {
    console.error('[dashboard GET]', err)
    return NextResponse.json({
      products_total: 0,
      pipelines_running: 0,
      pipelines_completed_30d: 0,
      total_cost_30d_usd: 0,
      recent_pipelines: [],
    })
  }
}
