'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Search, Check, X, RotateCcw, Clock, Image,
  ExternalLink, Globe, ChevronDown, Megaphone, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useFbAdsLibrary,
  type LibraryFbAd,
  type LibraryAdStatusFilter,
} from '@/hooks/useFbAdsLibrary'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const pct   = Math.round(score * 100)
  const color =
    pct >= 70 ? 'text-status-done-text   bg-status-done'   :
    pct >= 40 ? 'text-status-paused-text bg-status-paused' :
                'text-status-failed-text bg-status-failed'
  return (
    <span className={cn('text-[0.5625rem] font-mono font-bold px-1.5 py-0.5 rounded shrink-0', color)}>
      {pct}%
    </span>
  )
}

const STATUS_LABELS: { id: LibraryAdStatusFilter; label: string }[] = [
  { id: 'all',      label: 'Todos'      },
  { id: 'pending',  label: 'Pendentes'  },
  { id: 'approved', label: 'Aprovados'  },
  { id: 'rejected', label: 'Rejeitados' },
]

// ── Ad Card ───────────────────────────────────────────────────────────────────

interface LibraryAdCardProps {
  ad:        LibraryFbAd
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  onReset:   (id: string) => void
}

function LibraryAdCard({ ad, onApprove, onReject, onReset }: LibraryAdCardProps) {
  const [imgError, setImgError] = useState(false)

  const isApproved = ad.status === 'approved'
  const isRejected = ad.status === 'rejected'
  const isPending  = ad.status === 'pending'
  const thumb      = ad.image_url ?? ad.video_url ?? null

  return (
    <div className={cn(
      'bg-surface-container rounded-xl overflow-hidden transition-all duration-150 flex flex-col border',
      isApproved ? 'border-status-done-text/30'              :
      isRejected ? 'border-status-failed-text/20 opacity-60' :
                   'border-white/5',
    )}>
      {/* Thumbnail — aspect landscape (16:9) */}
      <div className="relative aspect-video bg-surface-high overflow-hidden shrink-0">
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt={ad.page_name ?? 'Facebook Ad'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image size={20} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
        )}

        {/* Status badge */}
        {isApproved && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-status-done flex items-center justify-center">
            <Check size={10} strokeWidth={2} className="text-status-done-text" />
          </div>
        )}
        {isRejected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-status-failed flex items-center justify-center">
            <X size={10} strokeWidth={2} className="text-status-failed-text" />
          </div>
        )}

        {/* Tipo de mídia */}
        {ad.media_type === 'video' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-[0.5rem] font-mono px-1.5 py-0.5 rounded">
            <Play size={7} strokeWidth={1.5} />
            VÍDEO
          </div>
        )}
        {ad.media_type === 'carousel' && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[0.5rem] font-mono px-1.5 py-0.5 rounded">
            CARROSSEL
          </div>
        )}

        {/* Produto badge */}
        {ad.product_name && (
          <div className="absolute top-2 left-2 max-w-[60%]">
            <span className="bg-black/70 text-white text-[0.5rem] font-medium px-1.5 py-0.5 rounded truncate block">
              {ad.product_name}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5 flex flex-col flex-1">
        {/* Nicho */}
        {ad.niche_name && (
          <span className="text-[0.5rem] font-medium tracking-wide uppercase text-brand/70">
            {ad.niche_name}
          </span>
        )}

        {/* Page name + score */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[0.625rem] font-semibold text-on-surface truncate">
            {ad.page_name ?? 'Anunciante desconhecido'}
          </span>
          <ScoreBadge score={ad.relevance_score} />
        </div>

        {/* Headline */}
        {ad.headline && (
          <p className="text-[0.5625rem] font-medium text-on-surface-variant leading-snug line-clamp-1">
            {ad.headline}
          </p>
        )}

        {/* Copy snippet */}
        {ad.ad_copy && (
          <p className="text-[0.5625rem] text-on-surface-muted/70 leading-relaxed line-clamp-2">
            {ad.ad_copy}
          </p>
        )}

        {/* Dias no ar */}
        {ad.days_running != null && (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'flex items-center gap-1 text-[0.5rem] font-mono px-1.5 py-0.5 rounded',
              !ad.stopped_at
                ? 'bg-status-done/20 text-status-done-text'
                : 'bg-surface-high text-on-surface-muted',
            )}>
              <Clock size={7} strokeWidth={1.5} />
              {ad.days_running}d {!ad.stopped_at ? 'ativo' : 'encerrado'}
            </span>
            {ad.cta_text && (
              <span className="text-[0.5rem] font-medium uppercase tracking-wide px-1 py-0.5 rounded bg-brand/10 text-brand">
                {ad.cta_text}
              </span>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-1 pt-0.5 mt-auto">
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(ad.id)}
                className="flex-1 h-6 text-[0.5625rem] bg-status-done text-status-done-text hover:opacity-90 border-0 px-1"
              >
                <Check size={10} strokeWidth={2} className="mr-0.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(ad.id)}
                className="flex-1 h-6 text-[0.5625rem] text-status-failed-text hover:bg-status-failed px-1"
              >
                <X size={10} strokeWidth={2} className="mr-0.5" />
                Rejeitar
              </Button>
            </>
          )}
          {isApproved && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(ad.id)}
              className="flex-1 h-6 text-[0.5625rem] text-on-surface-muted hover:text-status-failed-text px-1"
            >
              <X size={10} strokeWidth={2} className="mr-0.5" />
              Rejeitar
            </Button>
          )}
          {isRejected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReset(ad.id)}
              className="flex-1 h-6 text-[0.5625rem] text-on-surface-muted hover:text-on-surface px-1"
            >
              <RotateCcw size={9} strokeWidth={1.5} className="mr-0.5" />
              Restaurar
            </Button>
          )}
          {ad.destination_url && (
            <a
              href={ad.destination_url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Abrir landing page"
            >
              <Globe size={10} strokeWidth={1.5} className="text-on-surface-muted" />
            </a>
          )}
          {ad.fb_ad_id && (
            <a
              href={`https://www.facebook.com/ads/library/?id=${ad.fb_ad_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Ver no Ads Library"
            >
              <ExternalLink size={10} strokeWidth={1.5} className="text-on-surface-muted" />
            </a>
          )}
          {ad.product_sku && (
            <Link
              href={`/products/${ad.product_sku}/facebook-ads`}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Ver no produto"
            >
              <ChevronDown size={10} strokeWidth={1.5} className="text-on-surface-muted -rotate-90" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 bg-surface-container" />
        <Skeleton className="h-9 w-40 bg-surface-container" />
        <Skeleton className="h-9 w-40 bg-surface-container" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
            <Skeleton className="aspect-video w-full bg-surface-highest" />
            <div className="p-2.5 space-y-2">
              <Skeleton className="h-2.5 w-2/3 bg-surface-highest" />
              <Skeleton className="h-2.5 w-full bg-surface-highest" />
              <Skeleton className="h-2.5 w-1/2 bg-surface-highest" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { id: string; name: string }[]
}) {
  const selected = options.find(o => o.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-lg text-sm transition-colors duration-150',
          'bg-surface-container border border-white/5 min-w-[160px]',
          value ? 'text-on-surface' : 'text-on-surface-muted',
          'hover:bg-surface-high',
        )}>
          <span className="flex-1 text-left truncate text-[0.8125rem]">
            {selected?.name ?? placeholder}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-on-surface-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-surface-highest border-white/10 min-w-[200px] max-h-64 overflow-y-auto">
        <DropdownMenuItem
          onClick={() => onChange('')}
          className={cn('text-[0.8125rem] cursor-pointer', !value ? 'text-brand' : 'text-on-surface-variant')}
        >
          {placeholder}
        </DropdownMenuItem>
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn('text-[0.8125rem] cursor-pointer truncate', value === opt.id ? 'text-brand' : 'text-on-surface')}
          >
            {opt.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FbAdsLibraryPage() {
  const {
    ads, total, isLoading,
    niches, products,
    query,     setQuery,
    nicheId,   setNicheId,
    productId, setProductId,
    status,    setStatus,
    counts,
    approve, reject, reset,
  } = useFbAdsLibrary()

  if (isLoading) return <LibrarySkeleton />

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por copy, anunciante, headline…"
            className={cn(
              'w-full h-9 rounded-lg border border-white/5 bg-surface-container pl-9 pr-3',
              'text-sm text-on-surface placeholder:text-on-surface-muted/50',
              'outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all duration-150',
            )}
          />
        </div>
        <FilterSelect value={nicheId}   onChange={setNicheId}   placeholder="Todos os nichos"   options={niches} />
        <FilterSelect value={productId} onChange={setProductId} placeholder="Todos os produtos" options={products} />
      </div>

      {/* ── Status pills + contador ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {STATUS_LABELS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatus(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium transition-all duration-150',
                status === id
                  ? 'bg-surface-high text-on-surface'
                  : 'text-on-surface-muted hover:text-on-surface-variant hover:bg-surface-container',
              )}
            >
              {label}
              <span className={cn(
                'text-[0.5625rem] font-mono px-1 py-0.5 rounded',
                status === id ? 'bg-brand/20 text-brand' : 'bg-surface-high text-on-surface-muted',
              )}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
        <span className="text-[0.6875rem] font-mono text-on-surface-muted">
          {total} anúncio{total !== 1 ? 's' : ''} na biblioteca
        </span>
      </div>

      {/* ── Empty state ── */}
      {ads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
            <Megaphone size={22} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-on-surface">
              {query || nicheId || productId || status !== 'all'
                ? 'Nenhum anúncio encontrado com esses filtros'
                : 'Biblioteca vazia'}
            </p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              {query || nicheId || productId || status !== 'all'
                ? 'Tente ajustar os filtros ou a busca.'
                : 'Colete anúncios do Facebook nas abas de produto para populá-la.'}
            </p>
          </div>
          {(query || nicheId || productId || status !== 'all') && (
            <button
              onClick={() => { setQuery(''); setNicheId(''); setProductId(''); setStatus('all') }}
              className="text-xs text-brand hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Grid 3 colunas ── */}
      {ads.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {ads.map(ad => (
            <LibraryAdCard
              key={ad.id}
              ad={ad}
              onApprove={approve}
              onReject={reject}
              onReset={reset}
            />
          ))}
        </div>
      )}
    </div>
  )
}
