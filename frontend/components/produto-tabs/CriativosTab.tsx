'use client'
import { useState } from 'react'
import {
  Film, Download, Play, Loader2, AlertCircle,
  Wifi, Clock, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  useFinalVideos,
  isVideoActive,
  STATUS_PROGRESS,
  STATUS_LABEL,
  type FinalVideo,
  type FinalVideoStatus,
} from '@/hooks/useFinalVideos'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CriativosTabProps {
  sku:       string
  productId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(s: number | null): string {
  if (s == null) return '—'
  return `${Math.round(s)}s`
}

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

// ── Video card (prontos) ──────────────────────────────────────────────────────

function VideoCard({ video }: { video: FinalVideo }) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden group">
      {/* Player / Thumbnail */}
      <div className="relative aspect-[9/16] bg-surface-high overflow-hidden">
        {playing && video.video_url ? (
          <video
            src={video.video_url}
            controls
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt="Thumbnail"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film size={32} strokeWidth={1.5} className="text-on-surface-muted" />
              </div>
            )}

            {/* Play overlay */}
            {video.video_url && (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center
                  bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm
                  flex items-center justify-center border border-white/30">
                  <Play size={20} strokeWidth={1.5} className="text-white ml-0.5" fill="white" />
                </div>
              </button>
            )}

            {/* Duration badge */}
            {video.duration_seconds != null && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white
                text-[0.5625rem] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock size={8} strokeWidth={1.5} />
                {formatDuration(video.duration_seconds)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 space-y-2">
        <p className="text-[0.625rem] font-mono text-on-surface-muted truncate">
          {video.copy_combination_id.slice(0, 8)}…
        </p>

        <div className="flex items-center gap-2">
          {/* Player button */}
          {video.video_url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPlaying(p => !p)}
              className="flex-1 h-7 text-[0.625rem] text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
            >
              {playing
                ? <><Loader2 size={11} strokeWidth={1.5} className="mr-1" /> Pause</>
                : <><Play size={11} strokeWidth={1.5} className="mr-1" fill="currentColor" /> Play</>}
            </Button>
          )}

          {/* Download */}
          {video.video_url && (
            <a
              href={video.video_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[0.625rem] font-medium
                bg-surface-high text-on-surface-variant border border-white/5
                hover:bg-surface-highest hover:text-on-surface transition-all duration-150 shrink-0"
              title="Baixar vídeo"
            >
              <Download size={11} strokeWidth={1.5} />
              Baixar
            </a>
          )}
        </div>
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
