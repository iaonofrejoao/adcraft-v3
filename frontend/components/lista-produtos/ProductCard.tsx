'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, Pencil, Film, Megaphone, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Product } from '@/hooks/useProducts'

// ── Summary type ──────────────────────────────────────────────────────────────

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

function scoreColor(score: number): string {
  if (score >= 7) return 'text-green-400'
  if (score >= 4) return 'text-yellow-400'
  return 'text-red-400'
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (days > 0)  return `há ${days} dia${days !== 1 ? 's' : ''}`
  if (hours > 0) return `há ${hours}h`
  return 'agora'
}

// ── Status icon row ───────────────────────────────────────────────────────────

interface StatusIconProps {
  icon: React.ElementType
  label: string
  active: boolean
  count?: number
}

function StatusIcon({ icon: Icon, label, active, count }: StatusIconProps) {
  const color = active
    ? count !== undefined
      ? count >= 2
        ? 'text-green-400'
        : 'text-yellow-400'
      : 'text-green-400'
    : 'text-on-surface-muted/40'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('flex items-center', color)}>
          <Icon size={14} strokeWidth={1.5} />
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

// ── Componente principal ──────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product: p }: ProductCardProps) {
  const router = useRouter()
  const [summary, setSummary] = useState<ProductSummary | null>(null)

  useEffect(() => {
    fetch(`/api/products/${p.sku}/summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setSummary(data))
      .catch(() => null)
  }, [p.sku])

  return (
    <TooltipProvider>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/products/${p.sku}`)}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/products/${p.sku}`)}
        className={cn(
          'bg-surface-container border border-white/5 rounded-xl p-4',
          'hover:bg-surface-high transition-colors duration-150 cursor-pointer',
          'flex flex-col gap-3'
        )}
      >
        {/* Top row: nome + ícone de configurações */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-on-surface truncate">
              {p.name}
            </h3>
            <p className="font-mono text-[0.6875rem] tracking-[0.02em] text-on-surface-muted mt-0.5">
              {[p.niche?.name, p.platform].filter(Boolean).join(' • ') || p.sku}
            </p>
          </div>
          <Settings
            size={14}
            strokeWidth={1.5}
            className="text-on-surface-muted/40 shrink-0 mt-0.5"
          />
        </div>

        {/* Score row */}
        {summary?.viability_score != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] text-on-surface-muted font-mono">Score:</span>
            <span className={cn('text-[0.6875rem] font-bold font-mono', scoreColor(summary.viability_score))}>
              {Number(summary.viability_score).toFixed(1)}/10
            </span>
          </div>
        )}

        {/* Status icon row */}
        <div className="flex items-center gap-2.5">
          <StatusIcon
            icon={Search}
            label="Estudo de mercado"
            active={summary?.has_market_study ?? false}
          />
          <StatusIcon
            icon={User}
            label="Personas/Avatar"
            active={(summary?.personas_count ?? 0) > 0}
            count={summary?.personas_count ?? 0}
          />
          <StatusIcon
            icon={Pencil}
            label="Copies geradas"
            active={(summary?.copies_count ?? 0) > 0}
          />
          <StatusIcon
            icon={Film}
            label="Criativos"
            active={(summary?.creatives_count ?? 0) > 0}
          />
          <StatusIcon
            icon={Megaphone}
            label="Campanhas ativas"
            active={(summary?.active_campaigns_count ?? 0) > 0}
          />
        </div>

        {/* Footer: updated_at */}
        <p className="font-mono text-[0.625rem] text-on-surface-muted/60 mt-auto">
          {summary?.updated_at
            ? `Atualizado ${formatRelative(summary.updated_at)}`
            : p.ticket_price
              ? `R$ ${parseFloat(p.ticket_price).toLocaleString('pt-BR')}`
              : '\u00a0'
          }
        </p>
      </div>
    </TooltipProvider>
  )
}
