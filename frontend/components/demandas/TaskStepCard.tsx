'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown, ChevronRight, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, Bot, Users, BarChart2, Lightbulb,
  Zap, FileText, MousePointerClick, ShieldCheck, Film, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { RerunModal } from './RerunModal'
import { AGENT_ICONS } from '@/lib/constants'
import type { TaskDetail } from '@/hooks/usePipelineDetail'

// ── Ícones de agente ──────────────────────────────────────────────────────────

const LUCIDE_MAP: Record<string, LucideIcon> = {
  Users, BarChart2, Lightbulb, Zap, FileText,
  MousePointerClick, ShieldCheck, Film, BookOpen,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface JsonViewerProps {
  data: Record<string, unknown> | null
  label: string
}

function JsonViewer({ data, label }: JsonViewerProps) {
  const [open, setOpen] = useState(false)

  if (!data) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-on-surface-variant hover:text-on-surface transition-colors font-mono"
      >
        {open ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
        {label}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-surface rounded-md text-[10px] text-on-surface-variant font-mono overflow-x-auto max-h-64 scrollbar-thin leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Border e ícone por status ─────────────────────────────────────────────────

const BORDER_BY_STATUS: Record<string, string> = {
  pending:   'border-l-outline-variant',
  waiting:   'border-l-outline-variant',
  running:   'border-l-[#60A5FA]',
  paused:    'border-l-status-paused-text',
  completed: 'border-l-status-done-text',
  skipped:   'border-l-status-done-text',
  failed:    'border-l-status-failed-text',
}

const STATUS_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  pending:   { icon: Clock,        className: 'text-on-surface-muted' },
  waiting:   { icon: Clock,        className: 'text-on-surface-muted' },
  running:   { icon: RefreshCw,    className: 'text-[#60A5FA] animate-spin' },
  paused:    { icon: AlertTriangle,className: 'text-status-paused-text' },
  completed: { icon: CheckCircle2, className: 'text-status-done-text' },
  skipped:   { icon: CheckCircle2, className: 'text-status-done-text opacity-60' },
  failed:    { icon: XCircle,      className: 'text-status-failed-text' },
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TaskStepCardProps {
  task:        TaskDetail
  index:       number
  isLast:      boolean
  onRerun:     (taskId: string) => Promise<void>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TaskStepCard({ task, index, isLast, onRerun }: TaskStepCardProps) {
  const [expanded,    setExpanded]    = useState(false)
  const [rerunOpen,   setRerunOpen]   = useState(false)
  const [rerunLoading, setRerunLoading] = useState(false)

  const iconName  = AGENT_ICONS[task.agent_name.replace(/_/g, '-')]
  const AgentIcon = iconName ? (LUCIDE_MAP[iconName] ?? Bot) : Bot
  const statusCfg = STATUS_ICON[task.status] ?? STATUS_ICON.pending
  const StatusIcon = statusCfg.icon

  const label      = task.agent_name.replace(/_/g, ' ')
  const isRunning  = task.status === 'running'
  const isTerminal = ['completed', 'skipped', 'failed'].includes(task.status)
  const canRerun   = ['completed', 'skipped', 'failed', 'paused', 'pending', 'waiting'].includes(task.status)

  const handleRerunConfirm = async () => {
    setRerunLoading(true)
    try {
      await onRerun(task.id)
      toast.success(`Agente "${label}" re-executado`, {
        description: 'O step foi re-enfileirado para execução.',
      })
    } catch {
      toast.error('Erro ao re-executar agente', {
        description: 'Verifique os logs e tente novamente.',
      })
    } finally {
      setRerunLoading(false)
      setRerunOpen(false)
    }
  }

  return (
    <>
      {/* Linha de conexão vertical */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          {/* Número do step */}
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono font-bold border',
            task.status === 'running'
              ? 'bg-[#60A5FA]/10 border-[#60A5FA]/40 text-[#60A5FA]'
              : task.status === 'completed' || task.status === 'skipped'
              ? 'bg-status-done-bg border-status-done-text/30 text-status-done-text'
              : task.status === 'failed'
              ? 'bg-status-failed-bg border-status-failed-text/30 text-status-failed-text'
              : 'bg-surface-container-high border-outline-variant text-on-surface-muted',
          )}>
            {index + 1}
          </div>
          {/* Linha vertical até o próximo step */}
          {!isLast && (
            <div className="w-px flex-1 min-h-[16px] bg-outline-variant/40 mt-1" />
          )}
        </div>

        {/* Card */}
        <div className={cn(
          'flex-1 mb-4 rounded-xl border-l-2 bg-surface-container',
          'transition-colors duration-150',
          BORDER_BY_STATUS[task.status] ?? 'border-l-outline-variant',
        )}>
          {/* Header */}
          <button
            className="w-full text-left p-4 flex items-start gap-3 group"
            onClick={() => setExpanded((v) => !v)}
          >
            {/* Ícone do agente */}
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
              <AgentIcon size={16} strokeWidth={1.5} className="text-on-surface-variant" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[13px] text-on-surface capitalize truncate">
                  {label}
                </span>
                {task.mode && (
                  <span className="font-mono text-[9px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                    {task.mode}
                  </span>
                )}
                {task.status === 'skipped' && (
                  <span className="font-mono text-[9px] bg-status-done-bg text-status-done-text px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                    ↻ reutilizado
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={task.status} />

                {task.duration_ms !== null && (
                  <span className="font-mono text-[11px] text-on-surface-muted">
                    {formatDuration(task.duration_ms)}
                  </span>
                )}

                {isRunning && task.started_at && (
                  <span className="font-mono text-[11px] text-[#60A5FA]">
                    desde {formatTime(task.started_at)}
                  </span>
                )}

                {task.retry_count > 0 && (
                  <span className="text-[11px] text-status-paused-text">
                    retry #{task.retry_count}
                  </span>
                )}
              </div>
            </div>

            {/* Status icon + expand chevron */}
            <div className="flex items-center gap-2 shrink-0">
              <StatusIcon
                size={16}
                strokeWidth={1.5}
                className={statusCfg.className}
              />
              {expanded
                ? <ChevronDown  size={14} strokeWidth={1.5} className="text-on-surface-muted" />
                : <ChevronRight size={14} strokeWidth={1.5} className="text-on-surface-muted" />
              }
            </div>
          </button>

          {/* Corpo expandido */}
          {expanded && (
            <div className="px-4 pb-4 border-t border-outline-variant/20 pt-3 space-y-1">
              {/* Erro */}
              {task.error && (
                <div className="flex items-start gap-2 bg-status-failed-bg border border-status-failed-text/15 p-3 rounded-md mb-3">
                  <XCircle size={14} strokeWidth={1.5} className="text-status-failed-text shrink-0 mt-0.5" />
                  <p className="text-[11px] text-status-failed-text font-mono leading-relaxed">{task.error}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex gap-6 text-[11px] text-on-surface-muted font-mono mb-1">
                {task.started_at && (
                  <span>início: {formatTime(task.started_at)}</span>
                )}
                {task.completed_at && (
                  <span>fim: {formatTime(task.completed_at)}</span>
                )}
              </div>

              {/* JSON viewers */}
              <JsonViewer data={task.input_context} label="Input →" />
              <JsonViewer data={task.output}        label="Output ←" />

              {/* Botão re-executar */}
              {canRerun && (
                <div className="mt-4 pt-3 border-t border-outline-variant/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={rerunLoading}
                    onClick={() => setRerunOpen(true)}
                    className="gap-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  >
                    <RefreshCw size={13} strokeWidth={1.5} className={rerunLoading ? 'animate-spin' : ''} />
                    Re-executar este agente
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      <RerunModal
        open={rerunOpen}
        agentName={task.agent_name}
        onConfirm={handleRerunConfirm}
        onCancel={() => setRerunOpen(false)}
      />
    </>
  )
}
