'use client'
import { useEffect, useState } from 'react'
import { Grid3x3, Clapperboard, Copy, Check, ChevronDown, ChevronUp, Video, Mic } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

/* ── Types ─────────────────────────────────────────────────────────── */
interface KeyframeScene {
  scene_number:         number
  section:              string
  duration_seconds:     number
  veo3_prompt_en:       string
  midjourney_prompt_en?: string
  camera_angle:         string
  camera_movement:      string
  lighting:             string
  mood:                 string
  overlay_suggestion?:  string | null
  compliance_note?:     string | null
}

interface VideoScene {
  scene_number:    number
  section:         string
  duration_seconds: number
  veo3_prompt_en:  string
  subtitle_text:   string
  overlay_text?:   string | null
  visual_notes?:   string | null
  audio_cue?:      string | null
}

interface KeyframesData {
  aspect_ratio:             string
  character_anchor:         string
  style_suffix:             string
  keyframes:                KeyframeScene[]
  style_consistency_notes?: string
}

interface VideoAssetsData {
  storyboard_tag:          string
  combination_used:        string
  total_duration_seconds:  number
  aspect_ratio:            string
  platform:                string
  style:                   string
  narration_script?:       string
  scenes:                  VideoScene[]
  audio_config?: {
    needs_narration:          boolean
    narration_tone:           string
    background_music_style:   string
    background_music_volume:  number
  }
  production_warnings?: string[]
}

interface ArtifactRow<T> {
  id:                  string
  artifact_data:       T
  copy_combination_id: string
  copy_combinations:   { tag: string } | null
}

/* Merged per combination */
interface StoryboardEntry {
  combinationId:  string
  tag:            string
  keyframes:      ArtifactRow<KeyframesData> | null
  video:          ArtifactRow<VideoAssetsData> | null
}

/* ── Helpers ────────────────────────────────────────────────────────── */
const SECTION_COLOR: Record<string, string> = {
  hook:      'text-brand bg-brand/10',
  problem:   'text-status-failed-text bg-status-failed',
  agitation: 'text-brand bg-brand/10',
  mechanism: 'text-status-running-text bg-status-running',
  proof:     'text-status-done-text bg-status-done',
  offer:     'text-accent-violet bg-accent-violet/10',
  cta:       'text-status-paused-text bg-status-paused',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[0.625rem] text-on-surface-muted hover:text-on-surface transition-colors shrink-0"
    >
      {copied
        ? <><Check size={10} strokeWidth={1.5} className="text-status-done-text" /> copiado</>
        : <><Copy size={10} strokeWidth={1.5} /> copiar</>}
    </button>
  )
}

/* ── Scene row ──────────────────────────────────────────────────────── */
interface MergedScene {
  scene_number:    number
  section:         string
  duration_seconds: number
  subtitle_text?:  string
  overlay_text?:   string | null
  visual_notes?:   string | null
  audio_cue?:      string | null
  veo3_prompt_en:  string
  midjourney_prompt_en?: string
  camera_angle:    string
  camera_movement: string
  mood:            string
  overlay_suggestion?: string | null
}

function SceneRow({ scene, index }: { scene: MergedScene; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const voiceText = scene.subtitle_text

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-high/30 transition-colors text-left"
      >
        <span className={cn(
          'text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded shrink-0',
          SECTION_COLOR[scene.section] ?? 'text-on-surface-variant bg-surface-high',
        )}>
          {scene.section}
        </span>
        <span className="text-[0.6875rem] font-mono text-on-surface-muted">
          Cena {scene.scene_number} · {scene.duration_seconds}s · {scene.camera_angle} · {scene.mood}
        </span>
        {voiceText && !expanded && (
          <span className="ml-2 text-[0.6875rem] text-on-surface-variant truncate flex-1 italic">
            "{voiceText}"
          </span>
        )}
        <span className="ml-auto shrink-0">
          {expanded
            ? <ChevronUp size={12} strokeWidth={1.5} className="text-on-surface-muted" />
            : <ChevronDown size={12} strokeWidth={1.5} className="text-on-surface-muted" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Voice / narration */}
          {voiceText && (
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low border-b border-white/5">
                <Mic size={10} strokeWidth={1.5} className="text-on-surface-muted" />
                <span className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest">Narração</span>
              </div>
              <p className="px-3 py-2 text-[0.8125rem] text-on-surface leading-relaxed">
                {voiceText}
              </p>
            </div>
          )}

          {/* VEO3 prompt */}
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-surface-low border-b border-white/5">
              <span className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest">VEO 3</span>
              <CopyButton text={scene.veo3_prompt_en} />
            </div>
            <p className="px-3 py-2 text-[0.75rem] text-on-surface-variant leading-relaxed font-mono">
              {scene.veo3_prompt_en}
            </p>
          </div>

          {/* Midjourney prompt */}
          {scene.midjourney_prompt_en && (
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-low border-b border-white/5">
                <span className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest">Midjourney</span>
                <CopyButton text={scene.midjourney_prompt_en} />
              </div>
              <p className="px-3 py-2 text-[0.75rem] text-on-surface-variant leading-relaxed font-mono">
                {scene.midjourney_prompt_en}
              </p>
            </div>
          )}

          {/* Overlays + notes */}
          <div className="flex flex-wrap gap-3">
            {(scene.overlay_text || scene.overlay_suggestion) && (
              <div className="flex items-center gap-1.5 text-[0.6875rem] text-status-paused-text">
                <span className="text-on-surface-muted">Overlay:</span>
                {scene.overlay_text ?? scene.overlay_suggestion}
              </div>
            )}
            {scene.audio_cue && (
              <div className="flex items-center gap-1.5 text-[0.6875rem] text-on-surface-muted">
                <span>🎵</span> {scene.audio_cue}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Storyboard card ────────────────────────────────────────────────── */
function StoryboardCard({ entry }: { entry: StoryboardEntry }) {
  const kfData = entry.keyframes?.artifact_data
  const vData  = entry.video?.artifact_data

  const storyboardTag = vData?.storyboard_tag ?? entry.tag
  const aspectRatio   = vData?.aspect_ratio ?? kfData?.aspect_ratio
  const duration      = vData?.total_duration_seconds
  const platform      = vData?.platform
  const audioConfig   = vData?.audio_config
  const warnings      = vData?.production_warnings?.filter(Boolean)

  // Build merged scenes
  const mergedScenes: MergedScene[] = (() => {
    const kfScenes = kfData?.keyframes ?? []
    const vScenes  = vData?.scenes ?? []
    const count = Math.max(kfScenes.length, vScenes.length)
    if (count === 0) return []

    return Array.from({ length: count }, (_, i) => {
      const kf = kfScenes[i]
      const vs = vScenes[i]
      return {
        scene_number:        kf?.scene_number ?? vs?.scene_number ?? (i + 1),
        section:             kf?.section ?? vs?.section ?? 'hook',
        duration_seconds:    kf?.duration_seconds ?? vs?.duration_seconds ?? 0,
        subtitle_text:       vs?.subtitle_text,
        overlay_text:        vs?.overlay_text,
        visual_notes:        vs?.visual_notes,
        audio_cue:           vs?.audio_cue,
        veo3_prompt_en:      kf?.veo3_prompt_en ?? vs?.veo3_prompt_en ?? '',
        midjourney_prompt_en: kf?.midjourney_prompt_en,
        camera_angle:        kf?.camera_angle ?? 'medium',
        camera_movement:     kf?.camera_movement ?? 'static',
        mood:                kf?.mood ?? '',
        overlay_suggestion:  kf?.overlay_suggestion,
      }
    })
  })()

  function handleMakeVideo() {
    toast.info('Geração de vídeo via VEO 3 ainda não conectada — em breve.')
  }

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Grid3x3 size={15} strokeWidth={1.5} className="text-status-running-text shrink-0" />
          <span className="text-sm font-semibold text-on-surface font-mono truncate">{storyboardTag}</span>
          {aspectRatio && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {aspectRatio}
            </span>
          )}
          {duration && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {duration}s
            </span>
          )}
          {platform && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {platform}
            </span>
          )}
          {mergedScenes.length > 0 && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {mergedScenes.length} cenas
            </span>
          )}
        </div>

        <button
          onClick={handleMakeVideo}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium shrink-0',
            'bg-brand/10 border border-brand/20 text-brand',
            'hover:bg-brand/20 transition-all duration-150',
          )}
        >
          <Video size={12} strokeWidth={1.5} />
          Fazer Vídeo
        </button>
      </div>

      {/* Character anchor */}
      {kfData?.character_anchor && (
        <div className="px-4 py-2.5 border-b border-white/5">
          <span className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mr-2">Personagem</span>
          <span className="text-[0.6875rem] text-on-surface-variant font-mono">{kfData.character_anchor}</span>
        </div>
      )}

      {/* Audio config */}
      {audioConfig && (
        <div className="px-4 py-2.5 border-b border-white/5 flex flex-wrap gap-4">
          <div>
            <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Voz</p>
            <p className="text-[0.6875rem] text-on-surface">{audioConfig.narration_tone}</p>
          </div>
          <div>
            <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Música</p>
            <p className="text-[0.6875rem] text-on-surface">{audioConfig.background_music_style}</p>
          </div>
          <div>
            <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Vol. música</p>
            <p className="text-[0.6875rem] text-on-surface">{Math.round((audioConfig.background_music_volume ?? 0) * 100)}%</p>
          </div>
        </div>
      )}

      {/* Scenes */}
      {mergedScenes.length > 0 && mergedScenes.map((scene, i) => (
        <SceneRow key={scene.scene_number} scene={scene} index={i} />
      ))}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="px-4 py-3 border-t border-white/5">
          {warnings.map((w, i) => (
            <p key={i} className="text-[0.625rem] text-status-paused-text">{w}</p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function StoryboardTabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl bg-surface-highest" />
      ))}
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface StoryboardTabProps {
  sku: string
}

export function StoryboardTab({ sku }: StoryboardTabProps) {
  const [entries,  setEntries]  = useState<StoryboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}/creative-artifacts?type=keyframes`).then(r => r.json()),
      fetch(`/api/products/${sku}/creative-artifacts?type=video_assets`).then(r => r.json()),
    ])
      .then(([kfRes, vRes]) => {
        const kfRows: ArtifactRow<KeyframesData>[]       = kfRes.artifacts ?? []
        const vRows:  ArtifactRow<VideoAssetsData>[]     = vRes.artifacts ?? []

        // Merge by copy_combination_id — one entry per combination
        const map = new Map<string, StoryboardEntry>()

        kfRows.forEach(row => {
          const cid = row.copy_combination_id
          if (!cid) return
          if (!map.has(cid)) map.set(cid, { combinationId: cid, tag: row.copy_combinations?.tag ?? cid, keyframes: null, video: null })
          map.get(cid)!.keyframes = row
        })

        vRows.forEach(row => {
          const cid = row.copy_combination_id
          if (!cid) return
          if (!map.has(cid)) map.set(cid, { combinationId: cid, tag: row.copy_combinations?.tag ?? cid, keyframes: null, video: null })
          map.get(cid)!.video = row
        })

        setEntries(Array.from(map.values()))
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sku])

  if (loading) return <StoryboardTabSkeleton />

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Clapperboard size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum storyboard gerado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            Gere os scripts na aba <span className="font-mono text-brand">Copy</span> para criar os storyboards automaticamente.
          </p>
        </div>
        <Link
          href={`/products/${sku}/copies`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-container border border-white/5
            text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-150"
        >
          Ir para Copy →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid3x3 size={16} strokeWidth={1.5} className="text-status-running-text" />
          <h3 className="text-sm font-semibold text-on-surface">
            Storyboard <span className="text-on-surface-muted font-normal">({entries.length})</span>
          </h3>
        </div>
        <p className="text-[0.625rem] text-on-surface-muted">
          Clique em <span className="text-brand font-medium">Fazer Vídeo</span> para gerar o criativo final
        </p>
      </div>
      {entries.map(entry => <StoryboardCard key={entry.combinationId} entry={entry} />)}
    </div>
  )
}
