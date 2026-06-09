'use client'
import { useState } from 'react'
import {
  Check, X, RotateCcw, ExternalLink, RefreshCw, Filter,
  Download, Loader2, Image, Play, Calendar, Clock, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  useFacebookAds,
  type FbAd,
  type FbAdStatusFilter,
} from '@/hooks/useFacebookAds'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const pct   = Math.round(score * 100)
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

function DaysRunningBadge({ days, stopped }: { days: number | null; stopped: string | null }) {
  if (days == null) return null
  const isActive = !stopped
  return (
    <span className={cn(
      'flex items-center gap-1 text-[0.625rem] font-mono px-1.5 py-0.5 rounded',
      isActive
        ? 'bg-status-done/20 text-status-done-text'
        : 'bg-surface-high text-on-surface-muted',
    )}>
      <Clock size={8} strokeWidth={1.5} />
      {days}d {isActive ? 'ativo' : 'encerrado'}
    </span>
  )
}

function PlatformBadges({ platforms }: { platforms: string[] }) {
  if (!platforms?.length) return null
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {platforms.map(p => (
        <span
          key={p}
          className="text-[0.5rem] font-mono uppercase tracking-wide px-1 py-0.5 rounded bg-surface-high text-on-surface-muted"
        >
          {p === 'facebook' ? 'FB' : p === 'instagram' ? 'IG' : p === 'audience_network' ? 'AN' : p}
        </span>
      ))}
    </div>
  )
}

const STATUS_FILTER_LABELS: { id: FbAdStatusFilter; label: string }[] = [
  { id: 'all',      label: 'Todos'      },
  { id: 'pending',  label: 'Pendentes'  },
  { id: 'approved', label: 'Aprovados'  },
  { id: 'rejected', label: 'Rejeitados' },
]

// ── Ad Card ───────────────────────────────────────────────────────────────────

interface AdCardProps {
  ad:        FbAd
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  onReset:   (id: string) => void
}

function proxyThumb(url: string | null): string | null {
  if (!url) return null
  if (url.includes('.fbcdn.net')) return `/api/thumbnail-proxy?url=${encodeURIComponent(url)}`
  return url
}

function AdCard({ ad, onApprove, onReject, onReset }: AdCardProps) {
  const [imgError, setImgError] = useState(false)

  const isApproved = ad.status === 'approved'
  const isRejected = ad.status === 'rejected'
  const isPending  = ad.status === 'pending'

  const thumb = proxyThumb(ad.image_url)

  return (
    <div className={cn(
      'bg-surface-container border rounded-xl overflow-hidden transition-all duration-150 flex flex-col',
      isApproved ? 'border-status-done-text/30'              :
      isRejected ? 'border-status-failed-text/20 opacity-60' :
                   'border-white/5',
    )}>
      {/* Thumbnail / mídia */}
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
            <Image size={24} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
        )}

        {/* Badges de status no canto */}
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

        {/* Badge de tipo de mídia */}
        {ad.media_type === 'video' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-[0.5rem] font-mono px-1.5 py-0.5 rounded">
            <Play size={8} strokeWidth={1.5} />
            VÍDEO
          </div>
        )}
        {ad.media_type === 'carousel' && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[0.5rem] font-mono px-1.5 py-0.5 rounded">
            CARROSSEL
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3 space-y-2 flex flex-col flex-1">
        {/* Page name + score */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[0.6875rem] font-semibold text-on-surface leading-tight truncate">
            {ad.page_name ?? 'Anunciante desconhecido'}
          </span>
          <ScoreBadge score={ad.relevance_score} />
        </div>

        {/* Headline */}
        {ad.headline && (
          <p className="text-[0.6875rem] font-medium text-on-surface-variant leading-snug line-clamp-2">
            {ad.headline}
          </p>
        )}

        {/* Copy snippet */}
        {ad.ad_copy && (
          <p className="text-[0.625rem] text-on-surface-muted/70 leading-relaxed line-clamp-3">
            {ad.ad_copy}
          </p>
        )}

        {/* Meta: dias no ar + plataformas */}
        <div className="flex items-center gap-2 flex-wrap">
          <DaysRunningBadge days={ad.days_running} stopped={ad.stopped_at} />
          <PlatformBadges platforms={ad.platforms ?? []} />
          {ad.cta_text && (
            <span className="text-[0.5rem] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand/10 text-brand">
              {ad.cta_text}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Ações */}
        <div className="flex items-center gap-2 pt-1">
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(ad.id)}
                className="flex-1 h-7 text-[0.625rem] bg-status-done text-status-done-text hover:opacity-90 border-0"
              >
                <Check size={11} strokeWidth={2} className="mr-1" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(ad.id)}
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
              onClick={() => onReject(ad.id)}
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
              onClick={() => onReset(ad.id)}
              className="flex-1 h-7 text-[0.625rem] text-on-surface-muted hover:text-on-surface"
            >
              <RotateCcw size={11} strokeWidth={1.5} className="mr-1" />
              Restaurar
            </Button>
          )}
          {ad.destination_url && (
            <a
              href={ad.destination_url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Abrir landing page"
            >
              <Globe size={11} strokeWidth={1.5} className="text-on-surface-muted" />
            </a>
          )}
          {ad.fb_ad_id && (
            <a
              href={`https://www.facebook.com/ads/library/?id=${ad.fb_ad_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-surface-high transition-colors duration-150 shrink-0"
              title="Ver no Ads Library"
            >
              <ExternalLink size={11} strokeWidth={1.5} className="text-on-surface-muted" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Scrape Dialog ─────────────────────────────────────────────────────────────

interface ScrapeFbDialogProps {
  sku:     string
  open:    boolean
  onClose: () => void
  onDone:  () => void
}

function ScrapeFbDialog({ sku, open, onClose, onDone }: ScrapeFbDialogProps) {
  const [query,   setQuery]   = useState('')
  const [country, setCountry] = useState('US')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const q = query.trim()
    if (!q) { toast.error('Digite pelo menos uma palavra-chave'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/products/${sku}/scrape-fb-ads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, country, max: 20 }),
        signal:  AbortSignal.timeout(310_000),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erro desconhecido')
      toast.success(`${data.count} anúncio${data.count !== 1 ? 's' : ''} coletado${data.count !== 1 ? 's' : ''} com sucesso`)
      onDone()
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Falha ao coletar anúncios')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!loading && !isOpen) onClose()
  }

  const inputCn = cn(
    'w-full rounded-lg border border-white/10 bg-surface-high px-3 py-2',
    'text-sm text-on-surface placeholder:text-on-surface-muted/50',
    'outline-none focus:border-brand/60 transition-colors',
    loading && 'opacity-50 pointer-events-none',
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-container border-white/10 text-on-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Coletar anúncios do Facebook</DialogTitle>
          <DialogDescription className="text-on-surface-variant text-sm">
            Busca anúncios ativos na Facebook Ads Library via Apify.
            O score de relevância usa os dias no ar como principal sinal de performance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">
              Palavras-chave de busca
            </label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading) handleConfirm() }}
              placeholder="ex: fat burner thermogenic weight loss"
              disabled={loading}
              className={inputCn}
            />
            <p className="text-[0.6875rem] text-on-surface-muted">
              Use termos em inglês para melhores resultados no mercado americano.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">
              País
            </label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              disabled={loading}
              className={cn(inputCn, 'cursor-pointer')}
            >
              <option value="US">🇺🇸 Estados Unidos</option>
              <option value="BR">🇧🇷 Brasil</option>
              <option value="GB">🇬🇧 Reino Unido</option>
              <option value="AU">🇦🇺 Austrália</option>
              <option value="CA">🇨🇦 Canadá</option>
            </select>
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function FacebookAdsTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-7 w-20 rounded-lg bg-surface-highest" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
            <Skeleton className="aspect-video w-full bg-surface-highest" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-3/4 bg-surface-highest" />
              <Skeleton className="h-3 w-full bg-surface-highest" />
              <Skeleton className="h-3 w-2/3 bg-surface-highest" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export interface FacebookAdsTabProps {
  sku: string
}

export function FacebookAdsTab({ sku }: FacebookAdsTabProps) {
  const { ads, isLoading, filter, setFilter, approve, reject, reset, refresh, counts } =
    useFacebookAds(sku)

  const [scrapeOpen, setScrapeOpen] = useState(false)

  if (isLoading) return <FacebookAdsTabSkeleton />

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
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
            Coletar Anúncios
          </Button>
        </div>
      </div>

      <ScrapeFbDialog
        sku={sku}
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onDone={refresh}
      />

      {/* ── Legenda de score ── */}
      {ads.length > 0 && (
        <div className="flex items-center gap-3 text-[0.6375rem] text-on-surface-muted bg-surface-container border border-white/5 rounded-lg px-3 py-2">
          <Calendar size={11} strokeWidth={1.5} className="shrink-0" />
          <span>
            Score = <span className="text-on-surface-variant">60% dias no ar</span>
            {' + '}
            <span className="text-on-surface-variant">30% relevância de keywords</span>
            {' + '}
            <span className="text-on-surface-variant">10% tipo de mídia</span>.
            Anúncios ativos há 30+ dias são fortes sinais de conversão.
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {ads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full bg-surface-high flex items-center justify-center">
            <Image size={20} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-on-surface">
              {filter === 'all'
                ? 'Nenhum anúncio do Facebook coletado ainda'
                : `Nenhum anúncio ${filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}`}
            </p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              {filter === 'all'
                ? 'Clique em "Coletar Anúncios" para buscar anúncios concorrentes na Facebook Ads Library.'
                : 'Altere o filtro para ver anúncios em outros estados.'}
            </p>
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-brand hover:underline">
              Ver todos
            </button>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {ads.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {ads.map(ad => (
            <AdCard
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
