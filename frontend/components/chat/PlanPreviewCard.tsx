'use client'
import { useEffect, useRef, useState } from 'react'
import type { PipelinePlan } from '@/lib/jarvis/planner'
import type { PlannedTask } from '@/lib/jarvis/dag-builder'

// Lazy-load mermaid para evitar SSR e peso no bundle principal
let mermaidReady = false
async function getMermaid() {
  if (typeof window === 'undefined') return null
  const m = (await import('mermaid')).default
  if (!mermaidReady) {
    m.initialize({
      startOnLoad: false,
      theme:       'base',
      themeVariables: {
        primaryColor:   '#6D5BD0',
        primaryTextColor: '#fff',
        lineColor:      '#A09DB8',
        background:     '#FFFFFF',
      },
    })
    mermaidReady = true
  }
  return m
}

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Nova',
  reused:  'Reutilizada ✓',
}

interface PlanPreviewCardProps {
  plan:       PipelinePlan
  pipelineId: string
  onApprove:  (pipelineId: string) => void
}

export function PlanPreviewCard({ plan, pipelineId, onApprove }: PlanPreviewCardProps) {
  const diagramRef  = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [approved, setApproved]     = useState(false)

  // Renderiza o Mermaid quando o componente monta
  useEffect(() => {
    let cancelled = false
    getMermaid().then((m) => {
      if (!m || cancelled || !plan.mermaid) return
      const id = `mermaid-${pipelineId.slice(0, 8)}`
      m.render(id, plan.mermaid).then(({ svg }) => {
        if (!cancelled) setSvgContent(svg)
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [plan.mermaid, pipelineId])

  const newTasks    = plan.tasks.filter((t: PlannedTask) => t.status === 'pending')
  const reusedTasks = plan.tasks.filter((t: PlannedTask) => t.status === 'reused')

  const handleApprove = () => {
    setApproved(true)
    onApprove(pipelineId)
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-default)', background: 'var(--brand-subtle)' }}>
        <div>
          <span className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
            Plano: {plan.goal}
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {newTasks.length} novas · {reusedTasks.length} reutilizadas · est. ${plan.estimated_cost_usd.toFixed(4)}
          </span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full"
          style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}>
          budget: ${plan.budget_usd.toFixed(2)}
        </span>
      </div>

      {/* Diagrama Mermaid */}
      <div ref={diagramRef} className="px-4 py-3 overflow-x-auto">
        {svgContent
          ? <div dangerouslySetInnerHTML={{ __html: svgContent }} className="mermaid-diagram" />
          : <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="animate-spin">⏳</span> Renderizando diagrama…
            </div>
        }
      </div>

      {/* Task list */}
      <div className="px-4 pb-3 space-y-1.5">
        {plan.tasks.map((task: PlannedTask, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: task.status === 'reused' ? '#16A34A' : 'var(--brand-primary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>{task.agent}</span>
            <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>
        ))}
      </div>

      {/* Checkpoints */}
      {plan.checkpoints.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Checkpoints de aprovação:
          </p>
          {plan.checkpoints.map((cp, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              • Após <strong>{cp.after_agent}</strong>: {cp.description}
            </p>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={approved}
          className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}
        >
          {approved ? 'Aprovado ✓' : 'Aprovar e executar'}
        </button>
        <button
          className="px-4 py-2 rounded-lg text-sm border transition-colors hover:opacity-70"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          disabled={approved}
          onClick={() => {/* Cancelar — usuário digita resposta alternativa */}}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
