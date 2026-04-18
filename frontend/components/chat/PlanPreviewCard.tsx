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

const PIPELINE_STATUS_CONFIG: Record<string, { label: string; textClass: string; bgClass: string }> = {
  pending:   { label: 'Aguardando execução', textClass: 'text-on-surface-muted',      bgClass: 'bg-surface-high' },
  running:   { label: 'Em execução',         textClass: 'text-status-running-text',   bgClass: 'bg-status-running' },
  completed: { label: 'Concluído',           textClass: 'text-status-done-text',      bgClass: 'bg-status-done' },
  failed:    { label: 'Falhou',              textClass: 'text-status-failed-text',    bgClass: 'bg-status-failed' },
  cancelled: { label: 'Cancelado',           textClass: 'text-on-surface-muted',      bgClass: 'bg-surface-high' },
}

function PipelineStatusBadge({ status }: { status: string }) {
  const cfg = PIPELINE_STATUS_CONFIG[status] ?? PIPELINE_STATUS_CONFIG.pending
  return (
    <span className={cn(
      'flex-1 text-center text-sm font-medium py-2 px-4 rounded-lg',
      cfg.bgClass,
      cfg.textClass,
    )}>
      {cfg.label}
    </span>
  )
}

interface PlanPreviewCardProps {
  plan:            PipelinePlan
  pipelineId:      string
  pipelineStatus?: string
  onApprove:       (pipelineId: string) => void
}

export function PlanPreviewCard({ plan, pipelineId, pipelineStatus, onApprove }: PlanPreviewCardProps) {
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
          {(plan.product_sku || plan.product_name) && (
            <div className="mb-1 flex items-center gap-2">
              {plan.product_sku && (
                <span className="font-mono text-sm text-brand">{plan.product_sku}</span>
              )}
              {plan.product_name && (
                <span className="text-sm text-on-surface">{plan.product_name}</span>
              )}
            </div>
          )}
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
              task.status === 'reused' ? 'bg-status-done-text' : 'bg-status-running-text',
            )} />
            <span className="text-on-surface">{task.agent}</span>
            <span className={cn(
              'ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
              'text-[0.6875rem] font-mono font-medium',
              task.status === 'reused'
                ? 'bg-status-done text-status-done-text'
                : 'bg-status-running text-status-running-text',
            )}>
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>
        ))}
      </div>

      {/* Checkpoints */}
      {plan.checkpoints.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
            Checkpoints de aprovação
          </h4>
          <ul className="space-y-1">
            {plan.checkpoints.map((cp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-brand mt-0.5 shrink-0">✓</span>
                <span>
                  <span className="text-on-surface-variant">Após </span>
                  <span className="font-mono text-on-surface">{cp.after_agent}</span>
                  <span className="text-on-surface-variant">: </span>
                  <span className="text-on-surface">{cp.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ações */}
      <div className="px-4 pb-4 flex gap-2">
        {(!pipelineStatus || pipelineStatus === 'plan_preview') ? (
          <>
            <Button
              onClick={handleApprove}
              disabled={approved}
              className="flex-1 bg-brand-gradient text-on-primary
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
          </>
        ) : (
          <PipelineStatusBadge status={pipelineStatus} />
        )}
      </div>
    </div>
  )
}
