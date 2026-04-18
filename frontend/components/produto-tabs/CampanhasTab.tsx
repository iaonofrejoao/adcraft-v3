'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Megaphone, Target, Users, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/* ── Types ─────────────────────────────────────────────────────────── */
interface FunnelStage {
  budget_percent: number
  creative_type:  string
  objective:      string
  kpi_target:     string
}

interface TargetAudience {
  name:           string
  platform:       string
  targeting_type: string
  funnel_stage:   string
  description:    string
  interests?:     string[]
}

interface CampaignKPIs {
  target_cpa_brl:          number
  target_roas:             number
  target_ctr_percent:      number
  target_hook_rate_percent?: number
  max_cpm_brl?:            number
}

interface CampaignStrategyData {
  campaign_objective:         string
  primary_platform:           string
  platform_rationale:         string
  secondary_platforms:        string[]
  policy_warnings:            string[]
  budget_warnings:            string[]
  target_audiences:           TargetAudience[]
  funnel_stages:              Record<string, FunnelStage>
  recommended_daily_budget_brl: number
  budget_calculation:         string
  launch_sequence:            string[]
  kpis:                       CampaignKPIs
  angle_to_use?:              string
}

interface KnowledgeRow {
  id:                 string
  artifact_type:      string
  artifact_data:      CampaignStrategyData
  status:             string
  source_pipeline_id: string
  created_at:         string
}

/* ── Helpers ────────────────────────────────────────────────────────── */
const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook / Instagram',
  google:   'Google Ads',
  tiktok:   'TikTok',
  youtube:  'YouTube',
}

const FUNNEL_LABEL: Record<string, string> = {
  awareness:     'Topo — Awareness',
  consideration: 'Meio — Consideração',
  conversion:    'Fundo — Conversão',
}

const FUNNEL_COLOR: Record<string, string> = {
  awareness:     'text-[#60A5FA] bg-[#60A5FA]/10',
  consideration: 'text-[#FCD34D] bg-[#FCD34D]/10',
  conversion:    'text-[#4ADE80] bg-[#4ADE80]/10',
}

const PLATFORM_COLOR: Record<string, string> = {
  facebook: 'text-[#60A5FA] bg-[#3B82F6]/10',
  google:   'text-[#F87171] bg-[#EF4444]/10',
  tiktok:   'text-[#F472B6] bg-[#EC4899]/10',
  youtube:  'text-[#F87171] bg-[#EF4444]/10',
}

/* ── Sub-components ─────────────────────────────────────────────────── */
function MetricRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="text-[0.8125rem] text-on-surface-variant">{label}</span>
      <span className={cn('text-[0.8125rem] text-on-surface text-right', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={cn(
      'text-xs font-mono font-medium px-2 py-0.5 rounded',
      PLATFORM_COLOR[platform] ?? 'text-on-surface-variant bg-surface-high'
    )}>
      {PLATFORM_LABEL[platform] ?? platform}
    </span>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function CampanhasTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl bg-surface-highest" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-44 rounded-xl bg-surface-highest" />
        <Skeleton className="h-44 rounded-xl bg-surface-highest" />
      </div>
      <Skeleton className="h-36 rounded-xl bg-surface-highest" />
      <Skeleton className="h-48 rounded-xl bg-surface-highest" />
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────── */
export function CampanhasTabEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        <Megaphone size={22} strokeWidth={1.5} className="text-on-surface-muted" />
      </div>
      <div className="text-center space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold text-on-surface">Nenhuma estratégia gerada ainda</p>
        <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">
          Execute o pipeline completo para gerar a estratégia de campanha deste produto.
          O agente <span className="font-mono text-brand">campaign_strategy</span> produz este artefato.
        </p>
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface CampanhasTabProps {
  sku: string
}

export function CampanhasTab({ sku }: CampanhasTabProps) {
  const [row, setRow]       = useState<KnowledgeRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}/knowledge?type=campaign_strategy&status=fresh`)
      .then(r => r.json())
      .then(res => {
        const rows: KnowledgeRow[] = res.knowledge ?? []
        setRow(rows[0] ?? null)
      })
      .finally(() => setLoading(false))
  }, [sku])

  if (loading) return <CampanhasTabSkeleton />
  if (!row)    return <CampanhasTabEmpty />

  const d = row.artifact_data

  const budget = d.recommended_daily_budget_brl?.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  })

  return (
    <div className="space-y-5">

      {/* ── Header: plataforma + rationale ── */}
      <div className="bg-surface-container border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} strokeWidth={1.5} className="text-brand shrink-0" />
            <span className="text-sm font-semibold text-on-surface">Plataforma primária</span>
            <PlatformBadge platform={d.primary_platform} />
          </div>
          <p className="text-[0.6875rem] font-mono text-on-surface-muted whitespace-nowrap">
            {new Date(row.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </p>
        </div>

        {d.secondary_platforms?.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[0.6875rem] text-on-surface-muted">Secundárias:</span>
            {d.secondary_platforms.map(p => <PlatformBadge key={p} platform={p} />)}
          </div>
        )}

        <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">
          {d.platform_rationale}
        </p>
      </div>

      {/* ── Budget + KPIs / Funil ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={15} strokeWidth={1.5} className="text-on-surface-muted" />
            <h3 className="text-sm font-semibold text-on-surface">Budget e KPIs</h3>
          </div>
          <MetricRow label="Budget diário recomendado" value={budget} mono />
          <MetricRow label="CPA target"  value={`R$ ${d.kpis?.target_cpa_brl?.toFixed(2)}`}  mono />
          <MetricRow label="ROAS target" value={`${d.kpis?.target_roas}×`}                    mono />
          <MetricRow label="CTR target"  value={`${d.kpis?.target_ctr_percent}%`}             mono />
          {d.kpis?.max_cpm_brl != null && (
            <MetricRow label="CPM máximo" value={`R$ ${d.kpis.max_cpm_brl.toFixed(2)}`} mono />
          )}
          {d.budget_calculation && (
            <p className="text-[0.6875rem] text-on-surface-muted/60 mt-3 leading-relaxed">
              {d.budget_calculation}
            </p>
          )}
        </div>

        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Funil de campanha</h3>
          <div className="space-y-3">
            {Object.entries(d.funnel_stages ?? {}).map(([stage, info]) => (
              <div key={stage} className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  'text-sm font-mono font-bold',
                  FUNNEL_COLOR[stage] ?? 'text-on-surface-variant bg-surface-high'
                )}>
                  {info.budget_percent}%
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    'text-xs font-semibold',
                    (FUNNEL_COLOR[stage] ?? '').split(' ')[0]
                  )}>
                    {FUNNEL_LABEL[stage] ?? stage}
                  </p>
                  <p className="text-[0.6875rem] text-on-surface-muted leading-relaxed">
                    {info.kpi_target}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Públicos-alvo ── */}
      {d.target_audiences?.length > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} strokeWidth={1.5} className="text-on-surface-muted" />
            <h3 className="text-sm font-semibold text-on-surface">
              Públicos-alvo ({d.target_audiences.length})
            </h3>
          </div>
          <div className="space-y-0">
            {d.target_audiences.map((audience, i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-surface-high flex items-center justify-center shrink-0 mt-0.5">
                  <Users size={12} strokeWidth={1.5} className="text-on-surface-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold text-on-surface">{audience.name}</span>
                    <span className={cn(
                      'text-[0.625rem] font-mono px-1.5 py-0.5 rounded',
                      FUNNEL_COLOR[audience.funnel_stage] ?? 'text-on-surface-variant bg-surface-high'
                    )}>
                      {audience.funnel_stage}
                    </span>
                    <PlatformBadge platform={audience.platform} />
                  </div>
                  <p className="text-[0.6875rem] text-on-surface-variant leading-relaxed">
                    {audience.description}
                  </p>
                  {audience.interests && audience.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {audience.interests.map((interest, j) => (
                        <span key={j} className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded">
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cronograma de lançamento ── */}
      {d.launch_sequence?.length > 0 && (
        <div className="bg-surface-container border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} strokeWidth={1.5} className="text-on-surface-muted" />
            <h3 className="text-sm font-semibold text-on-surface">Cronograma de lançamento</h3>
          </div>
          <div className="space-y-3">
            {d.launch_sequence.map((phase, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 text-[0.625rem] font-mono font-bold">
                  {i + 1}
                </div>
                <p className="text-[0.8125rem] text-on-surface-variant leading-relaxed">{phase}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alertas ── */}
      {d.policy_warnings?.length > 0 && (
        <div className="bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} strokeWidth={1.5} className="text-[#F97316] shrink-0" />
            <span className="text-xs font-semibold text-[#F97316]">Alertas de política</span>
          </div>
          <ul className="space-y-1">
            {d.policy_warnings.map((w, i) => (
              <li key={i} className="text-[0.75rem] text-on-surface-variant flex items-start gap-2">
                <span className="text-[#F97316]/60 shrink-0 mt-0.5">•</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.budget_warnings?.length > 0 && (
        <div className="bg-[#FCD34D]/5 border border-[#FCD34D]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} strokeWidth={1.5} className="text-[#FCD34D] shrink-0" />
            <span className="text-xs font-semibold text-[#FCD34D]">Alertas de budget</span>
          </div>
          <ul className="space-y-1">
            {d.budget_warnings.map((w, i) => (
              <li key={i} className="text-[0.75rem] text-on-surface-variant flex items-start gap-2">
                <span className="text-[#FCD34D]/60 shrink-0 mt-0.5">•</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
