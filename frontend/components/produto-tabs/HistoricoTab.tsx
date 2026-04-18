'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  FileText, Search, Layers, Film, Download,
  CheckCircle2, XCircle, Clock, Pause,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Pipeline } from '@/components/detalhes-produto'

/* ── Goal icon map ──────────────────────────────────────────────────── */
interface GoalCfg { Icon: LucideIcon; color: string; bg: string; label: string }

const GOAL_MAP: Record<string, GoalCfg> = {
  copy_only:        { Icon: FileText, color: 'text-brand',          bg: 'bg-brand-muted',          label: 'Copy' },
  creative_full:    { Icon: FileText, color: 'text-brand',          bg: 'bg-brand-muted',          label: 'Creative Full' },
  market_research:  { Icon: Search,   color: 'text-agent-market',    bg: 'bg-agent-market/10',      label: 'Mercado' },
  avatar_research:  { Icon: Search,   color: 'text-agent-research',  bg: 'bg-brand-muted',          label: 'Avatar' },
  angle_generation: { Icon: Layers,   color: 'text-agent-strategy',  bg: 'bg-agent-strategy/10',    label: 'Ângulos' },
  video_prod:       { Icon: Film,     color: 'text-status-running-text', bg: 'bg-status-running',   label: 'Vídeo' },
}

function goalCfg(goal: string): GoalCfg {
  return GOAL_MAP[goal] ?? {
    Icon:  CheckCircle2,
    color: 'text-on-surface-variant',
    bg:    'bg-surface-high',
    label: goal,
  }
}

/* ── Filter options ─────────────────────────────────────────────────── */
const STATUS_FILTERS = [
  { value: 'all',     label: 'Todos'    },
  { value: 'running', label: 'Em curso' },
  { value: 'done',    label: 'Concluídos' },
  { value: 'failed',  label: 'Falhos'   },
  { value: 'pending', label: 'Pendentes' },
] as const

const GOAL_FILTERS = [
  { value: 'all',              label: 'Todos os goals'  },
  { value: 'copy_only',        label: 'Copy'            },
  { value: 'market_research',  label: 'Mercado'         },
  { value: 'avatar_research',  label: 'Avatar'          },
  { value: 'angle_generation', label: 'Ângulos'         },
  { value: 'video_prod',       label: 'Vídeo'           },
] as const

/* ── Export CSV ─────────────────────────────────────────────────────── */
function exportCsv(pipelines: Pipeline[], sku: string) {
  const header = ['id', 'goal', 'status', 'custo_usd', 'criado_em', 'concluido_em']
  const rows = pipelines.map((p) => [
    p.id,
    p.goal,
    p.status,
    p.cost_so_far_usd ?? '0',
    p.created_at,
    (p as any).completed_at ?? '',
  ])

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${sku}_historico.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Timeline item ──────────────────────────────────────────────────── */
function TimelineItem({ pipeline, isLast }: { pipeline: Pipeline; isLast: boolean }) {
  const { Icon, color, bg, label } = goalCfg(pipeline.goal)
  const isRunning = pipeline.status === 'running'
  const cost      = parseFloat(pipeline.cost_so_far_usd ?? '0')

  return (
    <div className={cn('flex gap-4 relative z-10', !isLast && 'pb-6')}>
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center border shrink-0',
        bg, color.replace('text-', 'border-') + '/30',
        isRunning && 'animate-pulse'
      )}>
        <Icon size={15} strokeWidth={1.5} className={color} />
      </div>

      <div className="flex-grow min-w-0 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-on-surface">{label}</span>
              <StatusBadge status={pipeline.status as 'running' | 'done' | 'failed' | 'pending' | 'paused'} />
            </div>
            <p className="text-[0.6875rem] text-on-surface-muted/60 font-mono mt-0.5">
              {pipeline.id.slice(0, 8)}… · ${cost.toFixed(4)}
            </p>
          </div>
          <span className="text-[0.625rem] font-mono text-on-surface-muted/40 shrink-0">
            {new Date(pipeline.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short', year: '2-digit',
            })}
          </span>
        </div>

        {isRunning && pipeline.progress_pct != null && (
          <Progress
            value={pipeline.progress_pct}
            className="h-1 mt-2 bg-surface-high [&>div]:bg-status-running-text [&>div]:transition-all [&>div]:duration-500"
          />
        )}
      </div>
    </div>
  )
}

/* ── Stats row ──────────────────────────────────────────────────────── */
function StatsRow({ pipelines }: { pipelines: Pipeline[] }) {
  const total     = pipelines.length
  const done      = pipelines.filter((p) => p.status === 'done').length
  const running   = pipelines.filter((p) => p.status === 'running').length
  const failed    = pipelines.filter((p) => p.status === 'failed').length
  const totalCost = pipelines.reduce((s, p) => s + parseFloat(p.cost_so_far_usd ?? '0'), 0)

  const items = [
    { label: 'Total',      value: total,                        color: 'text-on-surface' },
    { label: 'Concluídos', value: done,                         color: 'text-status-done-text'    },
    { label: 'Em curso',   value: running,                      color: 'text-status-running-text' },
    { label: 'Falhos',     value: failed,                       color: 'text-status-failed-text'  },
    { label: 'Custo total',value: `$${totalCost.toFixed(2)}`,   color: 'text-brand'      },
  ]

  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {items.map(({ label, value, color }) => (
        <div key={label} className="bg-surface-container border border-white/5 rounded-lg p-3 text-center">
          <p className="text-[0.625rem] text-on-surface-muted/50 uppercase tracking-wider mb-1">{label}</p>
          <p className={cn('text-lg font-mono font-medium', color)}>{value}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function HistoricoTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg bg-surface-high" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 pb-5">
          <Skeleton className="w-9 h-9 rounded-full bg-surface-high shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-48 bg-surface-high" />
            <Skeleton className="h-3 w-32 bg-surface-high" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function HistoricoTabEmpty({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Clock size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhum pipeline executado ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant">
          O histórico completo aparecerá aqui após o primeiro pipeline
        </p>
      </div>
      <Link
        href={`/?msg=@${sku}+/copy`}
        className="text-sm px-4 py-2 rounded font-medium text-on-primary
          bg-brand-gradient
          hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
          transition-shadow duration-150"
      >
        Iniciar via chat
      </Link>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface HistoricoTabProps {
  pipelines: Pipeline[]
  sku:       string
}

export function HistoricoTab({ pipelines, sku }: HistoricoTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [goalFilter,   setGoalFilter]   = useState<string>('all')

  const filtered = pipelines.filter((p) => {
    if (statusFilter !== 'all' && p.status  !== statusFilter) return false
    if (goalFilter   !== 'all' && p.goal    !== goalFilter)   return false
    return true
  })

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (pipelines.length === 0) return <HistoricoTabEmpty sku={sku} />

  return (
    <div>
      {/* Stats */}
      <StatsRow pipelines={pipelines} />

      {/* Filters + export */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors duration-150',
                statusFilter === value
                  ? 'bg-brand-muted text-brand'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
              )}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-4 bg-white/10" />

          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="h-7 px-2 text-xs rounded bg-surface-container border border-white/5
              text-on-surface outline-none
              focus:border-brand focus:ring-1 focus:ring-brand/20
              transition-all duration-150"
          >
            {GOAL_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => exportCsv(pipelines, sku)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
            text-on-surface-variant border border-white/5
            hover:text-on-surface hover:bg-surface-high transition-colors duration-150"
        >
          <Download size={12} strokeWidth={1.5} />
          Exportar CSV
        </button>
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <XCircle size={20} strokeWidth={1.5} className="text-on-surface-muted" />
          <p className="text-sm text-on-surface-variant">Nenhum resultado para este filtro</p>
          <button
            onClick={() => { setStatusFilter('all'); setGoalFilter('all') }}
            className="text-xs text-brand hover:underline mt-1"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[1.0625rem] top-1 bottom-1 w-px bg-white/5" />
          {sorted.map((p, i) => (
            <TimelineItem
              key={p.id}
              pipeline={p}
              isLast={i === sorted.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
