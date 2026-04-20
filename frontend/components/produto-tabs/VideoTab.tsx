'use client'
import { useEffect, useState } from 'react'
import { Film, Grid3x3, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StoryboardTab, StoryboardCard, fetchCreativeEntries } from './StoryboardTab'
import type { StoryboardEntry } from './StoryboardTab'
import { toast } from 'sonner'

/* ── Types ─────────────────────────────────────────────────────────── */
type SubTab = 'storyboard' | 'criativos'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'storyboard', label: 'Storyboard', icon: <Grid3x3 size={13} strokeWidth={1.5} /> },
  { id: 'criativos',  label: 'Criativos',  icon: <Film     size={13} strokeWidth={1.5} /> },
]

/* ── Criativo card (video gerado + storyboard colapsável) ───────────── */
function CriativoCard({ entry }: { entry: StoryboardEntry }) {
  const [boardExpanded, setBoardExpanded] = useState(false)
  const videoUrl = (entry.video?.artifact_data as any)?.video_url as string

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <Film size={15} strokeWidth={1.5} className="text-brand shrink-0" />
        <span className="text-sm font-semibold text-on-surface font-mono">{entry.tag}</span>
        {(entry.video?.artifact_data as any)?.aspect_ratio && (
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {(entry.video?.artifact_data as any).aspect_ratio}
          </span>
        )}
        {(entry.video?.artifact_data as any)?.platform && (
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {(entry.video?.artifact_data as any).platform}
          </span>
        )}
      </div>

      {/* Video player */}
      <div className="p-4 border-b border-white/5">
        <video
          src={videoUrl}
          controls
          className="w-full rounded-lg bg-black max-h-[480px] object-contain"
        />
      </div>

      {/* Collapsible storyboard */}
      <button
        onClick={() => setBoardExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-high/30 transition-colors text-left"
      >
        <Grid3x3 size={12} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
        <span className="text-[0.6875rem] text-on-surface-muted">Ver storyboard original</span>
        <span className="ml-auto">
          {boardExpanded
            ? <ChevronUp size={12} strokeWidth={1.5} className="text-on-surface-muted" />
            : <ChevronDown size={12} strokeWidth={1.5} className="text-on-surface-muted" />}
        </span>
      </button>

      {boardExpanded && (
        <div className="border-t border-white/5">
          <StoryboardCard entry={entry} />
        </div>
      )}
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function VideoTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2 mb-4">
        <div className="h-8 w-28 bg-surface-highest rounded-lg" />
        <div className="h-8 w-24 bg-surface-highest rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl bg-surface-highest" />
      <Skeleton className="h-48 w-full rounded-xl bg-surface-highest" />
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface VideoTabProps {
  sku: string
}

export function VideoTab({ sku }: VideoTabProps) {
  const [active,   setActive]   = useState<SubTab>('storyboard')
  const [entries,  setEntries]  = useState<StoryboardEntry[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!sku) return
    fetchCreativeEntries(sku)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sku])

  // Split by whether a video_url exists in the video artifact
  const pending = entries.filter(e => !(e.video?.artifact_data as any)?.video_url)
  const done    = entries.filter(e =>  !!(e.video?.artifact_data as any)?.video_url)

  function handleMakeVideo(combinationId: string) {
    toast.info('Geração de vídeo via VEO 3 ainda não conectada — em breve.')
    // When connected: call API, move entry from pending → done
  }

  if (loading) return <VideoTabSkeleton />

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-6 bg-surface-container border border-white/5 rounded-xl p-1 w-fit">
        {SUB_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              active === id
                ? 'bg-surface-high text-on-surface shadow-sm'
                : 'text-on-surface-muted hover:text-on-surface-variant',
            )}
          >
            {icon}
            {label}
            {id === 'criativos' && done.length > 0 && (
              <span className="ml-1 text-[0.625rem] bg-brand/20 text-brand px-1.5 py-0.5 rounded-full font-mono">
                {done.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Storyboard panel — combinações sem vídeo gerado */}
      {active === 'storyboard' && (
        <StoryboardTab
          sku={sku}
          entries={pending}
          loading={false}
          onMakeVideo={handleMakeVideo}
        />
      )}

      {/* Criativos panel — combinações com vídeo gerado */}
      {active === 'criativos' && (
        done.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
              <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-semibold text-on-surface">Nenhum vídeo gerado ainda</p>
              <p className="text-[0.6875rem] text-on-surface-variant max-w-xs leading-relaxed">
                Os criativos aparecerão aqui após serem gerados.
                Vá para <span className="font-mono text-brand">Storyboard</span> e clique em{' '}
                <span className="font-medium text-on-surface">Fazer Vídeo</span> em cada combinação.
              </p>
            </div>
            <button
              onClick={() => setActive('storyboard')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
                text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
            >
              Ver Storyboard →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Film size={16} strokeWidth={1.5} className="text-brand" />
              <h3 className="text-sm font-semibold text-on-surface">
                Criativos <span className="text-on-surface-muted font-normal">({done.length})</span>
              </h3>
            </div>
            {done.map(entry => <CriativoCard key={entry.combinationId} entry={entry} />)}
          </div>
        )
      )}
    </div>
  )
}
