'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskDetail {
  id:            string
  agent_name:    string
  mode:          string | null
  depends_on:    string[]
  status:        string
  input_context: Record<string, unknown> | null
  output:        Record<string, unknown> | null
  error:         string | null
  retry_count:   number
  started_at:    string | null
  completed_at:  string | null
  created_at:    string
  // Campos calculados
  duration_ms:   number | null
}

export interface PipelineDetail {
  id:              string
  goal:            string
  status:          string
  cost_so_far_usd: string | null
  budget_usd:      string | null
  product_id:      string | null
  created_at:      string
  updated_at:      string
  completed_at:    string | null
  plan:            Record<string, unknown> | null
  progress_pct:    number
  tasks_done:      number
  tasks_total:     number
  tasks:           TaskDetail[]
  pending_approvals: unknown[]
  product?:        { name: string; sku: string }
}

export interface UsePipelineDetailReturn {
  pipeline:  PipelineDetail | null
  isLoading: boolean
  error:     string | null
  reload:    () => void
  rerunTask: (taskId: string) => Promise<{ ok: boolean; error?: string }>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePipelineDetail(pipelineId: string): UsePipelineDetailReturn {
  const [pipeline,  setPipeline]  = useState<PipelineDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const enrich = (data: Record<string, unknown>): PipelineDetail => {
    let tasks = (data.tasks as TaskDetail[] ?? []).map((t) => ({
      ...t,
      duration_ms:
        t.started_at && t.completed_at
          ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
          : null,
    }))

    // Sort by topological plan order (tasks are batch-inserted with same created_at,
    // so DB order is non-deterministic — plan.tasks preserves topological sequence)
    const planTasks = (data.plan as { tasks?: Array<{ agent: string }> } | null)?.tasks
    if (planTasks?.length) {
      const orderMap = new Map(planTasks.map((pt, i) => [pt.agent, i]))
      tasks = [...tasks].sort(
        (a, b) => (orderMap.get(a.agent_name) ?? 999) - (orderMap.get(b.agent_name) ?? 999)
      )
    }

    const tasks_done  = tasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length
    const tasks_total = tasks.length
    return { ...(data as unknown as PipelineDetail), tasks, tasks_done, tasks_total }
  }

  const reload = useCallback(() => {
    setIsLoading(true)
    setError(null)

    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setPipeline(enrich(d)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false))
  }, [pipelineId])

  useEffect(() => { reload() }, [reload])

  // Supabase Realtime — atualiza tasks em tempo real
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`pipeline_detail_${pipelineId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'tasks',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TaskDetail
            setPipeline((prev) => {
              if (!prev) return prev
              const tasks = prev.tasks.map((t) =>
                t.id === updated.id
                  ? {
                      ...t,
                      ...updated,
                      duration_ms:
                        updated.started_at && updated.completed_at
                          ? new Date(updated.completed_at).getTime() -
                            new Date(updated.started_at).getTime()
                          : null,
                    }
                  : t
              )
              const tasks_done  = tasks.filter(
                (t) => t.status === 'completed' || t.status === 'skipped'
              ).length
              const tasks_total = tasks.length
              const progress =
                tasks_total > 0 ? Math.round((tasks_done / tasks_total) * 100) : 0
              return { ...prev, tasks, tasks_done, tasks_total, progress_pct: progress }
            })
          } else {
            reload()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'pipelines',
          filter: `id=eq.${pipelineId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<PipelineDetail>
          setPipeline((prev) =>
            prev
              ? {
                  ...prev,
                  status:          updated.status          ?? prev.status,
                  cost_so_far_usd: updated.cost_so_far_usd ?? prev.cost_so_far_usd,
                  completed_at:    updated.completed_at    ?? prev.completed_at,
                }
              : prev
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pipelineId, reload])

  const rerunTask = useCallback(
    async (taskId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/rerun`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
        // Recarrega detalhe para refletir reset
        reload()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    [reload]
  )

  return { pipeline, isLoading, error, reload, rerunTask }
}
