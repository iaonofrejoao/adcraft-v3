'use client'
import { useEffect, useState } from 'react'
import { Film, Grid3x3, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Video, Copy, Check, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StoryboardTab, StoryboardCard } from './StoryboardTab'
import type { StoryboardEntry } from './StoryboardTab'
import { TikTokUGCTab } from './TikTokUGCTab'
import { fetchCreativeEntries } from '@/lib/creative-artifacts'
import { useFinalVideos, isVideoActive, STATUS_LABEL } from '@/hooks/useFinalVideos'
import type { SceneClip, FinalVideo } from '@/hooks/useFinalVideos'

/* ── Types ─────────────────────────────────────────────────────────── */
type SubTab = 'storyboard' | 'criativos' | 'tiktok'

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'storyboard', label: 'Storyboard',  icon: <Grid3x3 size={13} strokeWidth={1.5} /> },
  { id: 'criativos',  label: 'Criativos',   icon: <Film    size={13} strokeWidth={1.5} /> },
  { id: 'tiktok',     label: 'TikTok UGC',  icon: <Video   size={13} strokeWidth={1.5} /> },
]

const SECTION_COLOR: Record<string, string> = {
  hook:      'text-brand bg-brand/10 border-brand/20',
  problem:   'text-red-400 bg-red-500/10 border-red-500/20',
  agitation: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  mechanism: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  proof:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  offer:     'text-accent-violet bg-accent-violet/10 border-accent-violet/20',
  cta:       'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

function driveUrlToProxy(url: string) {
  return `/api/drive-image?url=${encodeURIComponent(url)}`
}

/* ── CopyButton ────────────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}
      className="shrink-0 w-5 h-5 flex items-center justify-center text-on-surface-muted hover:text-on-surface transition-colors"
    >
      {copied
        ? <Check size={10} strokeWidth={2} className="text-emerald-400" />
        : <Copy size={10} strokeWidth={1.5} />}
    </button>
  )
}

/* ── SceneClipCard ─────────────────────────────────────────────────── */
interface SceneGroupData {
  parentNum: number
  primary:   MergedScene   // cena com metadados do storyboard (scene_number inteiro)
  clips:     MergedScene[] // todos os clips do grupo, ordenados por scene_number
}

interface MergedScene {
  scene_number:    number
  section:         string
  scene_type?:     string
  duration_seconds?: number
  veo3_prompt_en?: string
  personas_prompt?: string | null
  subtitle_text?:  string
  overlay_text?:   string | null
  drive_url?:      string
  clip_status?:    'ok' | 'failed'
  clip_error?:     string
}

function SceneGroupBlock({ group }: { group: SceneGroupData }) {
  const [clipIdx, setClipIdx] = useState(0)
  const { parentNum, primary, clips } = group
  const count   = clips.length
  const current = clips[clipIdx]

  const sectionClass = SECTION_COLOR[primary.section] ?? 'text-on-surface-muted bg-surface-high border-white/5'
  const proxyUrl     = current.drive_url ? driveUrlToProxy(current.drive_url) : null

  return (
    <>
      {/* Header da cena */}
      <div className="px-4 py-2 bg-surface-high/20 flex items-center gap-2">
        <span className="text-[0.5625rem] font-mono text-on-surface-muted">
          CENA {String(parentNum).padStart(2, '0')}
        </span>
        {primary.section && (
          <span className={cn('text-[0.5rem] font-mono font-bold px-1.5 py-0.5 rounded border', sectionClass)}>
            {primary.section}
          </span>
        )}
        {count > 1 && (
          <span className="text-[0.5rem] font-mono px-1.5 py-0.5 rounded border bg-surface-high text-on-surface-muted border-white/10">
            {count} clips
          </span>
        )}
      </div>

      {/* Conteúdo: vídeo + metadados */}
      <div className="flex gap-0 min-h-0">
        {/* Coluna esquerda: vídeo + navegação carrossel */}
        <div className="w-[28%] flex-shrink-0 bg-black/40 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            {proxyUrl ? (
              <video
                key={proxyUrl}
                src={proxyUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full object-contain max-h-[340px]"
                style={{ aspectRatio: '9/16' }}
              />
            ) : (
              <div
                className="w-full flex flex-col items-center justify-center gap-2 text-on-surface-muted bg-surface-high/30"
                style={{ aspectRatio: '9/16', maxHeight: 340 }}
              >
                {current.clip_status === 'failed'
                  ? <AlertCircle size={20} strokeWidth={1.5} className="text-red-400" />
                  : <Film size={20} strokeWidth={1.5} />}
                <span className="text-[0.5625rem] text-center px-2 leading-tight">
                  {current.clip_status === 'failed' ? 'Falhou' : 'Aguardando'}
                </span>
              </div>
            )}
          </div>

          {count > 1 && (
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-t border-white/5">
              <button
                onClick={() => setClipIdx(i => Math.max(0, i - 1))}
                disabled={clipIdx === 0}
                className="p-0.5 rounded text-on-surface-muted hover:text-on-surface disabled:opacity-25 transition-colors"
              >
                <ChevronLeft size={12} strokeWidth={1.5} />
              </button>
              <span className="text-[0.5rem] font-mono text-on-surface-muted">{clipIdx + 1} / {count}</span>
              <button
                onClick={() => setClipIdx(i => Math.min(count - 1, i + 1))}
                disabled={clipIdx === count - 1}
                className="p-0.5 rounded text-on-surface-muted hover:text-on-surface disabled:opacity-25 transition-colors"
              >
                <ChevronRight size={12} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/* Coluna direita: metadados do storyboard */}
        <div className="flex-1 min-w-0 p-4 space-y-3 border-l border-white/5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[0.5625rem] px-2 py-0.5 rounded-full font-semibold border ${sectionClass}`}>
              {primary.section}
            </span>
            {primary.scene_type && (
              <span className="text-[0.5625rem] px-2 py-0.5 rounded-full font-mono bg-surface-high text-on-surface-muted border border-white/5">
                {primary.scene_type}
              </span>
            )}
            <span className="text-[0.5625rem] text-on-surface-muted font-mono ml-auto">
              {count > 1 ? `${count}×8s` : `${primary.duration_seconds ?? 8}s`}
            </span>
          </div>

          {primary.veo3_prompt_en && (
            <div>
              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Veo 3 prompt</p>
              <div className="flex items-start gap-2">
                <p className="text-[0.6875rem] text-on-surface font-mono leading-relaxed flex-1">{primary.veo3_prompt_en}</p>
                <CopyButton text={primary.veo3_prompt_en} />
              </div>
            </div>
          )}

          {primary.personas_prompt && (
            <div>
              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Persona prompt</p>
              <div className="flex items-start gap-2">
                <p className="text-[0.6875rem] text-on-surface-variant font-mono leading-relaxed flex-1">{primary.personas_prompt}</p>
                <CopyButton text={primary.personas_prompt} />
              </div>
            </div>
          )}

          {primary.subtitle_text && (
            <div>
              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Narração</p>
              <p className="text-[0.6875rem] text-on-surface-variant italic leading-relaxed">"{primary.subtitle_text}"</p>
            </div>
          )}

          {primary.overlay_text && (
            <div>
              <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Overlay</p>
              <p className="text-[0.6875rem] text-on-surface-muted leading-relaxed">{primary.overlay_text}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── CriativoCard ──────────────────────────────────────────────────── */
function CriativoCard({
  entry,
  finalVideo,
}: {
  entry:      StoryboardEntry
  finalVideo: FinalVideo | undefined
}) {
  const [open,          setOpen]          = useState(false)
  const [boardExpanded, setBoardExpanded] = useState(false)

  const videoData   = entry.video?.artifact_data as any
  const assetScenes: any[]   = videoData?.scenes ?? []
  const clipScenes:  SceneClip[] = finalVideo?.scenes ?? []

  const mergedScenes: MergedScene[] = assetScenes.map((as: any) => {
    const clip = clipScenes.find(c => c.scene_number === as.scene_number)
    return {
      scene_number:     as.scene_number,
      section:          as.section ?? clip?.section ?? '',
      scene_type:       as.scene_type,
      duration_seconds: as.duration_seconds,
      veo3_prompt_en:   as.veo3_prompt_en,
      personas_prompt:  as.personas_prompt,
      subtitle_text:    as.subtitle_text,
      overlay_text:     as.overlay_text,
      drive_url:        clip?.drive_url,
      clip_status:      clip?.status,
      clip_error:       clip?.error,
    }
  })

  // Sub-clips de cenas expandidas (scene_number não-inteiro: 4.1, 4.2...) não têm
  // correspondência em assetScenes — inserir em ordem numérica no lugar certo
  const matchedNums = new Set(mergedScenes.map(s => s.scene_number))
  clipScenes
    .filter(c => !matchedNums.has(c.scene_number))
    .forEach(c => mergedScenes.push({
      scene_number: c.scene_number,
      section:      c.section,
      drive_url:    c.drive_url,
      clip_status:  c.status,
      clip_error:   c.error,
    }))
  mergedScenes.sort((a, b) => a.scene_number - b.scene_number)

  if (!assetScenes.length && clipScenes.length) {
    clipScenes.forEach(c => mergedScenes.push({
      scene_number: c.scene_number,
      section:      c.section,
      drive_url:    c.drive_url,
      clip_status:  c.status,
      clip_error:   c.error,
    }))
  }

  // Agrupar por cena pai (parte inteira do scene_number: 2 e 2.1 → grupo 2)
  const groupMap = new Map<number, MergedScene[]>()
  for (const s of mergedScenes) {
    const parentNum = Math.floor(s.scene_number)
    if (!groupMap.has(parentNum)) groupMap.set(parentNum, [])
    groupMap.get(parentNum)!.push(s)
  }
  const sceneGroups: SceneGroupData[] = Array.from(groupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([parentNum, scenes]) => {
      const sorted = [...scenes].sort((a, b) => a.scene_number - b.scene_number)
      return {
        parentNum,
        primary: sorted.find(s => Number.isInteger(s.scene_number)) ?? sorted[0],
        clips:   sorted,
      }
    })

  const hasClips  = sceneGroups.some(g => g.clips.some(c => c.drive_url))
  const clipsDone = sceneGroups.filter(g => g.clips.some(c => c.drive_url)).length

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      {/* Header — clicável para abrir/fechar */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-high/20 transition-colors text-left"
      >
        <Film size={15} strokeWidth={1.5} className="text-brand shrink-0" />
        <span className="text-sm font-semibold text-on-surface font-mono">{entry.tag}</span>

        {videoData?.aspect_ratio && (
          <span className="text-[0.5625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono border border-white/5">
            {videoData.aspect_ratio}
          </span>
        )}
        {videoData?.platform && (
          <span className="text-[0.5625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono border border-white/5">
            {videoData.platform}
          </span>
        )}
        {finalVideo && (
          <span className={cn(
            'text-[0.5625rem] px-2 py-0.5 rounded-full font-mono border',
            finalVideo.status === 'ready'  && 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            finalVideo.status === 'failed' && 'text-red-400 bg-red-500/10 border-red-500/20',
            isVideoActive(finalVideo.status) && 'text-blue-400 bg-blue-500/10 border-blue-500/20 animate-pulse',
            finalVideo.status === 'queued' && 'text-on-surface-muted bg-surface-high border-white/5',
          )}>
            {STATUS_LABEL[finalVideo.status]}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[0.5625rem] text-on-surface-muted font-mono">
            {hasClips ? `${clipsDone}/${sceneGroups.length} cenas` : `${sceneGroups.length} cenas`}
          </span>
          {hasClips && finalVideo && (
            <a
              href={`/api/final-videos/${finalVideo.id}/download-zip`}
              download
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.5625rem] font-medium
                bg-surface-high border border-white/5 text-on-surface-muted
                hover:text-on-surface hover:bg-surface-highest transition-colors duration-150"
            >
              <Download size={10} strokeWidth={1.5} />
              ZIP
            </a>
          )}
          {open
            ? <ChevronUp   size={13} strokeWidth={1.5} className="text-on-surface-muted" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-on-surface-muted" />}
        </span>
      </button>

      {/* Corpo — visível só quando aberto */}
      {open && (
        <>
          {/* Cenas agrupadas — sub-clips da mesma cena aparecem em carrossel */}
          <div className="divide-y divide-white/5 border-t border-white/5">
            {sceneGroups.map(group => (
              <div key={group.parentNum}>
                <SceneGroupBlock group={group} />
              </div>
            ))}
          </div>

          {/* Storyboard original colapsável */}
          <div className="border-t border-white/5">
            <button
              onClick={() => setBoardExpanded(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-high/30 transition-colors text-left"
            >
              <Grid3x3 size={11} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
              <span className="text-[0.625rem] text-on-surface-muted">Storyboard original</span>
              <span className="ml-auto">
                {boardExpanded
                  ? <ChevronUp   size={11} strokeWidth={1.5} className="text-on-surface-muted" />
                  : <ChevronDown size={11} strokeWidth={1.5} className="text-on-surface-muted" />}
              </span>
            </button>
            {boardExpanded && (
              <div className="border-t border-white/5">
                <StoryboardCard entry={entry} />
              </div>
            )}
          </div>
        </>
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

  const { queueVideo, usedTikTokIds, videosByCombination } = useFinalVideos(sku)

  useEffect(() => {
    if (!sku) return
    fetchCreativeEntries(sku)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sku])

  // "done" = combination has a final_video record com cenas geradas
  const done = entries.filter(e => (videosByCombination[e.combinationId]?.scenes ?? []).length > 0)

  function handleMakeVideo(combinationId: string) {
    queueVideo(combinationId)
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

      {/* Storyboard — todas as combinações; clips aparecem inline quando disponíveis */}
      {active === 'storyboard' && (
        <StoryboardTab
          sku={sku}
          entries={entries}
          loading={false}
          onMakeVideo={handleMakeVideo}
          videosByCombination={videosByCombination}
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
            {done.map(entry => (
              <CriativoCard
                key={entry.combinationId}
                entry={entry}
                finalVideo={videosByCombination[entry.combinationId]}
              />
            ))}
          </div>
        )
      )}

      {/* TikTok UGC panel — coleta e aprovação de UGC */}
      {active === 'tiktok' && <TikTokUGCTab sku={sku} inUseIds={usedTikTokIds} />}
    </div>
  )
}
