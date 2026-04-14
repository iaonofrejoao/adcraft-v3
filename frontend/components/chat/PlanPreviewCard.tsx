'use client'
import { useEffect, useRef, useState } from 'react'
import type { PipelinePlan } from '@/lib/jarvis/planner'
import type { PlannedTask } from '@/lib/jarvis/dag-builder'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Lazy-load mermaid — original logic preserved
let mermaidReady = false
async function getMermaid() {
  if (typeof window === 'undefined') return null
  const m = (await import('mermaid')).default
  if (!mermaidReady) {
    m.initialize({
      startOnLoad: false,
      theme:       'base',
      themeVariables: {
        primaryColor:     '#6D5BD0',
        primaryTextColor: '#fff',
        lineColor:        '#A09DB8',
        background:       '#FFFFFF',
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
  const diagramRef               = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [approved,   setApproved]   = useState(false)

  // Renderiza Mermaid — lógica original preservada
  useEffect(() => {
    let cancelled = false
    getMermaid().then((m) => {
      if (!m || cancelled || !plan.mermaid) return
      const id = `mermaid-${pipelineId.slice(0, 8)}`
      m.render(id, plan.mermaid)
        .then(({ svg }) => { if (!cancelled) setSvgContent(svg) })
        .catch(() => {})
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
    <div className="bg-surface-container border border-outline-variant/15 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-on-surface">
            Plano: {plan.goal}
          </span>
          <span className="ml-2 text-xs text-on-surface-variant">
            {newTasks.length} novas · {reusedTasks.length} reutilizadas ·{' '}
            est. ${plan.estimated_cost_usd.toFixed(4)}
          </span>
        </div>
        <span className="bg-brand-muted text-brand font-mono text-[0.6875rem] px-2 py-0.5 rounded">
          budget: ${plan.budget_usd.toFixed(2)}
        </span>
      </div>

      <div className="h-px bg-outline-variant/15" />

      {/* Mermaid diagram */}
      <div ref={diagramRef} className="px-4 py-3">
        <div className="bg-surface rounded-lg p-3 overflow-x-auto">
          {svgContent
            ? <div dangerouslySetInnerHTML={{ __html: svgContent }} className="mermaid-diagram" />
            : (
              <div className="flex items-center gap-2 text-sm text-on-surface-muted">
                <span className="animate-spin">⏳</span>
                Renderizando diagrama…
              </div>
            )}
        </div>
      </div>

      {/* Task list */}
      <div className="px-4 pb-3 space-y-1.5">
        {plan.tasks.map((task: PlannedTask, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              task.status === 'reused' ? 'bg-[#4ADE80]' : 'bg-[#60A5FA]',
            )} />
            <span className="text-on-surface">{task.agent}</span>
            <span className={cn(
              'ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
              'text-[0.6875rem] font-mono font-medium',
              task.status === 'reused'
                ? 'bg-[rgba(34,197,94,0.15)] text-[#4ADE80]'
                : 'bg-[rgba(59,130,246,0.15)] text-[#60A5FA]',
            )}>
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>
        ))}
      </div>

      {/* Checkpoints */}
      {plan.checkpoints.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[0.6875rem] text-on-surface-variant uppercase tracking-[0.05em] mb-1">
            Checkpoints de aprovação:
          </p>
          {plan.checkpoints.map((cp, i) => (
            <p key={i} className="text-sm text-on-surface flex items-center gap-2">
              • Após <strong>{cp.after_agent}</strong>: {cp.description}
            </p>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="px-4 pb-4 flex gap-2">
        <Button
          onClick={handleApprove}
          disabled={approved}
          className="flex-1 bg-gradient-to-br from-[#F28705] to-[#FFB690] text-[#131314]
            font-medium hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
            transition-shadow duration-150 disabled:opacity-50"
        >
          {approved ? 'Aprovado ✓' : 'Aprovar e executar'}
        </Button>
        <Button
          variant="outline"
          disabled={approved}
          className="border-outline-variant/20 bg-transparent text-on-surface
            hover:bg-surface-high transition-colors duration-150 disabled:opacity-50"
          onClick={() => {/* Cancelar — usuário digita resposta alternativa */}}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
