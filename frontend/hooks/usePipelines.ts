'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineFilters {
  status?: string[]        // ex: ['running', 'failed']
  productId?: string       // UUID do produto
  dateFrom?: string        // ISO8601
  dateTo?: string          // ISO8601
}

export interface PipelineRow {
  id:              string
  goal:            string
  status:          string
  cost_so_far_usd: string | null
  budget_usd:      string | null
  product_id:      string | null
  created_at:      string
  updated_at:      string
  completed_at:    string | null
  product?:        { name: string; sku: string }
  progress_pct:    number
  tasks_total:     number
  tasks_done:      number
}

export interface UsePipelinesReturn {
  pipelines:      PipelineRow[]
  total:          number
  isLoading:      boolean
  page:           number
  pageSize:       number
  setPage:        (p: number) => void
  setFilters:     (f: PipelineFilters) => void
  filters:        PipelineFilters
  reload:         () => void
  deletePipeline: (id: string) => Promise<void>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePipelines(
  initialPageSize = 50,
  initialFilters: PipelineFilters = {},
): UsePipelinesReturn {
  const [pipelines, setPipelines] = useState<PipelineRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page,      setPage]      = useState(0)
  const [filters,   setFilters]   = useState<PipelineFilters>(initialFilters)
  const pageSize = initialPageSize

  // Evita race conditions em fetches paralelos
  const fetchIdRef = useRef(0)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    params.set('limit',  String(pageSize))
    params.set('offset', String(page * pageSize))

    if (filters.status?.length)   params.set('status',     filters.status.join(','))
    if (filters.productId)        params.set('product_id', filters.productId)
    if (filters.dateFrom)         params.set('date_from',  filters.dateFrom)
    if (filters.dateTo)           params.set('date_to',    filters.dateTo)

    return `/api/pipelines?${params.toString()}`
  }, [page, pageSize, filters])

  const reload = useCallback(() => {
    const id = ++fetchIdRef.current
    setIsLoading(true)

    fetch(buildUrl())
      .then((r) => r.json())
      .then((d) => {
        if (id !== fetchIdRef.current) return   // resposta obsoleta
        setPipelines(d.pipelines ?? [])
        setTotal(d.total ?? 0)
      })
      .catch((err) => console.error('[usePipelines] fetch failed', err))
      .finally(() => {
        if (id === fetchIdRef.current) setIsLoading(false)
      })
  }, [buildUrl])

  // Fetch inicial + ao mudar filtros/página
  useEffect(() => {
    reload()
  }, [reload])

  // Supabase Realtime — atualiza progresso quando tasks mudam
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('pipelines_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pipelines' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PipelineRow
            setPipelines((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? { ...p, status: updated.status, cost_so_far_usd: updated.cost_so_far_usd }
                  : p
              )
            )
          } else if (payload.eventType === 'INSERT') {
            // Recarrega para obter dados enriquecidos (product, progress)
            reload()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        () => {
          // Quando tasks mudam, recarrega para atualizar progress_pct
          // Debounce: só recarrega se a página está ativa
          reload()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [reload])

  const handleSetPage = useCallback((p: number) => {
    setPage(p)
  }, [])

  const handleSetFilters = useCallback((f: PipelineFilters) => {
    setPage(0)   // volta para primeira página ao filtrar
    setFilters(f)
  }, [])

  const deletePipeline = useCallback(async (id: string) => {
    await fetch(`/api/pipelines/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'deleted' }),
    })
    // Remove otimisticamente da lista local
    setPipelines((prev) => prev.filter((p) => p.id !== id))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  return {
    pipelines,
    total,
    isLoading,
    page,
    pageSize,
    setPage:        handleSetPage,
    setFilters:     handleSetFilters,
    filters,
    reload,
    deletePipeline,
  }
}
