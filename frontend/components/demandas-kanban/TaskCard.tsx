'use client'
import {
  MoreHorizontal, RefreshCw, Eye, XCircle, Zap, CheckCircle2,
  Clock, AlertTriangle, Users, BarChart2, Lightbulb, FileText,
  MousePointerClick, ShieldCheck, Film, BookOpen, Bot,
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

// ── Mapeamento de ícones de agentes ───────────────────────────────────────────

const LUCIDE_MAP: Record<string, LucideIcon> = {
  Users, BarChart2, Lightbulb, Zap, FileText,
  MousePointerClick, ShieldCheck, Film, BookOpen,
}

// ── Indicadores de etapa por status ──────────────────────────────────────────

type StepConfig = { icon: LucideIcon; className: string }

const STEP_ICONS: Record<string, StepConfig[]> = {
  pending: [
    { icon: CheckCircle2, className: 'text-[#6B6460]' },
    { icon: Clock,        className: 'text-[#6B6460]' },
    { icon: Clock,        className: 'text-[#6B6460]' },
  ],
  running: [
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
    { icon: RefreshCw,    className: 'text-[#60A5FA] animate-spin' },
    { icon: Clock,        className: 'text-[#6B6460]' },
  ],
  paused: [
    { icon: CheckCircle2,  className: 'text-[#4ADE80]' },
    { icon: CheckCircle2,  className: 'text-[#4ADE80]' },
    { icon: AlertTriangle, className: 'text-[#FCD34D]' },
  ],
  done: [
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
  ],
  skipped: [
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
    { icon: CheckCircle2, className: 'text-[#4ADE80]' },
  ],
  failed: [
    { icon: CheckCircle2,  className: 'text-[#4ADE80]' },
    { icon: XCircle,       className: 'text-[#F87171]' },
    { icon: Clock,         className: 'text-[#6B6460]' },
  ],
}

const BORDER_BY_STATUS: Record<string, string> = {
  pending: 'border-l-[#584237]/50',
  running: 'border-l-[#60A5FA]',
  paused:  'border-l-[#FCD34D]',
  done:    'border-l-[#4ADE80]',
  skipped: 'border-l-[#4ADE80]',
  failed:  'border-l-[#F87171]',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d atrás`
  if (h > 0) return `${h}h atrás`
  return 'agora'
}

// ── Componente ────────────────────────────────────────────────────────────────

export interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const iconName = AGENT_ICONS[task.agent_name.replace(/_/g, '-')]
  const IconComp = iconName ? (LUCIDE_MAP[iconName] ?? Bot) : Bot

  const title    = task.pipeline?.product?.name ?? task.agent_name.replace(/_/g, ' ')
  const sku      = task.pipeline?.product?.sku  ?? task.pipeline_id.slice(0, 8).toUpperCase()
  const badge    = (task.mode ?? task.agent_name).replace(/_/g, '_')

  const isRunning  = task.status === 'running'
  const isFailed   = task.status === 'failed'
  const isPaused   = task.status === 'paused'
  const isDone     = task.status === 'done' || task.status === 'skipped'
  const isSkipped  = task.status === 'skipped'

  const steps = STEP_ICONS[task.status] ?? STEP_ICONS.pending

  return (
    <div
      className={cn(
        'bg-[#1C1B1C] p-4 rounded-xl border-l-2 shadow-sm',
        'hover:bg-[#201F20] transition-colors duration-150 cursor-pointer group relative',
        BORDER_BY_STATUS[task.status] ?? 'border-l-[#584237]/50',
      )}
    >
      {/* SKU + type badge */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-[10px] text-[#F28705] font-bold tracking-widest">
          {sku}
        </span>
        <div className="flex items-center gap-1.5">
          {isSkipped && (
            <span
              title="Resultado reutilizado de pesquisa anterior"
              className="bg-[rgba(74,222,128,0.12)] text-[#4ADE80] text-[9px] px-1.5 py-0.5 rounded font-bold ring-1 ring-[#4ADE80]/30 uppercase tracking-wide"
            >
              ↻ reutilizado
            </span>
          )}
          {isPaused && (
            <span className="animate-pulse bg-[rgba(245,158,11,0.2)] text-[#FCD34D] text-[9px] px-1.5 py-0.5 rounded font-bold ring-1 ring-[#FCD34D]/40 uppercase tracking-wide">
              Urgente
            </span>
          )}
          <span className="bg-[#2A2829] text-[#9E9489] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
            {badge}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-[#E8E3DD] mb-3 flex items-center gap-2">
        {title}
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse shrink-0" />
        )}
      </h3>

      {/* Error block */}
      {isFailed && task.error && (
        <div className="bg-[rgba(239,68,68,0.08)] border border-[#F87171]/15 p-2 rounded-md mb-3 flex items-start gap-1.5">
          <AlertTriangle size={14} strokeWidth={1.5} className="text-[#F87171] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[#F87171]/70 leading-tight line-clamp-2">{task.error}</p>
        </div>
      )}

      {/* Paused note */}
      {isPaused && (
        <p className="text-[11px] text-[#6B6460] mb-3 italic">
          Aguardando revisão de compliance.
        </p>
      )}

      {/* Retry info */}
      {task.retry_count > 0 && (
        <p className="text-[11px] text-[#FCD34D] mb-2">retry #{task.retry_count}</p>
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
            <p className="font-mono text-[11px] text-[#60A5FA] uppercase tracking-wide">Active</p>
          )}
          {isFailed && (
            <p className="font-mono text-[11px] text-[#F87171] uppercase tracking-wide">Error</p>
          )}
          {task.status === 'pending' && (
            <p className="font-mono text-[11px] text-[#9E9489]">
              {formatRelative(task.created_at)}
            </p>
          )}
          {isDone && task.completed_at && (
            <p className="font-mono text-[11px] text-[#6B6460]">
              {formatRelative(task.completed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Dropdown — aparece no hover */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[#9E9489] hover:text-[#E8E3DD] hover:bg-[#2A2829]"
            >
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#353436]/80 backdrop-blur-[12px] border-[#584237]/20 text-[#E8E3DD] text-[13px] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.05)] min-w-[160px]"
          >
            <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] focus:text-[#E8E3DD]">
              <Eye size={14} strokeWidth={1.5} />
              Ver detalhes
            </DropdownMenuItem>

            {isPaused && (
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] text-[#FCD34D] focus:text-[#FCD34D]">
                <Zap size={14} strokeWidth={1.5} />
                Abrir Editor de IA
              </DropdownMenuItem>
            )}

            {(isFailed || isRunning) && (
              <DropdownMenuSeparator className="bg-[#584237]/20" />
            )}

            {isFailed && (
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] text-[#F87171] focus:text-[#F87171]">
                <RefreshCw size={14} strokeWidth={1.5} />
                Retentar pipeline
              </DropdownMenuItem>
            )}

            {isRunning && (
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-[#2A2829] text-[#F87171] focus:text-[#F87171]">
                <XCircle size={14} strokeWidth={1.5} />
                Cancelar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
