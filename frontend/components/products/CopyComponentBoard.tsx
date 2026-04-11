'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Toggle } from '@/components/ui/Toggle'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CopyComponent {
  id:                  string
  component_type:      'hook' | 'body' | 'cta'
  slot_number:         number
  tag:                 string
  content:             string | null
  rationale:           string | null
  register?:           string | null
  structure?:          string | null
  intensity?:          string | null
  compliance_status:   'pending' | 'approved' | 'rejected'
  compliance_violations?: unknown
  approval_status:     'pending' | 'approved' | 'rejected'
  approved_at:         string | null
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

// ── Componente principal ───────────────────────────────────────────────────────

interface CopyComponentBoardProps {
  sku:        string
  pipelineId: string
  productId:  string
}

type ColType = 'hook' | 'body' | 'cta'
const COLS: { type: ColType; label: string; icon: string }[] = [
  { type: 'hook', label: 'Hooks',  icon: '🪝' },
  { type: 'body', label: 'Bodies', icon: '📝' },
  { type: 'cta',  label: 'CTAs',   icon: '👆' },
]

export function CopyComponentBoard({ sku, pipelineId, productId }: CopyComponentBoardProps) {
  const [components,    setComponents]    = useState<CopyComponent[]>([])
  const [combinations,  setCombinations]  = useState<CopyCombination[]>([])
  const [loading,       setLoading]       = useState(true)
  const [materializing, setMaterializing] = useState(false)

  // Carrega componentes + combinações
  useEffect(() => {
    Promise.all([
      fetch(`/api/copy-components?pipeline_id=${pipelineId}&product_id=${productId}`)
        .then((r) => r.json()),
      fetch(`/api/copy-combinations?pipeline_id=${pipelineId}&product_id=${productId}`)
        .then((r) => r.json()).catch(() => ({ combinations: [] })),
    ]).then(([comps, combos]) => {
      setComponents(comps.components ?? comps ?? [])
      setCombinations(combos.combinations ?? combos ?? [])
    }).finally(() => setLoading(false))
  }, [pipelineId, productId])

  // Realtime: escuta alterações em copy_components
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`copy_components_${pipelineId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'copy_components', filter: `pipeline_id=eq.${pipelineId}` },
        (payload) => {
          const updated = payload.new as CopyComponent
          setComponents((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pipelineId])

  async function handleApprove(id: string) {
    const res = await fetch(`/api/copy-components/${id}/approve`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setComponents((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c))
    }
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/copy-components/${id}/reject`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setComponents((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c))
    }
  }

  async function materializeCombinations() {
    setMaterializing(true)
    try {
      const res = await fetch(`/api/products/${sku}/materialize-combinations`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pipeline_id: pipelineId }),
      })
      if (res.ok) {
        const d = await res.json()
        setCombinations((prev) => [...prev, ...(d.combinations ?? [])])
      }
    } finally {
      setMaterializing(false)
    }
  }

  async function toggleSelectForVideo(comboId: string, selected: boolean) {
    // Atualiza localmente imediatamente
    setCombinations((prev) => prev.map((c) => c.id === comboId ? { ...c, selected_for_video: selected } : c))
    // Persiste
    const supabase = createClient()
    await supabase.from('copy_combinations').update({ selected_for_video: selected }).eq('id', comboId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando componentes…
        </span>
      </div>
    )
  }

  const allApproved = (type: ColType) =>
    components.filter((c) => c.component_type === type).every((c) => c.approval_status === 'approved')

  const canMaterialize = allApproved('hook') && allApproved('body') && allApproved('cta')
    && components.length > 0

  return (
    <div className="space-y-6">
      {/* 3 colunas de componentes */}
      <div className="grid grid-cols-3 gap-4">
        {COLS.map(({ type, label, icon }) => {
          const items = components.filter((c) => c.component_type === type)
          const approvedCount = items.filter((c) => c.approval_status === 'approved').length
          return (
            <div key={type}>
              {/* Header da coluna */}
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {icon} {label}
                </h3>
                <span className="text-xs" style={{ color: allApproved(type) ? 'var(--status-success)' : 'var(--text-muted)' }}>
                  {approvedCount}/{items.length} aprovados
                </span>
              </div>

              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-xl border p-4 text-xs text-center"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                    Nenhum componente gerado
                  </div>
                ) : (
                  items.map((comp) => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ação: materializar combinações */}
      {canMaterialize && combinations.length === 0 && (
        <div className="flex items-center justify-between rounded-xl border px-5 py-4"
          style={{ background: 'var(--brand-subtle)', borderColor: 'var(--brand-primary)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>
              Todos os componentes aprovados ✓
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Crie todas as combinações N×M×K para seleção e geração de vídeo.
            </p>
          </div>
          <button
            onClick={materializeCombinations}
            disabled={materializing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}>
            {materializing ? 'Criando…' : 'Materializar combinações'}
          </button>
        </div>
      )}

      {/* Lista de combinações */}
      {combinations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Combinações ({combinations.length})
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {combinations.filter((c) => c.selected_for_video).length} selecionadas para vídeo
            </p>
          </div>
          <div className="space-y-2">
            {combinations.map((combo) => (
              <CombinationRow
                key={combo.id}
                combination={combo}
                onToggleVideo={(selected) => toggleSelectForVideo(combo.id, selected)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ComponentCard ─────────────────────────────────────────────────────────────

function ComponentCard({
  component: c,
  onApprove,
  onReject,
}: {
  component:  CopyComponent
  onApprove:  (id: string) => void
  onReject:   (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isApproved  = c.approval_status === 'approved'
  const isRejected  = c.approval_status === 'rejected'
  const isPending   = c.approval_status === 'pending'
  const compliance  = c.compliance_status

  return (
    <div className="rounded-xl border overflow-hidden transition-all"
      style={{
        background:   'var(--surface-card)',
        borderColor:  isApproved ? 'var(--status-success)' : isRejected ? 'var(--status-error)' : 'var(--border-default)',
      }}>
      {/* Tag + badges */}
      <div className="px-3 py-2 flex items-center gap-2 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
          {c.tag}
        </span>
        <ComplianceBadge status={compliance} />
        <ApprovalBadge status={c.approval_status} />
        <button onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-xs hover:opacity-60" style={{ color: 'var(--text-muted)' }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Conteúdo */}
      <div className={`px-3 py-2.5 text-sm ${!expanded ? 'line-clamp-3' : ''}`}
        style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {c.content ?? <span style={{ color: 'var(--text-muted)' }}>Sem conteúdo</span>}
      </div>

      {/* Rationale (expandido) */}
      {expanded && c.rationale && (
        <div className="px-3 pb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <strong>Rationale:</strong> {c.rationale}
        </div>
      )}

      {/* Metadados */}
      {expanded && (c.register || c.structure || c.intensity) && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {c.register   && <Tag label="Registro"    value={c.register} />}
          {c.structure  && <Tag label="Estrutura"   value={c.structure} />}
          {c.intensity  && <Tag label="Intensidade" value={c.intensity} />}
        </div>
      )}

      {/* Ações */}
      {isPending && (
        <div className="px-3 pb-3 flex gap-2">
          <button onClick={() => onApprove(c.id)}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-80"
            style={{ background: 'var(--status-success)' }}>
            Aprovar
          </button>
          <button onClick={() => onReject(c.id)}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all hover:opacity-70"
            style={{ borderColor: 'var(--status-error)', color: 'var(--status-error)' }}>
            Rejeitar
          </button>
        </div>
      )}
      {isApproved && (
        <p className="px-3 pb-3 text-xs font-medium" style={{ color: 'var(--status-success)' }}>✓ Aprovado</p>
      )}
      {isRejected && (
        <div className="px-3 pb-3 flex gap-2">
          <p className="text-xs font-medium flex-1" style={{ color: 'var(--status-error)' }}>✗ Rejeitado</p>
          <button onClick={() => onApprove(c.id)}
            className="text-xs px-2 py-1 rounded border hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            Aprovar mesmo assim
          </button>
        </div>
      )}
    </div>
  )
}

function ComplianceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: 'ANVISA ✓', color: 'var(--status-success)' },
    rejected: { label: 'ANVISA ✗', color: 'var(--status-error)' },
    pending:  { label: 'ANVISA…',  color: 'var(--text-muted)' },
  }
  const cfg = map[status] ?? map.pending
  return (
    <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
  )
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: 'Aprovado', bg: '#F0FDF4', color: 'var(--status-success)' },
    rejected: { label: 'Rejeitado', bg: '#FEF2F2', color: 'var(--status-error)' },
    pending:  { label: 'Pendente',  bg: 'var(--surface-page)', color: 'var(--text-muted)' },
  }
  const cfg = map[status] ?? map.pending
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: 'var(--surface-page)', color: 'var(--text-secondary)' }}>
      <strong>{label}:</strong> {value}
    </span>
  )
}

// ── CombinationRow ─────────────────────────────────────────────────────────────

function CombinationRow({
  combination: c,
  onToggleVideo,
}: {
  combination:    CopyCombination
  onToggleVideo:  (selected: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border px-4 py-3"
      style={{
        background:  'var(--surface-card)',
        borderColor: c.selected_for_video ? 'var(--brand-primary)' : 'var(--border-default)',
      }}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono" style={{ color: 'var(--brand-primary)' }}>{c.tag}</span>
        <button onClick={() => setExpanded((v) => !v)}
          className="text-xs hover:opacity-60" style={{ color: 'var(--text-muted)' }}>
          {expanded ? 'ocultar' : 'ver texto'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Gerar vídeo</span>
          <Toggle
            checked={c.selected_for_video}
            onChange={onToggleVideo}
            size="sm"
          />
        </div>
      </div>
      {expanded && c.full_text && (
        <div className="mt-2 text-xs whitespace-pre-wrap border-t pt-2"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {c.full_text}
        </div>
      )}
    </div>
  )
}
