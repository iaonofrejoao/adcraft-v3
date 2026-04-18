'use client'
import { useState } from 'react'
import {
  Check, X, CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CopyComponent } from '@/hooks/useCopyBoard'

/* ── Structure badge ─────────────────────────────────────────────── */

const STRUCTURE_COLORS: Record<string, string> = {
  PAS:       'bg-brand-muted text-brand border-transparent',
  AIDA:      'bg-status-running text-status-running-text border-transparent',
  soft:      'bg-status-running text-status-running-text border-transparent',
  fear:      'bg-status-failed text-status-failed-text border-transparent',
  Education: 'bg-status-running text-status-running-text border-transparent',
  Urgência:  'bg-status-paused text-status-paused-text border-transparent',
  Garantia:  'bg-on-surface-muted/10 text-on-surface-muted border-transparent',
}

function StructureBadge({ value }: { value: string }) {
  const cls = STRUCTURE_COLORS[value] ?? 'bg-surface-high text-on-surface-muted border-transparent'
  return (
    <Badge className={cn('text-[0.5625rem] uppercase tracking-wide h-auto px-2 py-0.5 border-transparent', cls)}>
      {value}
    </Badge>
  )
}

/* ── Compliance badge ────────────────────────────────────────────── */

function ComplianceBadge({ status }: { status: string }) {
  const base = 'text-[0.5625rem] uppercase tracking-wide h-auto px-2 py-0.5 gap-1 border-transparent'
  if (status === 'approved')
    return <Badge className={cn(base, 'bg-status-done text-status-done-text')}><CheckCircle2 size={9} strokeWidth={1.5} />anvisa ✓</Badge>
  if (status === 'rejected')
    return <Badge className={cn(base, 'bg-status-failed text-status-failed-text')}><XCircle size={9} strokeWidth={1.5} />rejeitado</Badge>
  if (status === 'warning' || status === 'revisar')
    return <Badge className={cn(base, 'bg-status-paused text-status-paused-text')}><AlertTriangle size={9} strokeWidth={1.5} />revisar</Badge>
  return <Badge className={cn(base, 'bg-on-surface-muted/10 text-on-surface-muted')}><Clock size={9} strokeWidth={1.5} />anvisa…</Badge>
}

/* ── Detail modal ────────────────────────────────────────────────── */

interface ComponenteModalProps {
  component:   CopyComponent
  columnLabel: string
  open:        boolean
  onClose:     () => void
  onApprove:   (id: string) => void
  onReject:    (id: string) => void
  onReset:     (id: string) => void
}

function ComponenteModal({
  component: c, columnLabel, open, onClose, onApprove, onReject, onReset,
}: ComponenteModalProps) {
  const isApproved = c.approval_status === 'approved'
  const isRejected = c.approval_status === 'rejected'

  function handleApprove() {
    isApproved ? onReset(c.id) : onApprove(c.id)
    onClose()
  }

  function handleReject() {
    if (!isRejected) onReject(c.id)
    else onReset(c.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-surface-highest/95 backdrop-blur-[12px] border border-white/10
        shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)] max-w-lg w-full p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.625rem] text-on-surface-muted tracking-wide">
              {c.tag}
            </span>
            <div className="flex items-center gap-1.5">
              {c.structure && <StructureBadge value={c.structure} />}
              <ComplianceBadge status={c.compliance_status} />
            </div>
          </div>
          <DialogTitle className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-muted/50 mt-1">
            {columnLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Copy text */}
          <p className={cn(
            'text-[0.9375rem] leading-relaxed break-words',
            isRejected ? 'text-on-surface-variant italic opacity-70' : 'text-on-surface',
          )}>
            {c.content ?? <span className="text-on-surface-muted">Sem conteúdo</span>}
          </p>

          {/* Rationale */}
          {c.rationale && (
            <div className="bg-surface-high/60 rounded-lg px-4 py-3 border border-white/5">
              <p className="text-[0.6875rem] font-semibold text-on-surface-muted uppercase tracking-wider mb-1">
                Raciocínio
              </p>
              <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">
                {c.rationale}
              </p>
            </div>
          )}

          {/* Metadata */}
          {(c.register || c.intensity) && (
            <div className="flex flex-wrap gap-2">
              {c.register && (
                <div className="flex items-center gap-1.5 text-xs bg-surface-high px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-on-surface-muted">Registro:</span>
                  <span className="text-on-surface font-medium">{c.register}</span>
                </div>
              )}
              {c.intensity && (
                <div className="flex items-center gap-1.5 text-xs bg-surface-high px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-on-surface-muted">Intensidade:</span>
                  <span className="text-on-surface font-medium">{c.intensity}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-white/5 bg-surface-highest/40">
          <Button
            variant="ghost"
            onClick={handleReject}
            className={cn(
              'flex-1 gap-2 transition-colors duration-150',
              isRejected
                ? 'bg-status-failed/20 text-status-failed-text border border-status-failed-text/20 hover:bg-status-failed/30'
                : 'text-on-surface-variant border border-white/10 hover:bg-status-failed/15 hover:text-status-failed-text hover:border-status-failed-text/20',
            )}
          >
            <X size={14} strokeWidth={1.5} />
            {isRejected ? 'Remover rejeição' : 'Recusar'}
          </Button>

          <Button
            onClick={handleApprove}
            className={cn(
              'flex-1 gap-2 transition-colors duration-150',
              isApproved
                ? 'bg-status-done/20 text-status-done-text border border-status-done-text/20 hover:bg-status-done/30'
                : 'bg-brand-gradient text-on-primary hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]',
            )}
          >
            <Check size={14} strokeWidth={1.5} />
            {isApproved ? 'Remover aprovação' : 'Autorizar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Compact card ────────────────────────────────────────────────── */

interface ComponenteCardProps {
  component:   CopyComponent
  columnLabel: string
  onApprove:   (id: string) => void
  onReject:    (id: string) => void
  onReset:     (id: string) => void
}

export function ComponenteCard({
  component: c, columnLabel, onApprove, onReject, onReset,
}: ComponenteCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const isApproved = c.approval_status === 'approved'
  const isRejected = c.approval_status === 'rejected'

  return (
    <>
      <div className={cn(
        'bg-surface-container rounded-xl border transition-all duration-150 overflow-hidden',
        isApproved && 'border-status-done-text/25 bg-status-done/5',
        isRejected && 'border-status-failed-text/15 opacity-50',
        !isApproved && !isRejected && 'border-white/5 hover:border-white/10',
      )}>
        {/* Clickable content area → opens modal */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full text-left px-3 pt-3 pb-2 group"
        >
          {/* Top row: tag + badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-mono text-[0.5625rem] text-on-surface-muted/60 tracking-wide truncate">
              {c.tag}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {c.structure && <StructureBadge value={c.structure} />}
              <ComplianceBadge status={c.compliance_status} />
            </div>
          </div>

          {/* Content preview */}
          <p className={cn(
            'text-[0.8125rem] leading-relaxed line-clamp-2 group-hover:text-on-surface transition-colors duration-150',
            isRejected ? 'text-on-surface-variant italic' : 'text-on-surface-variant',
          )}>
            {c.content ?? <span className="text-on-surface-muted">Sem conteúdo</span>}
          </p>

          <p className="text-[0.5625rem] text-on-surface-muted/40 mt-1.5 group-hover:text-brand/50 transition-colors duration-150">
            clique para ver completo
          </p>
        </button>

        {/* Footer: inline quick actions */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
          {isApproved && (
            <span className="text-[0.5625rem] text-status-done-text font-mono flex items-center gap-1">
              <Check size={9} strokeWidth={2} /> autorizado
            </span>
          )}
          {isRejected && (
            <span className="text-[0.5625rem] text-status-failed-text font-mono flex items-center gap-1">
              <X size={9} strokeWidth={2} /> recusado
            </span>
          )}
          {!isApproved && !isRejected && <span />}

          <div className="flex items-center gap-1 ml-auto">
            {/* Quick approve / unapprove */}
            <button
              onClick={(e) => { e.stopPropagation(); isApproved ? onReset(c.id) : onApprove(c.id) }}
              title={isApproved ? 'Remover aprovação' : 'Autorizar'}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center transition-colors duration-150',
                isApproved
                  ? 'bg-status-done text-status-done-text hover:bg-status-done/60'
                  : 'text-on-surface-muted hover:bg-status-done/20 hover:text-status-done-text',
              )}
            >
              <Check size={11} strokeWidth={2} />
            </button>

            {/* Quick reject / unreject */}
            <button
              onClick={(e) => { e.stopPropagation(); isRejected ? onReset(c.id) : onReject(c.id) }}
              title={isRejected ? 'Remover rejeição' : 'Recusar'}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center transition-colors duration-150',
                isRejected
                  ? 'bg-status-failed text-status-failed-text hover:bg-status-failed/60'
                  : 'text-on-surface-muted hover:bg-status-failed/20 hover:text-status-failed-text',
              )}
            >
              <X size={11} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <ComponenteModal
        component={c}
        columnLabel={columnLabel}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onApprove={onApprove}
        onReject={onReject}
        onReset={onReset}
      />
    </>
  )
}
