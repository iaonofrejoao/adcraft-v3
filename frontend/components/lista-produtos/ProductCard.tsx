'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, Pencil, Film, Megaphone, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Product } from '@/hooks/useProducts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSummary {
  viability_score:        number | null
  has_market_study:       boolean
  personas_count:         number
  copies_count:           number
  creatives_count:        number
  active_campaigns_count: number
  updated_at:             string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatCurrency(value: string | null, country?: string | null): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return '—'
  const currency = country === 'US' ? 'USD' : 'BRL'
  return num.toLocaleString('pt-BR', { style: 'currency', currency })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (days > 0)  return `há ${days}d`
  if (hours > 0) return `há ${hours}h`
  return 'agora'
}

function scoreTextColor(score: number): string {
  if (score >= 7) return 'text-status-done-text'
  if (score >= 4) return 'text-status-paused-text'
  return 'text-status-failed-text'
}

function scoreBarColor(score: number): string {
  if (score >= 7) return 'bg-[#4ADE80]'
  if (score >= 4) return 'bg-[#FCD34D]'
  return 'bg-[#F87171]'
}

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORM_GRADIENT: Record<string, string> = {
  hotmart:   'from-[#3d1a00] to-[#1a0a00]',
  clickbank: 'from-[#0c1d4a] to-[#06102a]',
  monetizze: 'from-[#1e0a3c] to-[#0e0520]',
  eduzz:     'from-[#012a18] to-[#00140c]',
}
const DEFAULT_GRADIENT = 'from-[#252324] to-[#161516]'

const PLATFORM_ACCENT: Record<string, string> = {
  hotmart:   'text-[#F28705]',
  clickbank: 'text-[#60A5FA]',
  monetizze: 'text-[#C084FC]',
  eduzz:     'text-[#34D399]',
}
const DEFAULT_ACCENT = 'text-[#F28705]'

const PLATFORM_PILL: Record<string, string> = {
  hotmart:   'bg-[#F28705]/10 text-[#F28705] border-[#F28705]/20',
  clickbank: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20',
  monetizze: 'bg-[#C084FC]/10 text-[#C084FC] border-[#C084FC]/20',
  eduzz:     'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20',
}
const DEFAULT_PILL = 'bg-[#F28705]/10 text-[#F28705] border-[#F28705]/20'

const PLATFORM_LABEL: Record<string, string> = {
  hotmart:   'Hotmart',
  clickbank: 'ClickBank',
  monetizze: 'Monetizze',
  eduzz:     'Eduzz',
}

const COUNTRY_FLAG: Record<string, string> = {
  BR: '🇧🇷', US: '🇺🇸', PT: '🇵🇹', ES: '🇪🇸', MX: '🇲🇽', AR: '🇦🇷',
}

// ── StatusIcon ────────────────────────────────────────────────────────────────

interface StatusIconProps {
  icon: React.ElementType
  label: string
  active: boolean
  count?: number
}

function StatusIcon({ icon: Icon, label, active, count }: StatusIconProps) {
  const color = active
    ? count !== undefined
      ? count >= 2 ? 'text-status-done-text' : 'text-status-paused-text'
      : 'text-status-done-text'
    : 'text-on-surface-muted/25'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('flex items-center gap-0.5 transition-colors duration-150', color)}>
          <Icon size={13} strokeWidth={1.5} />
          {count !== undefined && count > 0 && (
            <span className="font-mono text-[10px] leading-none">{count}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="text-[11px]">
          {label}{count !== undefined && count > 0 ? ` (${count})` : ''}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product: p }: ProductCardProps) {
  const router  = useRouter()
  const [summary, setSummary] = useState<ProductSummary | null>(null)

  useEffect(() => {
    fetch(`/api/products/${p.sku}/summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setSummary(data))
      .catch(() => null)
  }, [p.sku])

  const platform      = p.platform?.toLowerCase() ?? ''
  const gradient      = PLATFORM_GRADIENT[platform] ?? DEFAULT_GRADIENT
  const accent        = PLATFORM_ACCENT[platform]   ?? DEFAULT_ACCENT
  const pill          = PLATFORM_PILL[platform]     ?? DEFAULT_PILL
  const platformLabel = PLATFORM_LABEL[platform]    ?? p.platform ?? null
  const initials      = getInitials(p.name)
  const score         = summary?.viability_score != null ? Number(summary.viability_score) : null
  const flag          = COUNTRY_FLAG[p.target_country ?? 'BR'] ?? '🌐'

  const commission = p.commission_percent ? parseFloat(p.commission_percent) : 0

  return (
    <TooltipProvider>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/products/${p.sku}`)}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/products/${p.sku}`)}
        className={cn(
          'bg-surface-container border border-white/5 rounded-xl overflow-hidden',
          'hover:border-white/10 hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)]',
          'transition-all duration-150 cursor-pointer flex flex-col group'
        )}
      >
        {/* ── Thumbnail ─────────────────────────────────────────────────── */}
        <div className={cn(
          'relative h-20 bg-gradient-to-br flex items-center justify-center shrink-0 select-none',
          gradient
        )}>
          <span className={cn('font-mono text-[2.25rem] font-black tracking-tight', accent)}>
            {initials}
          </span>

          {/* Platform badge */}
          {platformLabel && (
            <span className={cn(
              'absolute top-2.5 right-2.5 px-2 py-[3px] rounded text-[10px] font-mono font-bold tracking-wide border',
              pill
            )}>
              {platformLabel}
            </span>
          )}

          {/* Inactive badge */}
          {p.status !== 'active' && (
            <span className="absolute top-2.5 left-2.5 px-2 py-[3px] rounded text-[10px] font-mono font-bold tracking-wide bg-[rgba(161,161,170,0.15)] text-[#A1A1AA] border border-[#A1A1AA]/20">
              Inativo
            </span>
          )}

          {/* Arrow hint on hover */}
          <div className="absolute bottom-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <ArrowRight size={13} strokeWidth={2} className={accent} />
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 p-3.5 flex-1">

          {/* Name + niche + country */}
          <div>
            <h3 className="text-[0.875rem] font-semibold text-on-surface leading-snug truncate">
              {p.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              {p.niche?.name && (
                <span className="font-mono text-[0.625rem] text-on-surface-muted truncate">
                  {p.niche.name}
                </span>
              )}
              {p.niche?.name && (
                <span className="text-on-surface-muted/30 text-[0.5rem] shrink-0">•</span>
              )}
              <span className="text-[0.625rem] text-on-surface-muted shrink-0">{flag}</span>
              {!p.niche?.name && (
                <span className="font-mono text-[0.625rem] text-on-surface-muted/50 truncate">
                  {p.sku}
                </span>
              )}
            </div>
          </div>

          {/* Price + commission */}
          <div className="flex items-center gap-3">
            {p.ticket_price && (
              <span className="font-mono text-[0.8125rem] font-bold text-on-surface">
                {formatCurrency(p.ticket_price, p.target_country)}
              </span>
            )}
            {commission > 0 && (
              <span className="font-mono text-[0.6875rem] text-on-surface-muted">
                {commission.toFixed(0)}% comissão
              </span>
            )}
            {!p.ticket_price && commission === 0 && (
              <span className="font-mono text-[0.6875rem] text-on-surface-muted/40">Preço não definido</span>
            )}
          </div>

          {/* Viability score bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[0.5625rem] font-mono tracking-[0.08em] uppercase text-on-surface-muted/60">
                Viabilidade
              </span>
              {score != null ? (
                <span className={cn('text-[0.6875rem] font-bold font-mono', scoreTextColor(score))}>
                  {score.toFixed(1)}<span className="text-on-surface-muted/50 font-normal">/10</span>
                </span>
              ) : (
                <span className="text-[0.625rem] font-mono text-on-surface-muted/30">—</span>
              )}
            </div>
            <div className="h-[3px] rounded-full bg-surface-highest overflow-hidden">
              {score != null && (
                <div
                  className={cn('h-full rounded-full transition-all duration-700', scoreBarColor(score))}
                  style={{ width: `${score * 10}%` }}
                />
              )}
            </div>
          </div>

          {/* Status icons */}
          <div className="flex items-center gap-3.5">
            <StatusIcon
              icon={Search}
              label="Estudo de mercado"
              active={summary?.has_market_study ?? false}
            />
            <StatusIcon
              icon={User}
              label="Personas/Avatar"
              active={(summary?.personas_count ?? 0) > 0}
              count={summary?.personas_count}
            />
            <StatusIcon
              icon={Pencil}
              label="Copies geradas"
              active={(summary?.copies_count ?? 0) > 0}
              count={summary?.copies_count}
            />
            <StatusIcon
              icon={Film}
              label="Criativos"
              active={(summary?.creatives_count ?? 0) > 0}
              count={summary?.creatives_count}
            />
            <StatusIcon
              icon={Megaphone}
              label="Campanhas ativas"
              active={(summary?.active_campaigns_count ?? 0) > 0}
              count={summary?.active_campaigns_count}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
            <span className="font-mono text-[0.5625rem] text-on-surface-muted/40">
              {summary?.updated_at
                ? `atualizado ${formatRelative(summary.updated_at)}`
                : p.created_at
                  ? `criado ${formatRelative(p.created_at)}`
                  : '\u00a0'
              }
            </span>
            <span className={cn('font-mono text-[0.5625rem] font-bold tracking-[0.04em]', accent)}>
              {p.sku}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
