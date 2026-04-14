'use client'
import Link from 'next/link'
import {
  FileText, Search, Layers, Film, CheckCircle2, XCircle,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import type { Pipeline, Product } from './types'

/* ── Goal → icon/color map ───────────────────────────────────────── */
interface GoalConfig { Icon: LucideIcon; color: string; bg: string }

const GOAL_MAP: Record<string, GoalConfig> = {
  copy_only:        { Icon: FileText,    color: 'text-brand',         bg: 'bg-brand-muted' },
  market_research:  { Icon: Search,      color: 'text-agent-research',bg: 'bg-agent-research/10' },
  avatar_research:  { Icon: Search,      color: 'text-agent-research',bg: 'bg-agent-research/10' },
  angle_generation: { Icon: Layers,      color: 'text-agent-strategy',bg: 'bg-agent-strategy/10' },
  full_pipeline:    { Icon: Layers,      color: 'text-brand',         bg: 'bg-brand-muted' },
  video_prod:       { Icon: Film,        color: 'text-[#60A5FA]',     bg: 'bg-[#60A5FA]/10' },
}

function goalConfig(goal: string): GoalConfig {
  return GOAL_MAP[goal] ?? { Icon: CheckCircle2, color: 'text-on-surface-variant', bg: 'bg-surface-high' }
}

/* ── Stat cell ───────────────────────────────────────────────────── */
interface StatCellProps { label: string; value: string | number; accent?: boolean }

function StatCell({ label, value, accent }: StatCellProps) {
  return (
    <div className="bg-surface-low p-4 rounded-lg">
      <p className="text-[0.625rem] text-on-surface-muted/50 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={cn('text-xl font-mono font-medium', accent ? 'text-brand' : 'text-on-surface')}>
        {value}
      </p>
    </div>
  )
}

/* ── Timeline item ───────────────────────────────────────────────── */
interface TimelineItemProps { pipeline: Pipeline; isLast: boolean }

function TimelineItem({ pipeline: p, isLast }: TimelineItemProps) {
  const { Icon, color, bg } = goalConfig(p.goal)
  const isRunning = p.status === 'running'
  const cost      = parseFloat(p.cost_so_far_usd ?? '0')

  return (
    <div className={cn('flex gap-4 relative z-10', !isLast && 'pb-6')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center border shrink-0',
        bg,
        color.replace('text-', 'border-') + '/30',
        isRunning && 'animate-pulse'
      )}>
        <Icon size={14} strokeWidth={1.5} className={color} />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <h4 className="text-sm font-medium text-on-surface">{p.goal}</h4>
          <span className={cn(
            'text-[0.625rem] font-mono shrink-0 ml-2',
            isRunning ? 'text-[#60A5FA]' : 'text-on-surface-muted/40'
          )}>
            {isRunning ? 'Em curso' : new Date(p.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>
        {isRunning && p.progress_pct != null ? (
          <Progress
            value={p.progress_pct}
            className="h-1 mt-2 bg-surface-highest [&>div]:bg-[#60A5FA] [&>div]:transition-all [&>div]:duration-500"
          />
        ) : (
          <p className="text-[0.6875rem] text-on-surface-muted/60 mt-0.5 font-mono">
            {p.status} • ${cost.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Stats + Activity section ────────────────────────────────────── */
interface StatsAndActivityProps {
  product:   Product
  pipelines: Pipeline[]
  className?: string
}

export function StatsAndActivity({ product, pipelines, className }: StatsAndActivityProps) {
  const totalCost = pipelines.reduce((s, p) => s + parseFloat(p.cost_so_far_usd ?? '0'), 0)
  const doneCount = pipelines.filter((p) => p.status === 'done').length
  const runCount  = pipelines.filter((p) => p.status === 'running').length

  const recentPipelines = [...pipelines]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <h2 className="text-[1rem] font-semibold tracking-tight text-on-surface">
        Stats e Atividade
      </h2>

      {/* Stats grid */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-4">Estatísticas</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCell label="Pipelines totais" value={pipelines.length} />
          <StatCell label="Concluídos"        value={doneCount} />
          <StatCell label="Em execução"       value={runCount} />
          <StatCell label="Custo total"       value={`$${totalCost.toFixed(2)}`} accent />
          {product.ticket_price && (
            <StatCell
              label="Preço"
              value={`R$ ${parseFloat(product.ticket_price).toLocaleString('pt-BR')}`}
            />
          )}
          {product.commission_percent && (
            <StatCell
              label="Comissão"
              value={`${parseFloat(product.commission_percent).toFixed(0)}%`}
            />
          )}
        </div>
      </div>

      {/* Links */}
      {(product.product_url || product.affiliate_link) && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Links</h3>
          <div className="space-y-3">
            {product.product_url && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-on-surface-variant shrink-0">URL do produto</span>
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-brand hover:underline truncate flex items-center gap-1"
                >
                  <span className="truncate max-w-[160px]">{product.product_url}</span>
                  <ExternalLink size={10} strokeWidth={1.5} className="shrink-0" />
                </a>
              </div>
            )}
            {product.affiliate_link && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-on-surface-variant shrink-0">Afiliado</span>
                <a
                  href={product.affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-brand hover:underline truncate flex items-center gap-1"
                >
                  <span className="truncate max-w-[160px]">{product.affiliate_link}</span>
                  <ExternalLink size={10} strokeWidth={1.5} className="shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5 flex-grow">
        <h3 className="text-sm font-semibold text-on-surface mb-5">Atividade recente</h3>
        {recentPipelines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <XCircle size={20} strokeWidth={1.5} className="text-on-surface-muted" />
            <p className="text-[0.8125rem] text-on-surface-variant">Nenhum pipeline executado.</p>
            <Link
              href={`/?msg=@${product.sku}+/copy`}
              className="text-xs text-brand hover:underline"
            >
              Iniciar via chat →
            </Link>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-1 bottom-1 w-px bg-white/5" />
            {recentPipelines.map((p, i) => (
              <TimelineItem
                key={p.id}
                pipeline={p}
                isLast={i === recentPipelines.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
