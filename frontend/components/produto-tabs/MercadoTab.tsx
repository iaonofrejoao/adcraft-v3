'use client'
import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, ExternalLink, BarChart2,
  BadgeCheck, XCircle, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface MarketArtifactData {
  viability_score:         number
  viability_verdict:       'viable' | 'not_viable'
  viability_justification: string
  competition_level:       'low' | 'medium' | 'high' | 'saturated'
  ads_running_count:       number | 'data_unavailable'
  trend_direction:         'growing' | 'stable' | 'declining'
  trend_source?:           string
  estimated_margin_brl:    number | 'data_unavailable'
  market_warnings?:        string[]
  data_sources?:           string[]
}

function scoreTokens(score: number) {
  if (score >= 70) return { color: 'text-status-done-text',   bg: 'bg-status-done',   border: 'border-status-done-text/30'   }
  if (score >= 40) return { color: 'text-status-paused-text', bg: 'bg-status-paused', border: 'border-status-paused-text/30' }
  return              { color: 'text-status-failed-text',  bg: 'bg-status-failed',  border: 'border-status-failed-text/30' }
}

function ViabilityScoreCard({ score, verdict, justification }: {
  score:         number
  verdict:       'viable' | 'not_viable'
  justification: string
}) {
  const t = scoreTokens(score)

  return (
    <div className={cn('bg-surface-container border rounded-xl p-6 flex items-start gap-6', t.border)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'w-24 h-24 rounded-xl flex flex-col items-center justify-center shrink-0 border cursor-help',
              t.bg, t.border
            )}>
              <span className={cn('text-4xl font-mono font-bold leading-none', t.color)}>{score}</span>
              <span className={cn('text-[0.5625rem] font-medium mt-1 uppercase tracking-widest', t.color)}>score</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs text-xs bg-surface-highest text-on-surface border-outline-variant/20">
            Score de viabilidade calculado pelo agente com base em margem, competição e tendência.
            É uma sugestão, não uma garantia de resultado.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {verdict === 'viable' ? (
            <BadgeCheck size={16} strokeWidth={1.5} className="text-status-done-text shrink-0" />
          ) : (
            <XCircle size={16} strokeWidth={1.5} className="text-status-failed-text shrink-0" />
          )}
          <span className={cn('text-sm font-semibold', verdict === 'viable' ? 'text-status-done-text' : 'text-status-failed-text')}>
            {verdict === 'viable' ? 'Produto viável para anunciar' : 'Produto com baixa viabilidade'}
          </span>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-on-surface-variant">{justification}</p>
      </div>
    </div>
  )
}

function CompetitionBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    low:       { label: 'Baixa',    color: 'text-status-done-text',   bg: 'bg-status-done'   },
    medium:    { label: 'Média',    color: 'text-status-paused-text', bg: 'bg-status-paused' },
    high:      { label: 'Alta',     color: 'text-brand',              bg: 'bg-brand-muted'   },
    saturated: { label: 'Saturada', color: 'text-status-failed-text', bg: 'bg-status-failed' },
  }
  const cfg = map[level] ?? { label: level, color: 'text-on-surface-variant', bg: 'bg-surface-high' }
  return (
    <span className={cn('text-xs font-mono font-medium px-2 py-0.5 rounded', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  )
}

function TrendBadge({ direction }: { direction: string }) {
  const map: Record<string, { Icon: typeof TrendingUp; label: string; color: string }> = {
    growing:   { Icon: TrendingUp,   label: 'Crescendo',  color: 'text-status-done-text'   },
    stable:    { Icon: Minus,        label: 'Estável',    color: 'text-status-paused-text' },
    declining: { Icon: TrendingDown, label: 'Declinando', color: 'text-status-failed-text' },
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

function MetricRow({ label, value, monospace }: {
  label:      string
  value:      ReactNode
  monospace?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-outline-variant/10 last:border-0">
      <span className="text-[0.8125rem] text-on-surface-variant">{label}</span>
      <div className={cn('text-[0.8125rem] text-on-surface', monospace && 'font-mono')}>{value}</div>
    </div>
  )
}

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

export function MercadoTabSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full rounded-xl bg-surface-high" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-44 rounded-xl bg-surface-high" />
        <Skeleton className="h-44 rounded-xl bg-surface-high" />
      </div>
      <Skeleton className="h-24 rounded-xl bg-surface-high" />
    </div>
  )
}

export function MercadoTabEmpty({ sku }: { sku: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/pipelines', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product_sku: sku, goal: 'market_only' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar pipeline')
      router.push(`/demandas/${data.pipeline_id}`)
    } catch {
      router.push(`/?msg=@${sku}+/market-research`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-outline-variant/10 flex items-center justify-center">
        <BarChart2 size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-on-surface">Nenhum estudo de mercado encontrado</p>
        <p className="text-[0.6875rem] text-on-surface-variant">
          Clique abaixo para iniciar a análise de viabilidade deste produto
        </p>
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading}
        size="sm"
        className="bg-brand-gradient text-on-primary hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150"
      >
        {loading && <Loader2 size={14} strokeWidth={1.5} className="animate-spin mr-1.5" />}
        {loading ? 'Iniciando…' : 'Gerar estudo de mercado'}
      </Button>
    </div>
  )
}

function useRegenerate(sku: string, goal: string) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function run() {
    setConfirm(false)
    setLoading(true)
    try {
      const res = await fetch('/api/pipelines', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product_sku: sku, goal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar')
      router.push(`/demandas/${data.pipeline_id}`)
    } catch {
      router.push(`/?msg=@${sku}+/market-research`)
    } finally {
      setLoading(false)
    }
  }

  return { loading, confirm, setConfirm, run }
}

export interface MercadoTabProps {
  data:      MarketArtifactData
  createdAt: string
  sku:       string
}

export function MercadoTab({ data, createdAt, sku }: MercadoTabProps) {
  const regen = useRegenerate(sku, 'market_only')

  const margin = typeof data.estimated_margin_brl === 'number'
    ? `R$ ${data.estimated_margin_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '–'

  const adsCount = typeof data.ads_running_count === 'number'
    ? data.ads_running_count.toLocaleString('pt-BR')
    : '–'

  return (
    <div className="space-y-6">
      <ViabilityScoreCard
        score={data.viability_score}
        verdict={data.viability_verdict}
        justification={data.viability_justification}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Mercado e Concorrência</h3>
          <MetricRow label="Nível de competição"           value={<CompetitionBadge level={data.competition_level} />} />
          <MetricRow label="Anúncios ativos (estimativa)"  value={adsCount} monospace />
          <MetricRow label="Tendência"                     value={<TrendBadge direction={data.trend_direction} />} />
          {data.trend_source && (
            <MetricRow label="Fonte da tendência" value={<SourceLink url={data.trend_source} />} />
          )}
        </div>

        <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-6">
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
              regen.confirm ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-on-surface-muted">Confirmar?</span>
                  <button onClick={regen.run} className="text-brand font-medium hover:underline">Sim</button>
                  <button onClick={() => regen.setConfirm(false)} className="text-on-surface-muted hover:underline">Não</button>
                </span>
              ) : (
                <button
                  onClick={() => regen.setConfirm(true)}
                  disabled={regen.loading}
                  className="flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
                >
                  {regen.loading
                    ? <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Iniciando…</>
                    : 'Refazer análise →'}
                </button>
              )
            }
          />
        </div>
      </div>

      {(data.market_warnings?.length ?? 0) > 0 && (
        <div className="bg-brand-muted border border-brand/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} strokeWidth={1.5} className="text-brand shrink-0" />
            <h3 className="text-sm font-semibold text-brand">Alertas de mercado</h3>
          </div>
          <ul className="space-y-1.5">
            {data.market_warnings!.map((w, i) => (
              <li key={i} className="text-[0.8125rem] text-on-surface-variant flex items-start gap-2">
                <span className="text-brand/60 shrink-0 mt-0.5">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.data_sources?.length ?? 0) > 0 && (
        <div className="bg-surface-container border border-outline-variant/10 rounded-xl p-6">
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
