'use client'
import { useEffect, useState } from 'react'

export interface RecentPipeline {
  id: string
  goal: string
  status: string
  cost_so_far_usd: number | null
  created_at: string
  updated_at: string
  product_id: string | null
  products?: { name: string; sku: string } | { name: string; sku: string }[] | null
}

export interface DashboardStats {
  products_total: number
  pipelines_running: number
  pipelines_completed_30d: number
  total_cost_30d_usd: number
  recent_pipelines: RecentPipeline[]
}

const EMPTY: DashboardStats = {
  products_total: 0,
  pipelines_running: 0,
  pipelines_completed_30d: 0,
  total_cost_30d_usd: 0,
  recent_pipelines: [],
}

export function useDashboard() {
  const [stats, setStats]       = useState<DashboardStats | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setStats(d as DashboardStats))
      .catch(() => setStats(EMPTY))
      .finally(() => setLoading(false))
  }, [])

  return { stats: stats ?? EMPTY, isLoading }
}

export function pipelineProductName(p: RecentPipeline): string {
  if (!p.products) return '—'
  const prod = Array.isArray(p.products) ? p.products[0] : p.products
  return prod?.name ?? '—'
}
