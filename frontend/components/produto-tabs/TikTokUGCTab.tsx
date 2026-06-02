'use client'
import { useState } from 'react'
import {
  Check, X, RotateCcw, Eye, Heart, Clock, Star,
  Video, RefreshCw, ExternalLink, Filter, Play, Download, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useTikTokVideos,
  type TikTokVideo,
  type TikTokStatusFilter,
} from '@/hooks/useTikTokVideos'

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
    <span className={cn('text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded', color)}>
      {pct}%
    </span>
  )
}

const STATUS_FILTER_LABELS: { id: TikTokStatusFilter; label: string }[] = [
  { id: 'all',      label: 'Todos'     },
  { id: 'pending',  label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'rejected', label: 'Rejeitados'},
]

// ── Video Card ─────────────────────────────────────────────────────────────────

interface VideoCardProps {
  video:   TikTokVideo
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  onReset:   (id: string) => void
  inUse?: boolean
}

function VideoCard({ video, onApprove, onReject, onReset, inUse }: VideoCardProps) {
  const [imgError, setImgError] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)

  const isApproved = video.status === 'approved'
  const isRejected = video.status === 'rejected'
  const isPending  = video.status === 'pending'
  const canPlay    = !!video.video_url

  return (
    <div className={cn(
      'bg-surface-container border rounded-xl overflow-hidden transition-all duration-150',
      isApproved ? 'border-status-done-text/30'    :
      isRejected ? 'border-status-failed-text/20 opacity-60' :
                   'border-white/5',
    )}>
      {/* Thumbnail / Player */}
      <div className="relative aspect-[9/16] bg-black overflow-hidden">
        {playerOpen && canPlay ? (
          <>
            <video
              src={video.video_url!}
              className="w-full h-full object-contain"
              autoPlay
              controls
              playsInline
              loop
            />
            <button
              onClick={() => setPlayerOpen(false)}
              className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center z-10 transition-colors duration-150"
              title="Fechar player"
            >
              <X size={11} strokeWidth={2} className="text-white" />
            </button>
          </>
        ) : (
          <>
            {video.thumbnail_url && !imgError ? (
              <img
                src={video.thumbnail_url}
                alt={video.author_handle ?? 'TikTok'}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video size={28} strokeWidth={1.5} className="text-on-surface-muted" />
              </div>
            )}

            {/* Play button overlay */}
            {canPlay && (
              <button
                onClick={() => setPlayerOpen(true)}
                className="absolute inset-0 flex items-center justify-center group"
                title="Reproduzir vídeo"
              >
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/75 transition-colors duration-150">
                  <Play size={16} strokeWidth={1.5} fill="white" className="text-white ml-0.5" />
                </div>
              </button>
            )}

            {/* Status overlay */}
            {isApproved && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-status-done flex items-center justify-center">
                <Check size={12} strokeWidth={2} className="text-status-done-text" />
              </div>
            )}
            {isRejected && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-status-failed flex items-center justify-center">
                <X size={12} strokeWidth={2} className="text-status-failed-text" />
              </div>
            )}

            {/* "Em uso" badge */}
            {inUse && (
              <div className="absolute top-2 left-2 bg-brand/90 text-on-primary text-[0.5625rem] font-bold px-1.5 py-0.5 rounded">
                Em uso
              </div>
            )}

            {/* Duration */}
            {video.duration_seconds != null && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[0.5625rem] font-mono px-1 py-0.5 rounded flex items-center gap-0.5">
                <Clock size={8} strokeWidth={1.5} />
                {video.duration_seconds}s
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Author + score */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-on-surface truncate">
            @{video.author_handle ?? 'desconhecido'}
          </span>
          <ScoreBadge score={video.relevance_score} />
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-[0.625rem] font-mono text-on-surface-muted">
          <span className="flex items-center gap-1">
            <Eye size={10} strokeWidth={1.5} />
            {formatCount(video.views_count)}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={10} strokeWidth={1.5} />
            {formatCount(video.likes_count)}
          </span>
          {video.relevance_score != null && (
            <span className="flex items-center gap-1">
              <Star size={10} strokeWidth={1.5} />
              relevância
            </span>
          )}
        </div>

        {/* Description snippet */}
        {video.description && (
          <p className="text-[0.625rem] text-on-surface-muted/70 leading-relaxed line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(video.id)}
                className="flex-1 h-7 text-[0.625rem] bg-status-done text-status-done-text hover:opacity-90 border-0"
              >
                <Check size={11} strokeWidth={2} className="mr-1" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(video.id)}
                className="flex-1 h-7 text-[0.625rem] text-status-failed-text hover:bg-status-failed"
              >
                <X size={11} strokeWidth={2} className="mr-1" />
                Rejeitar
              </Button>
            </>
          )}
          {isApproved && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(video.id)}
              className="flex-1 h-7 text-[0.625rem] text-on-surface-muted hover:text-status-failed-text"
            >
              <X size={11} strokeWidth={2} className="mr-1" />
              Rejeitar
            </Button>
          )}
          {isRejected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReset(video.id)}
              className="flex-1 h-7 text-[0.625rem] text-on-surface-muted hover:text-on-surface"
            >
              <RotateCcw size={11} strokeWidth={1.5} className="mr-1" />
              Restaurar
            </Button>
          )}
          <a
            href={video.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-surface-high transition-colors duration-150 shrink-0"
            title="Abrir no TikTok"
          >
            <ExternalLink size={11} strokeWidth={1.5} className="text-on-surface-muted" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Scrape Dialog ─────────────────────────────────────────────────────────────

interface ScrapeUGCDialogProps {
  sku:      string
  open:     boolean
  onClose:  () => void
  onDone:   () => void
}

function ScrapeUGCDialog({ sku, open, onClose, onDone }: ScrapeUGCDialogProps) {
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const q = query.trim()
    if (!q) { toast.error('Digite pelo menos uma hashtag'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/products/${sku}/scrape-ugc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, max: 20 }),
        signal: AbortSignal.timeout(310_000),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erro desconhecido')
      toast.success(`${data.count} vídeo${data.count !== 1 ? 's' : ''} coletado${data.count !== 1 ? 's' : ''} com sucesso`)
      onDone()
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Falha ao coletar vídeos')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!loading && !isOpen) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-container border-white/10 text-on-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Coletar vídeos TikTok</DialogTitle>
          <DialogDescription className="text-on-surface-variant text-sm">
            O script vai buscar até 20 vídeos nas hashtags informadas via Apify e salvá-los para revisão.
            Isso leva entre 30 e 90 segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">
              Hashtags / palavras-chave
            </label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading) handleConfirm() }}
              placeholder="ex: emagrecimento termogenico suplemento"
              disabled={loading}
              className={cn(
                'w-full rounded-lg border border-white/10 bg-surface-high px-3 py-2',
                'text-sm text-on-surface placeholder:text-on-surface-muted/50',
                'outline-none focus:border-brand/60 transition-colors',
                loading && 'opacity-50 pointer-events-none',
              )}
            />
            <p className="text-[0.6875rem] text-on-surface-muted">
              Separe por espaço. Serão buscados vídeos para cada hashtag.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-on-surface-variant hover:text-on-surface"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading || !query.trim()}
            className="bg-brand text-on-primary hover:opacity-90 border-0"
          >
            {loading ? (
              <>
                <Loader2 size={13} strokeWidth={1.5} className="mr-1.5 animate-spin" />
                Coletando…
              </>
            ) : (
              <>
                <Download size={13} strokeWidth={1.5} className="mr-1.5" />
                Confirmar e coletar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

export function TikTokUGCTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1,2,3,4].map(i => (
          <Skeleton key={i} className="h-7 w-20 rounded-lg bg-surface-highest" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
            <Skeleton className="aspect-[9/16] w-full bg-surface-highest" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-2/3 bg-surface-highest" />
              <Skeleton className="h-3 w-1/2 bg-surface-highest" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export interface TikTokUGCTabProps {
  sku:        string
  inUseIds?:  Set<string>
}

export function TikTokUGCTab({ sku, inUseIds }: TikTokUGCTabProps) {
  const { videos, isLoading, filter, setFilter, approve, reject, reset, refresh, counts } =
    useTikTokVideos(sku)

  const [scrapeOpen, setScrapeOpen] = useState(false)

  if (isLoading) return <TikTokUGCTabSkeleton />

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          <Filter size={13} strokeWidth={1.5} className="text-on-surface-muted mr-1" />
          {STATUS_FILTER_LABELS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium transition-all duration-150',
                filter === id
                  ? 'bg-surface-high text-on-surface'
                  : 'text-on-surface-muted hover:text-on-surface-variant hover:bg-surface-container',
              )}
            >
              {label}
              <span className={cn(
                'text-[0.5625rem] font-mono px-1 py-0.5 rounded',
                filter === id ? 'bg-brand/20 text-brand' : 'bg-surface-high text-on-surface-muted',
              )}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            title="Recarregar"
            className="flex items-center gap-1.5 text-[0.6875rem] text-on-surface-muted hover:text-on-surface transition-colors duration-150"
          >
            <RefreshCw size={13} strokeWidth={1.5} />
            Recarregar
          </button>

          <Button
            size="sm"
            onClick={() => setScrapeOpen(true)}
            className="h-7 px-3 text-[0.6875rem] font-medium bg-brand text-on-primary hover:opacity-90 border-0"
          >
            <Download size={13} strokeWidth={1.5} className="mr-1.5" />
            Coletar UGC
          </Button>
        </div>
      </div>

      <ScrapeUGCDialog
        sku={sku}
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onDone={refresh}
      />

      {/* ── Empty state ── */}
      {videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full bg-surface-high flex items-center justify-center">
            <Video size={20} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-on-surface">
              {filter === 'all'
                ? 'Nenhum vídeo TikTok coletado ainda'
                : `Nenhum vídeo ${filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}`}
            </p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              {filter === 'all'
                ? 'Execute o script de scraping para coletar UGC do TikTok por hashtag e nicho do produto.'
                : 'Altere o filtro para ver vídeos em outros estados.'}
            </p>
          </div>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-brand hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {videos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {videos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              onApprove={approve}
              onReject={reject}
              onReset={reset}
              inUse={inUseIds?.has(video.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
