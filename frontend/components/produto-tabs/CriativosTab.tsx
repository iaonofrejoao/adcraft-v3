'use client'
import { useCallback, useRef, useState } from 'react'
import {
  Film, Download, AlertCircle,
  Wifi, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useFinalVideos,
  isVideoActive,
  STATUS_PROGRESS,
  STATUS_LABEL,
  type FinalVideo,
  type FinalVideoStatus,
  type SceneClip,
} from '@/hooks/useFinalVideos'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CriativosTabProps {
  sku:       string
  productId: string
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ status, step }: { status: FinalVideoStatus; step: string | null }) {
  const pct   = STATUS_PROGRESS[status]
  const label = step ?? STATUS_LABEL[status]

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] text-on-surface-variant truncate">{label}</span>
        <span className="text-[0.6875rem] font-mono text-brand shrink-0">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-highest overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F28705] to-[#FFB690] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Queue row (fila + gerando) ────────────────────────────────────────────────

function QueueRow({ video }: { video: FinalVideo }) {
  const isActive  = isVideoActive(video.status)
  const isQueued  = video.status === 'queued'
  const isFailed  = video.status === 'failed'

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 transition-colors duration-150',
      isFailed  ? 'bg-surface-container border-status-failed-text/20' :
      isActive  ? 'bg-surface-container border-brand/20'              :
                  'bg-surface-container border-white/5',
    )}>
      <div className="flex items-center justify-between gap-3">
        {/* Combo tag derivado do ID */}
        <span className="font-mono text-[0.6875rem] text-on-surface-muted truncate max-w-[240px]">
          {video.copy_combination_id.slice(0, 8)}…
        </span>

        {/* Status badge */}
        {isQueued && (
          <span className="flex items-center gap-1.5 text-[0.6875rem] text-on-surface-muted bg-surface-highest px-2 py-0.5 rounded-full shrink-0">
            <Clock size={10} strokeWidth={1.5} />
            Na fila
          </span>
        )}
        {isActive && (
          <span className="flex items-center gap-1.5 text-[0.6875rem] text-status-running-text bg-status-running px-2 py-0.5 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-status-running-text animate-pulse" />
            Gerando
          </span>
        )}
        {isFailed && (
          <span className="flex items-center gap-1.5 text-[0.6875rem] text-status-failed-text bg-status-failed px-2 py-0.5 rounded-full shrink-0">
            <AlertCircle size={10} strokeWidth={1.5} />
            Falhou
          </span>
        )}
      </div>

      {/* Progress bar para vídeos ativos */}
      {isActive && (
        <ProgressBar status={video.status} step={video.progress_step} />
      )}

      {/* Mensagem de erro */}
      {isFailed && video.error_message && (
        <p className="mt-2 text-[0.625rem] text-status-failed-text/80 font-mono leading-relaxed">
          {video.error_message}
        </p>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_PT: Record<string, string> = {
  hook:      'Hook',
  problem:   'Problema',
  agitation: 'Agitação',
  mechanism: 'Mecanismo',
  proof:     'Prova',
  offer:     'Oferta',
  cta:       'CTA',
  intro:     'Intro',
  body:      'Corpo',
}

function proxyUrl(localPath: string): string {
  return `/api/video-serve?path=${encodeURIComponent(localPath)}`
}

// ── Video card (prontos) ──────────────────────────────────────────────────────

function VideoCard({ video }: { video: FinalVideo }) {
  const okScenes  = (video.scenes ?? []).filter(s => s.status === 'ok')
  const [idx, setIdx] = useState(0)
  const videoRef      = useRef<HTMLVideoElement>(null)

  const current = okScenes[idx] as SceneClip | undefined
  const src     = current ? proxyUrl(current.local_path) : null

  const goTo = useCallback((next: number) => {
    setIdx(next)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = 0.1
  }, [])

  const hasScenes = okScenes.length > 0

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">

      {/* ── Player ── */}
      <div className="relative aspect-[9/16] bg-surface-high overflow-hidden">
        {hasScenes && src ? (
          <>
            <video
              ref={videoRef}
              key={src}
              src={src}
              controls
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Badges topo */}
            <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
              <span className="bg-black/60 text-white text-[0.5rem] font-mono px-1.5 py-0.5 rounded">
                {idx + 1}/{okScenes.length}
              </span>
              {current && (
                <span className="bg-brand/80 text-white text-[0.5rem] px-1.5 py-0.5 rounded">
                  {SECTION_PT[current.section] ?? current.section}
                </span>
              )}
            </div>

            {/* Navegação prev/next */}
            {okScenes.length > 1 && (
              <>
                <button
                  onClick={() => goTo(Math.max(0, idx - 1))}
                  disabled={idx === 0}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2
                    w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10
                    flex items-center justify-center transition-opacity duration-150
                    disabled:opacity-0 hover:bg-black/70"
                >
                  <ChevronLeft size={14} strokeWidth={1.5} className="text-white" />
                </button>
                <button
                  onClick={() => goTo(Math.min(okScenes.length - 1, idx + 1))}
                  disabled={idx === okScenes.length - 1}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2
                    w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/10
                    flex items-center justify-center transition-opacity duration-150
                    disabled:opacity-0 hover:bg-black/70"
                >
                  <ChevronRight size={14} strokeWidth={1.5} className="text-white" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Film size={28} strokeWidth={1.5} className="text-on-surface-muted" />
            <span className="text-[0.5625rem] text-on-surface-muted">Sem clips disponíveis</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-3 space-y-2.5">

        {/* Combo tag */}
        <p className="text-[0.5rem] font-mono text-on-surface-muted truncate">
          {video.copy_combination_id.slice(0, 8)}…
        </p>

        {/* Seletor de cenas */}
        {okScenes.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {okScenes.map((s, i) => (
              <button
                key={s.scene_number}
                onClick={() => goTo(i)}
                className={cn(
                  'text-[0.5rem] font-mono px-1.5 py-0.5 rounded transition-colors duration-100',
                  i === idx
                    ? 'bg-brand text-white'
                    : 'bg-surface-high text-on-surface-muted hover:bg-surface-highest hover:text-on-surface',
                )}
              >
                {s.scene_number}
              </button>
            ))}
          </div>
        )}

        {/* Download da cena atual */}
        {src && current && (
          <a
            href={src}
            download={current.drive_filename}
            className="flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md text-[0.5625rem] font-medium w-full
              bg-surface-high text-on-surface-variant border border-white/5
              hover:bg-surface-highest hover:text-on-surface transition-all duration-150"
          >
            <Download size={11} strokeWidth={1.5} />
            Baixar cena {idx + 1}
          </a>
        )}

        {/* Cenas com falha */}
        {(video.scenes ?? []).some(s => s.status === 'failed') && (
          <div className="flex items-center gap-1.5 text-[0.5rem] text-status-failed-text">
            <AlertCircle size={10} strokeWidth={1.5} />
            {(video.scenes ?? []).filter(s => s.status === 'failed').length} cena(s) com falha
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  accent,
}: {
  label:  string
  count:  number
  accent?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className={cn('text-xs font-semibold uppercase tracking-widest', accent ?? 'text-on-surface-muted')}>
        {label}
      </h3>
      <span className={cn(
        'text-[0.625rem] font-mono px-1.5 py-0.5 rounded-full',
        accent ? `${accent} bg-surface-high` : 'text-on-surface-muted bg-surface-high',
      )}>
        {count}
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function CriativosTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 bg-surface-highest" />
        {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-surface-highest" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
            <Skeleton className="aspect-[9/16] w-full bg-surface-highest" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-2/3 bg-surface-highest" />
              <Skeleton className="h-6 w-full bg-surface-highest rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CriativosTab({ sku, productId }: CriativosTabProps) {
  const { videos, isLoading, personaReady } = useFinalVideos(sku, productId)
  const [realtimeDot] = useState(true)

  if (isLoading) return <CriativosTabSkeleton />

  const queued  = videos.filter(v => v.status === 'queued')
  const active  = videos.filter(v => isVideoActive(v.status))
  const ready   = videos.filter(v => v.status === 'ready')
  const failed  = videos.filter(v => v.status === 'failed')

  const isEmpty = videos.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum criativo na fila ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            {personaReady
              ? 'Vá à aba Copies, clique em "Gerar Vídeo" em cada combinação e depois execute o orquestrador.'
              : 'Configure a persona do produto antes de gerar vídeos.'}
          </p>
        </div>
        {!personaReady && (
          <span className="text-[0.625rem] text-status-failed-text bg-status-failed px-3 py-1.5 rounded-lg">
            Persona não configurada — execute setup-persona.ts
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Indicador Realtime ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[0.625rem] text-on-surface-muted">
          <Wifi size={11} strokeWidth={1.5} className={realtimeDot ? 'text-status-done-text' : 'text-on-surface-muted'} />
          Atualizações em tempo real
        </div>
        {!personaReady && (
          <span className="text-[0.625rem] text-status-paused-text bg-status-paused px-2.5 py-1 rounded-lg flex items-center gap-1">
            <AlertCircle size={10} strokeWidth={1.5} />
            Persona não configurada
          </span>
        )}
      </div>

      {/* ── Em fila ── */}
      {queued.length > 0 && (
        <section>
          <SectionHeader label="Em fila" count={queued.length} />
          <div className="space-y-2">
            {queued.map(v => <QueueRow key={v.id} video={v} />)}
          </div>
        </section>
      )}

      {/* ── Gerando ── */}
      {active.length > 0 && (
        <section>
          <SectionHeader label="Gerando" count={active.length} accent="text-status-running-text" />
          <div className="space-y-2">
            {active.map(v => <QueueRow key={v.id} video={v} />)}
          </div>
        </section>
      )}

      {/* ── Prontos ── */}
      {ready.length > 0 && (
        <section>
          <SectionHeader label="Prontos" count={ready.length} accent="text-status-done-text" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ready.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}

      {/* ── Falharam ── */}
      {failed.length > 0 && (
        <section>
          <SectionHeader label="Falharam" count={failed.length} accent="text-status-failed-text" />
          <div className="space-y-2">
            {failed.map(v => <QueueRow key={v.id} video={v} />)}
          </div>
        </section>
      )}

    </div>
  )
}
