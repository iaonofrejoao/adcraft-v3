'use client'
import { useState, useRef } from 'react'
import {
  MoreHorizontal, RefreshCw, Eye, XCircle, Zap, CheckCircle2,
  Clock, AlertTriangle, Users, BarChart2, Lightbulb, FileText,
  MousePointerClick, ShieldCheck, Film, BookOpen, Bot, Trash2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AGENT_ICONS } from '@/lib/constants'
import type { Task } from '@/hooks/useTasks'

const LUCIDE_MAP: Record<string, LucideIcon> = {
  Users, BarChart2, Lightbulb, Zap, FileText,
  MousePointerClick, ShieldCheck, Film, BookOpen,
}

type StepConfig = { icon: LucideIcon; className: string }

const STEP_ICONS: Record<string, StepConfig[]> = {
  pending: [
    { icon: CheckCircle2, className: 'text-on-surface-muted' },
    { icon: Clock,        className: 'text-on-surface-muted' },
    { icon: Clock,        className: 'text-on-surface-muted' },
  ],
  running: [
    { icon: CheckCircle2, className: 'text-status-done-text' },
    { icon: RefreshCw,    className: 'text-status-running-text animate-spin' },
    { icon: Clock,        className: 'text-on-surface-muted' },
  ],
  paused: [
    { icon: CheckCircle2,  className: 'text-status-done-text' },
    { icon: CheckCircle2,  className: 'text-status-done-text' },
    { icon: AlertTriangle, className: 'text-status-paused-text' },
  ],
  done: [
    { icon: CheckCircle2, className: 'text-status-done-text' },
    { icon: CheckCircle2, className: 'text-status-done-text' },
    { icon: CheckCircle2, className: 'text-status-done-text' },
  ],
  skipped: [
    { icon: CheckCircle2, className: 'text-status-done-text' },
    { icon: CheckCircle2, className: 'text-status-done-text' },
    { icon: CheckCircle2, className: 'text-status-done-text' },
  ],
  failed: [
    { icon: CheckCircle2,  className: 'text-status-done-text' },
    { icon: XCircle,       className: 'text-status-failed-text' },
    { icon: Clock,         className: 'text-on-surface-muted' },
  ],
}

const BORDER_BY_STATUS: Record<string, string> = {
  pending: 'border-l-outline-variant/50',
  running: 'border-l-status-running-text',
  paused:  'border-l-status-paused-text',
  done:    'border-l-status-done-text',
  skipped: 'border-l-status-done-text',
  failed:  'border-l-status-failed-text',
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d atrás`
  if (h > 0) return `${h}h atrás`
  return 'agora'
}

export interface TaskCardProps {
  task:      Task
  onClick?:  () => void
  onDelete?: (pipelineId: string) => void
}

export function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function requestDelete() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDelete(true)
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000)
  }

  function cancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDelete(false)
  }

  function confirmDeleteAction(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmDelete(false)
    onDelete?.(task.pipeline_id)
  }

  const iconName = AGENT_ICONS[task.agent_name.replace(/_/g, '-')]
  const IconComp = iconName ? (LUCIDE_MAP[iconName] ?? Bot) : Bot

  const title    = task.pipeline?.product?.name ?? task.agent_name.replace(/_/g, ' ')
  const sku      = task.pipeline?.product?.sku  ?? task.pipeline_id.slice(0, 8).toUpperCase()
  const badge    = (task.mode ?? task.agent_name).replace(/_/g, '_')

  const isRunning = task.status === 'running'
  const isFailed  = task.status === 'failed'
  const isPaused  = task.status === 'paused'
  const isDone    = task.status === 'done' || task.status === 'skipped'
  const isSkipped = task.status === 'skipped'

  const steps = STEP_ICONS[task.status] ?? STEP_ICONS.pending

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cn(
        'bg-surface-low p-4 rounded-xl border-l-2 shadow-sm',
        'hover:bg-surface-container transition-colors duration-150 cursor-pointer group relative',
        BORDER_BY_STATUS[task.status] ?? 'border-l-outline-variant/50',
      )}
    >
      {/* SKU + type badge */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-[10px] text-brand font-bold tracking-widest">
          {sku}
        </span>
        <div className="flex items-center gap-1.5">
          {isSkipped && (
            <span
              title="Resultado reutilizado de pesquisa anterior"
              className="bg-status-done text-status-done-text text-[9px] px-1.5 py-0.5 rounded font-bold ring-1 ring-status-done-text/30 uppercase tracking-wide"
            >
              ↻ reutilizado
            </span>
          )}
          {isPaused && (
            <span className="animate-pulse bg-status-paused text-status-paused-text text-[9px] px-1.5 py-0.5 rounded font-bold ring-1 ring-status-paused-text/40 uppercase tracking-wide">
              Urgente
            </span>
          )}
          <span className="bg-surface-high text-on-surface-variant text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
            {badge}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
        {title}
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-status-running-text animate-pulse shrink-0" />
        )}
      </h3>

      {/* Error block */}
      {isFailed && task.error && (
        <div className="bg-status-failed border border-status-failed-text/15 p-2 rounded-md mb-3 flex items-start gap-1.5">
          <AlertTriangle size={14} strokeWidth={1.5} className="text-status-failed-text shrink-0 mt-0.5" />
          <p className="text-[10px] text-status-failed-text/70 leading-tight line-clamp-2">{task.error}</p>
        </div>
      )}

      {/* Paused note */}
      {isPaused && (
        <p className="text-[11px] text-on-surface-muted mb-3 italic">
          Aguardando revisão de compliance.
        </p>
      )}

      {/* Retry info */}
      {task.retry_count > 0 && (
        <p className="text-[11px] text-status-paused-text mb-2">retry #{task.retry_count}</p>
      )}

      {/* Footer: step indicators + meta */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-1.5 items-center">
          {steps.map(({ icon: StepIcon, className }, i) => (
            <StepIcon key={i} size={15} strokeWidth={1.5} className={className} />
          ))}
        </div>
        <div className="text-right">
          {isRunning && (
            <p className="font-mono text-[11px] text-status-running-text uppercase tracking-wide">Active</p>
          )}
          {isFailed && (
            <p className="font-mono text-[11px] text-status-failed-text uppercase tracking-wide">Error</p>
          )}
          {task.status === 'pending' && (
            <p className="font-mono text-[11px] text-on-surface-variant">
              {formatRelative(task.created_at)}
            </p>
          )}
          {isDone && task.completed_at && (
            <p className="font-mono text-[11px] text-on-surface-muted">
              {formatRelative(task.completed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Confirm delete bar */}
      {confirmDelete && (
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-xl bg-status-failed border-t border-status-failed-text/20 px-3 py-2 flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] text-status-failed-text/80">Excluir demanda?</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={cancelDelete}
              className="text-[11px] text-on-surface-variant hover:text-on-surface px-2 py-0.5 rounded transition-colors duration-150"
            >
              Não
            </button>
            <button
              onClick={confirmDeleteAction}
              className="text-[11px] font-medium text-status-failed-text bg-status-failed hover:bg-status-failed-text/25 px-2 py-0.5 rounded border border-status-failed-text/30 transition-colors duration-150"
            >
              Sim, excluir
            </button>
          </div>
        </div>
      )}

      {/* Dropdown — aparece no hover */}
      <div
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
            >
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-surface-highest/80 backdrop-blur-[12px] border-outline-variant/20 text-on-surface text-[13px] shadow-ambient min-w-[160px]"
          >
            <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high focus:text-on-surface">
              <Eye size={14} strokeWidth={1.5} />
              Ver detalhes
            </DropdownMenuItem>

            {isPaused && (
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high text-status-paused-text focus:text-status-paused-text">
                <Zap size={14} strokeWidth={1.5} />
                Abrir Editor de IA
              </DropdownMenuItem>
            )}

            {isFailed && (
              <>
                <DropdownMenuSeparator className="bg-outline-variant/20" />
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high text-status-failed-text focus:text-status-failed-text">
                  <RefreshCw size={14} strokeWidth={1.5} />
                  Retentar pipeline
                </DropdownMenuItem>
              </>
            )}

            {isRunning && (
              <>
                <DropdownMenuSeparator className="bg-outline-variant/20" />
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-surface-high text-status-failed-text focus:text-status-failed-text">
                  <XCircle size={14} strokeWidth={1.5} />
                  Cancelar
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator className="bg-outline-variant/20" />
            <DropdownMenuItem
              className="gap-2 cursor-pointer focus:bg-status-failed text-on-surface-variant focus:text-status-failed-text"
              onSelect={requestDelete}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Excluir demanda
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
