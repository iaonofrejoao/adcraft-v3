'use client'
import { Lock, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CopyComponent } from '@/hooks/useCopyBoard'

interface AprovacaoProgressBarProps {
  hooks:           CopyComponent[]
  bodies:          CopyComponent[]
  ctas:            CopyComponent[]
  canMaterialize:  boolean
  isMaterializing: boolean
  hasCombinations: boolean
  onMaterialize:   () => void
}

interface ColStat { label: string; approved: number; total: number }

function countApproved(items: CopyComponent[]) {
  return items.filter((c) => c.approval_status === 'approved').length
}

export function AprovacaoProgressBar({
  hooks, bodies, ctas, canMaterialize, isMaterializing, hasCombinations, onMaterialize,
}: AprovacaoProgressBarProps) {
  const stats: ColStat[] = [
    { label: 'Hooks',  approved: countApproved(hooks),  total: hooks.length  },
    { label: 'Bodies', approved: countApproved(bodies), total: bodies.length },
    { label: 'CTAs',   approved: countApproved(ctas),   total: ctas.length   },
  ]

  const totalItems = hooks.length + bodies.length + ctas.length

  const hooksWidth  = totalItems > 0 ? (hooks.length  / totalItems) * 100 : 33.33
  const bodiesWidth = totalItems > 0 ? (bodies.length / totalItems) * 100 : 33.33
  const ctasWidth   = totalItems > 0 ? (ctas.length   / totalItems) * 100 : 33.33

  const hooksApprovedPct  = hooks.length  > 0 ? countApproved(hooks)  / hooks.length  : 0
  const bodiesApprovedPct = bodies.length > 0 ? countApproved(bodies) / bodies.length : 0
  const ctasApprovedPct   = ctas.length   > 0 ? countApproved(ctas)   / ctas.length   : 0

  const isDisabled = !canMaterialize || isMaterializing || hasCombinations

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      {/* Progress panel */}
      <div className="bg-surface-low border border-white/5 rounded-xl p-4 min-w-[280px]">
        <div className="flex items-center gap-5 text-[0.6875rem] text-on-surface-muted mb-3">
          {stats.map(({ label, approved, total }) => {
            const ok = approved > 0
            return (
              <span key={label}>
                {label}{' '}
                <span className={cn('font-mono', ok ? 'text-brand' : 'text-status-failed-text')}>
                  {approved}/{total}{ok ? ' ✓' : ''}
                </span>
              </span>
            )
          })}
        </div>

        {/* Segmented bar — dynamic widths require inline style */}
        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-surface-high">
          <div className="h-full relative overflow-hidden" style={{ width: `${hooksWidth}%` }}>
            <div
              className="h-full bg-brand transition-all duration-500"
              style={{ width: `${hooksApprovedPct * 100}%` }}
            />
          </div>
          <div className="h-full relative overflow-hidden" style={{ width: `${bodiesWidth}%` }}>
            <div
              className="h-full bg-brand/60 transition-all duration-500"
              style={{ width: `${bodiesApprovedPct * 100}%` }}
            />
          </div>
          <div className="h-full relative overflow-hidden" style={{ width: `${ctasWidth}%` }}>
            <div
              className="h-full bg-brand/30 transition-all duration-500"
              style={{ width: `${ctasApprovedPct * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gerar combinações — Tooltip wraps the disabled button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper so Tooltip works even when Button is disabled */}
            <span className="shrink-0 inline-flex">
              <Button
                onClick={onMaterialize}
                disabled={isDisabled}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all duration-150',
                  canMaterialize && !hasCombinations
                    ? 'text-on-primary bg-brand-gradient' +
                      ' hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] active:scale-[0.98]'
                    : 'bg-surface-container text-on-surface-muted opacity-50 cursor-not-allowed',
                )}
              >
                {isMaterializing ? (
                  <>
                    <Layers size={16} strokeWidth={1.5} className="animate-pulse" />
                    Criando…
                  </>
                ) : hasCombinations ? (
                  <>
                    <Layers size={16} strokeWidth={1.5} />
                    Combinações criadas ✓
                  </>
                ) : (
                  <>
                    Gerar combinações
                    {!canMaterialize && <Lock size={14} strokeWidth={1.5} />}
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          {!canMaterialize && !hasCombinations && (
            <TooltipContent
              side="top"
              className="bg-surface-highest border border-white/10 text-on-surface text-[0.625rem] px-2.5 py-1.5"
            >
              Aprove ao menos 1 de cada coluna
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
