'use client'
import { useState } from 'react'
import {
  Check, X, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { CopyComponent } from '@/hooks/useCopyBoard'

/* ── Structure badge color map ───────────────────────────────────── */

const STRUCTURE_COLORS: Record<string, string> = {
  PAS:       'bg-brand-muted text-brand border-transparent',
  AIDA:      'bg-[#60A5FA]/10 text-[#60A5FA] border-transparent',
  soft:      'bg-[#60A5FA]/10 text-[#60A5FA] border-transparent',
  fear:      'bg-[#F87171]/10 text-[#F87171] border-transparent',
  Education: 'bg-[#60A5FA]/10 text-[#60A5FA] border-transparent',
  Urgência:  'bg-[#FCD34D]/10 text-[#FCD34D] border-transparent',
  Garantia:  'bg-on-surface-muted/10 text-on-surface-muted border-transparent',
}

function structureBadgeClass(value: string): string {
  return STRUCTURE_COLORS[value] ?? 'bg-surface-highest text-on-surface-muted border-transparent'
}

/* ── Compliance badge (Shadcn Badge) ─────────────────────────────── */

function ComplianceBadge({ status }: { status: string }) {
  const base = 'text-[0.5625rem] uppercase tracking-wide h-auto px-2 py-0.5 gap-1 border-transparent'

  if (status === 'approved') {
    return (
      <Badge className={cn(base, 'bg-[#4ADE80]/10 text-[#4ADE80]')}>
        <CheckCircle2 size={9} strokeWidth={2} />
        anvisa ✓
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge className={cn(base, 'bg-[#F87171]/10 text-[#F87171]')}>
        <XCircle size={9} strokeWidth={2} />
        rejeitado
      </Badge>
    )
  }
  if (status === 'warning' || status === 'revisar') {
    return (
      <Badge className={cn(base, 'bg-[#FCD34D]/10 text-[#FCD34D]')}>
        <AlertTriangle size={9} strokeWidth={2} />
        revisar
      </Badge>
    )
  }
  return (
    <Badge className={cn(base, 'bg-on-surface-muted/10 text-on-surface-muted')}>
      <Clock size={9} strokeWidth={2} />
      anvisa…
    </Badge>
  )
}

/* ── Main card ───────────────────────────────────────────────────── */

interface ComponenteCardProps {
  component:   CopyComponent
  columnLabel: string
  onApprove:   (id: string) => void
  onReject:    (id: string) => void
}

export function ComponenteCard({
  component: c, columnLabel, onApprove, onReject,
}: ComponenteCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isApproved = c.approval_status === 'approved'
  const isRejected = c.approval_status === 'rejected'

  return (
    <div className={cn(
      'bg-surface-container rounded-xl p-4 border transition-all duration-150',
      isApproved && 'border-[#4ADE80]/30',
      isRejected && 'border-[#F87171]/20 opacity-60',
      !isApproved && !isRejected && 'border-white/5',
    )}>
      {/* Top row: slot code + badges */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="font-mono text-[0.625rem] text-on-surface-muted tracking-wide">
          {c.tag}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {c.structure && (
            <Badge className={cn(
              'text-[0.5625rem] uppercase tracking-wide h-auto px-2 py-0.5 border-transparent',
              structureBadgeClass(c.structure)
            )}>
              {c.structure}
            </Badge>
          )}
          <ComplianceBadge status={c.compliance_status} />
        </div>
      </div>

      {/* Content */}
      <p className={cn(
        'text-sm leading-relaxed mb-4',
        isRejected ? 'text-on-surface-variant italic' : 'text-on-surface',
        !expanded && 'line-clamp-3',
      )}>
        {c.content ?? <span className="text-on-surface-muted">Sem conteúdo</span>}
      </p>

      {/* Rationale + metadata (expanded) */}
      {expanded && (
        <div className="space-y-2 mb-4">
          {c.rationale && (
            <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">
              <span className="font-medium text-on-surface-muted">Rationale: </span>
              {c.rationale}
            </p>
          )}
          {(c.register || c.intensity) && (
            <div className="flex flex-wrap gap-1.5">
              {c.register && (
                <Badge className="text-[0.625rem] bg-surface-highest text-on-surface-muted border-transparent h-auto px-1.5 py-0.5 font-normal">
                  <span className="font-medium text-on-surface-variant mr-1">Registro:</span>
                  {c.register}
                </Badge>
              )}
              {c.intensity && (
                <Badge className="text-[0.625rem] bg-surface-highest text-on-surface-muted border-transparent h-auto px-1.5 py-0.5 font-normal">
                  <span className="font-medium text-on-surface-variant mr-1">Intensidade:</span>
                  {c.intensity}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer: disclosure + action buttons */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-auto p-0 gap-1 text-on-surface-muted text-[0.625rem]
            hover:text-on-surface-variant hover:bg-transparent"
        >
          {expanded
            ? <ChevronUp  size={12} strokeWidth={1.5} />
            : <ChevronDown size={12} strokeWidth={1.5} />}
          Por que esse {columnLabel.toLowerCase()}?
        </Button>

        <div className="flex items-center gap-1">
          {/* Approve */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onApprove(c.id)}
            title="Aprovar"
            className={cn(
              'w-7 h-7 rounded transition-colors duration-150',
              isApproved
                ? 'bg-[#4ADE80]/20 text-[#4ADE80] hover:bg-[#4ADE80]/25'
                : 'text-on-surface-muted hover:bg-[#4ADE80]/10 hover:text-[#4ADE80]',
            )}
          >
            <Check size={14} strokeWidth={2} />
          </Button>

          {/* Reject — AlertDialog confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Rejeitar"
                className={cn(
                  'w-7 h-7 rounded transition-colors duration-150',
                  isRejected
                    ? 'bg-[#F87171]/20 text-[#F87171] hover:bg-[#F87171]/25'
                    : 'text-on-surface-muted hover:bg-[#F87171]/10 hover:text-[#F87171]',
                )}
              >
                <X size={14} strokeWidth={2} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              size="sm"
              className="bg-surface-highest border border-white/10 text-on-surface"
            >
              <AlertDialogHeader>
                <AlertDialogTitle className="text-on-surface">
                  Rejeitar componente?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-on-surface-variant">
                  Este componente será marcado como rejeitado e não entrará nas combinações.
                  Você pode reverter a ação com o botão de refresh.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-transparent text-on-surface hover:bg-surface-high">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onReject(c.id)}
                  className="bg-[#F87171]/20 text-[#F87171] hover:bg-[#F87171]/30 border-transparent"
                >
                  Rejeitar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset / gerar variação */}
          <Button
            variant="ghost"
            size="icon"
            title="Gerar variação"
            className="w-7 h-7 rounded text-on-surface-muted
              hover:bg-surface-high hover:text-on-surface-variant
              transition-colors duration-150"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  )
}
