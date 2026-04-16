'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, ExternalLink, BarChart2,
  BadgeCheck, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/* ── Types ─────────────────────────────────────────────────────────── */
export interface MarketArtifactData {
  viability_score:        number
  viability_verdict:      'viable' | 'not_viable'
  viability_justification: string
  competition_level:      'low' | 'medium' | 'high' | 'saturated'
  ads_running_count:      number | 'data_unavailable'
  trend_direction:        'growing' | 'stable' | 'declining'
  trend_source?:          string
  estimated_margin_brl:   number | 'data_unavailable'
  market_warnings?:       string[]
  data_sources?:          string[]
}

/* ── Viability score card ───────────────────────────────────────────── */
function ViabilityScoreCard({ score, verdict, justification }: {
  score:         number
  verdict:       'viable' | 'not_viable'
  justification: string
}) {
  const color  = score >= 70 ? 'text-[#4ADE80]' : score >= 40 ? 'text-[#FCD34D]' : 'text-[#F87171]'
  const bg     = score >= 70 ? 'bg-[#4ADE80]/10' : score >= 40 ? 'bg-[#FCD34D]/10' : 'bg-[#F87171]/10'
  const border = score >= 70 ? 'border-[#4ADE80]/30' : score >= 40 ? 'border-[#FCD34D]/30' : 'border-[#F87171]/30'

  return (
    <div className={cn('bg-surface-container border rounded-xl p-6 flex items-start gap-6', border)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'w-24 h-24 rounded-xl flex flex-col items-center justify-center shrink-0 border cursor-help',
              bg, border
            )}>
              <span className={cn('text-4xl font-mono font-bold leading-none', color)}>{score}</span>
              <span className={cn('text-[0.5625rem] font-medium mt-1 uppercase tracking-widest', color)}>score</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs text-xs bg-surface-highest text-on-surface border-white/10">
            Score de viabilidade calculado pelo agente com base em margem, competição e tendência.
            É uma sugestão, não uma garantia de resultado.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {verdict === 'viable' ? (
            <BadgeCheck size={16} strokeWidth={1.5} className="text-[#4ADE80] shrink-0" />
          ) : (
            <XCircle size={16} strokeWidth={1.5} className="text-[#F87171] shrink-0" />
          )}
          <span className={cn('text-sm font-semibold', verdict === 'viable' ? 'text-[#4ADE80]' : 'text-[#F87171]')}>
            {verdict === 'viable' ? 'Produto viável para anunciar' : 'Produto com baixa viabilidade'}
          </span>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-on-surface-variant">{justification}</p>
      </div>
    </div>
  )
}

/* ── Competition badge ──────────────────────────────────────────────── */
function CompetitionBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    low:       { label: 'Baixa',    color: 'text-[#4ADE80]', bg: 'bg-[#4ADE80]/10' },
    medium:    { label: 'Média',    color: 'text-[#FCD34D]', bg: 'bg-[#FCD34D]/10' },
    high:      { label: 'Alta',     color: 'text-[#F97316]', bg: 'bg-[#F97316]/10' },
    saturated: { label: 'Saturada', color: 'text-[#F87171]', bg: 'bg-[#F87171]/10' },
  }
  const cfg = map[level] ?? { label: level, color: 'text-on-surface-variant', bg: 'bg-surface-high' }
  return (
    <span className={cn('text-xs font-mono font-medium px-2 py-0.5 rounded', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  )
}

/* ── Trend badge ────────────────────────────────────────────────────── */
function TrendBadge({ direction }: { direction: string }) {
  const map: Record<string, { Icon: typeof TrendingUp; label: string; color: string }> = {
    growing:  { Icon: TrendingUp,   label: 'Crescendo', color: 'text-[#4ADE80]' },
    stable:   { Icon: Minus,        label: 'Estável',   color: 'text-[#FCD34D]' },
    declining:{ Icon: TrendingDown, label: 'Declinando',color: 'text-[#F87171]' },
  }
  const cfg = map[direction]
  if (!cfg) return <span className="text-xs text-on-surface-variant font-mono">{direction}</span>
  return (
    <div className="flex items-center gap-1.5">
      <cfg.Icon size={14} strokeWidth={1.5} className={cfg.color} />
      <span className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</span>
    </div>
  )
}

/* ── Metric row ─────────────────────────────────────────────────────── */
function MetricRow({ label, value, monospace }: {
  label:      string
  value:      ReactNode
  monospace?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="text-[0.8125rem] text-on-surface-variant">{label}</span>
      <div className={cn('text-[0.8125rem] text-on-surface', monospace && 'font-mono')}>{value}</div>
    </div>
  )
}

/* ── Source link ────────────────────────────────────────────────────── */
function SourceLink({ url }: { url: string }) {
  let display: string
  try {
    display = new URL(url).hostname.replace('www.', '')
  } catch {
    display = url.length > 40 ? url.slice(0, 40) + '…' : url
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs text-brand hover:underline font-mono"
    >
      <span className="truncate max-w-[240px]">{display}</span>
      <ExternalLink size={10} strokeWidth={1.5} className="shrink-0" />
    </a>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function MercadoTabSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full rounded-xl bg-surface-highest" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-44 rounded-xl bg-surface-highest" />
        <Skeleton className="h-44 rounded-xl bg-surface-highest" />
      </div>
      <Skeleton className="h-24 rounded-xl bg-surface-highest" />
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function MercadoTabEmpty({ sku }: { sku: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <BarChart2 size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhum estudo de mercado encontrado</p>
        <p className="text-[0.6875rem] text-on-surface-variant">
          Solicite ao Jarvis para gerar a análise de viabilidade deste produto
        </p>
      </div>
      <Link
        href={`/?msg=@${sku}+/market-research`}
        className="text-sm px-4 py-2 rounded font-medium text-[#131314]
          bg-gradient-to-br from-[#F28705] to-[#FFB690]
          hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
          transition-shadow duration-150"
      >
        Gerar estudo de mercado
      </Link>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface MercadoTabProps {
  data:      MarketArtifactData
  createdAt: string
  sku:       string
}

export function MercadoTab({ data, createdAt, sku }: MercadoTabProps) {
  const margin = typeof data.estimated_margin_brl === 'number'
    ? `R$ ${data.estimated_margin_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '–'

  const adsCount = typeof data.ads_running_count === 'number'
    ? data.ads_running_count.toLocaleString('pt-BR')
    : '–'

  return (
    <div className="space-y-5">
      {/* Score card */}
      <ViabilityScoreCard
        score={data.viability_score}
        verdict={data.viability_verdict}
        justification={data.viability_justification}
      />

      {/* Metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Mercado e Concorrência</h3>
          <MetricRow label="Nível de competição"       value={<CompetitionBadge level={data.competition_level} />} />
          <MetricRow label="Anúncios ativos (estimativa)" value={adsCount}                                        monospace />
          <MetricRow label="Tendência"                  value={<TrendBadge direction={data.trend_direction} />} />
          {data.trend_source && (
            <MetricRow label="Fonte da tendência" value={<SourceLink url={data.trend_source} />} />
          )}
        </div>

        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Financeiro</h3>
          <MetricRow label="Margem estimada" value={margin} monospace />
          <MetricRow
            label="Análise gerada em"
            value={new Date(createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            monospace
          />
          <MetricRow
            label="Atualizar análise"
            value={
              <Link
                href={`/?msg=@${sku}+/market-research`}
                className="text-xs text-brand hover:underline"
              >
                Regerar via Jarvis →
              </Link>
            }
          />
        </div>
      </div>

      {/* Warnings */}
      {(data.market_warnings?.length ?? 0) > 0 && (
        <div className="bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} strokeWidth={1.5} className="text-[#F97316] shrink-0" />
            <h3 className="text-sm font-semibold text-[#F97316]">Alertas de mercado</h3>
          </div>
          <ul className="space-y-1.5">
            {data.market_warnings!.map((w, i) => (
              <li key={i} className="text-[0.8125rem] text-on-surface-variant flex items-start gap-2">
                <span className="text-[#F97316]/60 shrink-0 mt-0.5">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {(data.data_sources?.length ?? 0) > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Fontes pesquisadas</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {data.data_sources!.map((url, i) => (
              <SourceLink key={i} url={url} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
