'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface CopyComponent {
  id:                   string
  component_type:       'hook' | 'body' | 'cta'
  slot_number:          number
  tag:                  string
  content:              string | null
  rationale:            string | null
  register?:            string | null
  structure?:           string | null
  intensity?:           string | null
  compliance_status:    'pending' | 'approved' | 'rejected'
  compliance_violations?: unknown
  approval_status:      'pending' | 'approved' | 'rejected'
  approved_at:          string | null
}

export interface CopyCombination {
  id:                 string
  tag:                string
  hook_id:            string
  body_id:            string
  cta_id:             string
  full_text:          string | null
  selected_for_video: boolean
  created_at:         string
}

// ── Interface do hook ─────────────────────────────────────────────────────────

export interface UseCopyBoardReturn {
  hooks:                  CopyComponent[]
  bodies:                 CopyComponent[]
  ctas:                   CopyComponent[]
  combinations:           CopyCombination[]
  isLoading:              boolean
  isMaterializing:        boolean
  approveComponent:       (id: string) => Promise<void>
  rejectComponent:        (id: string) => Promise<void>
  resetComponent:         (id: string) => Promise<void>
  selectComponent:        (id: string, selected: boolean) => Promise<void>
  materializeCombinations: () => Promise<void>
  canMaterialize:         boolean
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCopyBoard(
  sku: string,
  pipelineId: string,
  productId: string,
): UseCopyBoardReturn {
  const [components,    setComponents]    = useState<CopyComponent[]>([])
  const [combinations,  setCombinations]  = useState<CopyCombination[]>([])
  const [isLoading,     setIsLoading]     = useState(true)
  const [isMaterializing, setIsMaterializing] = useState(false)

  // Carrega componentes + combinações
  useEffect(() => {
    Promise.all([
      fetch(`/api/copy-components?pipeline_id=${pipelineId}&product_id=${productId}`)
        .then((r) => r.json()),
      fetch(`/api/copy-combinations?pipeline_id=${pipelineId}&product_id=${productId}`)
        .then((r) => r.json())
        .catch(() => ({ combinations: [] })),
    ])
      .then(([comps, combos]) => {
        setComponents(comps.components ?? comps ?? [])
        setCombinations(combos.combinations ?? combos ?? [])
      })
      .catch((err) => console.error('[useCopyBoard] fetch failed', err))
      .finally(() => setIsLoading(false))
  }, [pipelineId, productId])

  // Realtime: escuta alterações em copy_components
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`copy_components_${pipelineId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'copy_components',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          try {
            const updated = payload.new as CopyComponent
            setComponents((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
            )
          } catch (err) {
            console.error('[useCopyBoard] realtime payload error', err)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pipelineId])

  // Approve — update otimista, reverte em erro
  const approveComponent = useCallback(async (id: string) => {
    const prev = components.find((c) => c.id === id)
    setComponents((cs) =>
      cs.map((c) => (c.id === id ? { ...c, approval_status: 'approved' } : c)),
    )
    try {
      const res = await fetch(`/api/copy-components/${id}/approve`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...updated } : c)))
      } else {
        throw new Error(`approve ${res.status}`)
      }
    } catch (err) {
      console.error('[useCopyBoard] approveComponent failed', err)
      if (prev) setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...prev } : c)))
    }
  }, [components])

  // Reset — volta para pending (desfaz aprovação)
  const resetComponent = useCallback(async (id: string) => {
    const prev = components.find((c) => c.id === id)
    setComponents((cs) =>
      cs.map((c) => (c.id === id ? { ...c, approval_status: 'pending', approved_at: null } : c)),
    )
    try {
      const res = await fetch(`/api/copy-components/${id}/reset`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...updated } : c)))
      } else {
        throw new Error(`reset ${res.status}`)
      }
    } catch (err) {
      console.error('[useCopyBoard] resetComponent failed', err)
      if (prev) setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...prev } : c)))
    }
  }, [components])

  // Reject — update otimista, reverte em erro
  const rejectComponent = useCallback(async (id: string) => {
    const prev = components.find((c) => c.id === id)
    setComponents((cs) =>
      cs.map((c) => (c.id === id ? { ...c, approval_status: 'rejected' } : c)),
    )
    try {
      const res = await fetch(`/api/copy-components/${id}/reject`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...updated } : c)))
      } else {
        throw new Error(`reject ${res.status}`)
      }
    } catch (err) {
      console.error('[useCopyBoard] rejectComponent failed', err)
      if (prev) setComponents((cs) => cs.map((c) => (c.id === id ? { ...c, ...prev } : c)))
    }
  }, [components])

  // Select para vídeo — update otimista, reverte em erro
  const selectComponent = useCallback(async (id: string, selected: boolean) => {
    const prev = combinations.find((c) => c.id === id)
    setCombinations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, selected_for_video: selected } : c)),
    )
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('copy_combinations')
        .update({ selected_for_video: selected })
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[useCopyBoard] selectComponent failed', err)
      if (prev)
        setCombinations((cs) =>
          cs.map((c) => (c.id === id ? { ...c, selected_for_video: prev.selected_for_video } : c)),
        )
    }
  }, [combinations])

  // Materializar combinações
  const materializeCombinations = useCallback(async () => {
    setIsMaterializing(true)
    try {
      const res = await fetch(`/api/products/${sku}/materialize-combinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      })
      const d = await res.json()
      if (res.ok) {
        setCombinations((prev) => [...prev, ...(d.combinations ?? [])])
        toast.success(`${d.created ?? (d.combinations?.length ?? 0)} combinações geradas`)
      } else {
        console.error('[useCopyBoard] materializeCombinations error', d)
        toast.error('Erro ao gerar combinações', { description: d.error ?? res.statusText })
      }
    } catch (err) {
      console.error('[useCopyBoard] materializeCombinations failed', err)
      toast.error('Erro de rede ao gerar combinações')
    } finally {
      setIsMaterializing(false)
    }
  }, [sku, pipelineId])

  // Derivados
  const hooks  = components.filter((c) => c.component_type === 'hook')
  const bodies = components.filter((c) => c.component_type === 'body')
  const ctas   = components.filter((c) => c.component_type === 'cta')

  const hasApproved = (list: CopyComponent[]) => list.some((c) => c.approval_status === 'approved')
  const canMaterialize =
    components.length > 0 && hasApproved(hooks) && hasApproved(bodies) && hasApproved(ctas)

  return {
    hooks,
    bodies,
    ctas,
    combinations,
    isLoading,
    isMaterializing,
    approveComponent,
    rejectComponent,
    resetComponent,
    selectComponent,
    materializeCombinations,
    canMaterialize,
  }
}
