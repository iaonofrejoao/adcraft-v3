'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Search, Check, X, RotateCcw, Eye, Heart, Clock,
  Video, ExternalLink, Play, ChevronDown, Library,
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
  useVideoLibrary,
  type LibraryVideo,
  type LibraryStatusFilter,
} from '@/hooks/useVideoLibrary'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
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

const STATUS_LABELS: { id: LibraryStatusFilter; label: string }[] = [
  { id: 'all',      label: 'Todos'      },
  { id: 'pending',  label: 'Pendentes'  },
  { id: 'approved', label: 'Aprovados'  },
  { id: 'rejected', label: 'Rejeitados' },
]

// ── Video Card ─────────────────────────────────────────────────────────────────

interface LibraryCardProps {
  video:     LibraryVideo
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  onReset:   (id: string) => void
}

function LibraryCard({ video, onApprove, onReject, onReset }: LibraryCardProps) {
  const [imgError, setImgError] = useState(false)
  const [playing,  setPlaying]  = useState(false)

  const isApproved   = video.status === 'approved'
  const isRejected   = video.status === 'rejected'
  const isPending    = video.status === 'pending'
  const proxyUrl     = video.tiktok_url
    ? `/api/video-proxy?url=${encodeURIComponent(video.tiktok_url)}`
    : null
  // Usa a tiktok_url (página) no proxy — as thumbnail_url do CDN expiram em horas
  const thumbnailSrc = video.tiktok_url
    ? `/api/thumbnail-proxy?url=${encodeURIComponent(video.tiktok_url)}`
    : null

  return (
    <div className={cn(
      'bg-surface-container rounded-xl overflow-hidden transition-all duration-150 flex flex-col',
      'border',
      isApproved ? 'border-status-done-text/30'               :
      isRejected ? 'border-status-failed-text/20 opacity-60'  :
                   'border-white/5',
    )}>
      {/* Thumbnail / Player */}
      <div className="relative aspect-[9/16] bg-black overflow-hidden shrink-0">
        {playing && proxyUrl ? (
          <>
            <video
              key={proxyUrl}
              src={proxyUrl}
              className="w-full h-full object-contain"
              autoPlay controls playsInline loop
            />
            <button
              onClick={() => setPlaying(false)}
              className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center z-20 transition-colors duration-150"
            >
              <X size={12} strokeWidth={2.5} className="text-white" />
            </button>
          </>
        ) : (
          <>
            {thumbnailSrc && !imgError ? (
              <img
                src={thumbnailSrc}
                alt={video.author_handle ?? 'TikTok'}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video size={24} strokeWidth={1.5} className="text-on-surface-muted" />
              </div>
            )}

            {proxyUrl && (
              <button
                onClick={() => setPlaying(true)}
                onMouseEnter={() => {
                  fetch(`/api/video-proxy?url=${encodeURIComponent(video.tiktok_url)}&warm=1`)
                    .catch(() => {})
                }}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/75 transition-colors duration-150">
                  <Play size={14} strokeWidth={1.5} fill="white" className="text-white ml-0.5" />
                </div>
              </button>
            )}

            {/* Status indicator */}
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

            {/* Duração */}
            {video.duration_seconds != null && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[0.5rem] font-mono px-1 py-0.5 rounded flex items-center gap-0.5">
                <Clock size={7} strokeWidth={1.5} />
                {video.duration_seconds}s
              </div>
            )}

            {/* Produto badge */}
            {video.product_name && (
              <div className="absolute top-2 left-2 max-w-[70%]">
                <span className="bg-black/70 text-white text-[0.5rem] font-medium px-1.5 py-0.5 rounded truncate block">
                  {video.product_name}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5 flex flex-col flex-1">
        {/* Nicho */}
        {video.niche_name && (
          <span className="text-[0.5rem] font-medium tracking-wide uppercase text-brand/70">
            {video.niche_name}
          </span>
        )}

        {/* Author + score */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[0.625rem] font-medium text-on-surface truncate">
            @{video.author_handle ?? 'desconhecido'}
          </span>
          <ScoreBadge score={video.relevance_score} />
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-2 text-[0.5625rem] font-mono text-on-surface-muted">
          <span className="flex items-center gap-0.5">
            <Eye size={9} strokeWidth={1.5} />
            {formatCount(video.views_count)}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={9} strokeWidth={1.5} />
            {formatCount(video.likes_count)}
          </span>
        </div>

        {/* Descrição */}
        {video.description && (
          <p className="text-[0.5625rem] text-on-surface-muted/70 leading-relaxed line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Ações */}
        <div className="flex items-center gap-1 pt-0.5 mt-auto">
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(video.id)}
                className="flex-1 h-6 text-[0.5625rem] bg-status-done text-status-done-text hover:opacity-90 border-0 px-1"
              >
                <Check size={10} strokeWidth={2} className="mr-0.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(video.id)}
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
              onClick={() => onReject(video.id)}
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
              onClick={() => onReset(video.id)}
              className="flex-1 h-6 text-[0.5625rem] text-on-surface-muted hover:text-on-surface px-1"
            >
              <RotateCcw size={9} strokeWidth={1.5} className="mr-0.5" />
              Restaurar
            </Button>
          )}
          <a
            href={video.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-surface-high transition-colors duration-150 shrink-0"
            title="Abrir no TikTok"
          >
            <ExternalLink size={10} strokeWidth={1.5} className="text-on-surface-muted" />
          </a>
          {video.product_sku && (
            <Link
              href={`/products/${video.product_sku}/video`}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Ver produto"
            >
              <ChevronDown size={10} strokeWidth={1.5} className="text-on-surface-muted -rotate-90" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function LibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 bg-surface-container" />
        <Skeleton className="h-9 w-40 bg-surface-container" />
        <Skeleton className="h-9 w-40 bg-surface-container" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
            <Skeleton className="aspect-[9/16] w-full bg-surface-highest" />
            <div className="p-2.5 space-y-2">
              <Skeleton className="h-2.5 w-2/3 bg-surface-highest" />
              <Skeleton className="h-2.5 w-1/2 bg-surface-highest" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Select customizado ─────────────────────────────────────────────────────────

interface FilterSelectProps {
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  options:     { id: string; name: string }[]
}

function FilterSelect({ value, onChange, placeholder, options }: FilterSelectProps) {
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
      <DropdownMenuContent
        align="start"
        className="bg-surface-highest border-white/10 min-w-[200px] max-h-64 overflow-y-auto"
      >
        <DropdownMenuItem
          onClick={() => onChange('')}
          className={cn(
            'text-[0.8125rem] cursor-pointer',
            !value ? 'text-brand' : 'text-on-surface-variant',
          )}
        >
          {placeholder}
        </DropdownMenuItem>
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              'text-[0.8125rem] cursor-pointer truncate',
              value === opt.id ? 'text-brand' : 'text-on-surface',
            )}
          >
            {opt.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function VideoLibraryPage() {
  const {
    videos, total, isLoading,
    niches, products,
    query,     setQuery,
    nicheId,   setNicheId,
    productId, setProductId,
    status,    setStatus,
    counts,
    approve, reject, reset,
  } = useVideoLibrary()

  if (isLoading) return <LibrarySkeleton />

  return (
    <div className="space-y-5">
      {/* ── Toolbar principal ── */}
      <div className="flex items-center gap-3">
        {/* Busca semântica */}
        <div className="relative flex-1">
          <Search
            size={15}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por descrição, autor, hashtag…"
            className={cn(
              'w-full h-9 rounded-lg border border-white/5 bg-surface-container pl-9 pr-3',
              'text-sm text-on-surface placeholder:text-on-surface-muted/50',
              'outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all duration-150',
            )}
          />
        </div>

        {/* Filtro nicho */}
        <FilterSelect
          value={nicheId}
          onChange={setNicheId}
          placeholder="Todos os nichos"
          options={niches}
        />

        {/* Filtro produto */}
        <FilterSelect
          value={productId}
          onChange={setProductId}
          placeholder="Todos os produtos"
          options={products}
        />
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
          {total} vídeo{total !== 1 ? 's' : ''} na biblioteca
        </span>
      </div>

      {/* ── Empty state ── */}
      {videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
            <Library size={22} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-on-surface">
              {query || nicheId || productId || status !== 'all'
                ? 'Nenhum vídeo encontrado com esses filtros'
                : 'Biblioteca vazia'}
            </p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              {query || nicheId || productId || status !== 'all'
                ? 'Tente ajustar os filtros ou a busca.'
                : 'Colete vídeos TikTok nas abas de produto para populá-la.'}
            </p>
          </div>
          {(query || nicheId || productId || status !== 'all') && (
            <button
              onClick={() => {
                setQuery('')
                setNicheId('')
                setProductId('')
                setStatus('all')
              }}
              className="text-xs text-brand hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Grid 5 colunas ── */}
      {videos.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {videos.map(video => (
            <LibraryCard
              key={video.id}
              video={video}
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
