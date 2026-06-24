'use client'
import { useEffect, useState } from 'react'
import { Grid3x3, Clapperboard, Copy, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Video, Mic, FileText, PlayCircle, X, Film } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { fetchCreativeEntries } from '@/lib/creative-artifacts'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { SceneClip } from '@/hooks/useFinalVideos'

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

interface ScriptScene {
  scene_number:    number
  section:         string
  duration_seconds?: number
}

interface ScriptData {
  script_tag:             string
  total_duration_seconds: number
  format:                 string
  platform:               string
  framework_used:         string
  narration_full:         string
  cta_text:               string
  verbatim_used?:         string
  script_rationale?:      string
  scenes?:                ScriptScene[]
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

/* Merged per combination — exported so VideoTab can reuse */
export interface StoryboardEntry {
  combinationId:  string
  tag:            string
  script:         ArtifactRow<ScriptData> | null
  keyframes:      ArtifactRow<KeyframesData> | null
  video:          ArtifactRow<VideoAssetsData> | null
}

export type { ArtifactRow, KeyframesData, VideoAssetsData, ScriptData }

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

function driveUrlToProxy(url: string) {
  return `/api/drive-image?url=${encodeURIComponent(url)}`
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
  scene_number:         number
  section:              string
  scene_type?:          string
  duration_seconds:     number
  subtitle_text?:       string
  overlay_text?:        string | null
  visual_notes?:        string | null
  audio_cue?:           string | null
  veo3_prompt_en:       string
  personas_prompt?:     string | null
  midjourney_prompt_en?: string
  camera_angle:         string
  camera_movement:      string
  mood:                 string
  overlay_suggestion?:  string | null
  drive_url?:           string
  clip_status?:         'ok' | 'failed'
}

/* ── Scene video modal ──────────────────────────────────────────────── */
function SceneVideoModal({
  scenes,
  activeIdx,
  aspectRatio,
  onNavigate,
  onClose,
}: {
  scenes:       MergedScene[]
  activeIdx:    number
  aspectRatio?: string
  onNavigate:   (i: number) => void
  onClose:      () => void
}) {
  const scene = scenes[activeIdx]
  if (!scene) return null

  const proxyUrl    = scene.drive_url ? driveUrlToProxy(scene.drive_url) : null
  const sectionCls  = SECTION_COLOR[scene.section] ?? 'text-on-surface-variant bg-surface-high'
  const isPortrait  = !aspectRatio || aspectRatio.startsWith('9')

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm duration-300
            data-open:animate-in data-open:fade-in-0"
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 duration-300
            data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4"
        >
          <div className="relative bg-[#141414] border border-white/8 rounded-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 shrink-0">
              <span className={cn('text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded shrink-0', sectionCls)}>
                {scene.section}
              </span>
              {scene.scene_type && (
                <span className="text-[0.5625rem] font-mono px-1.5 py-0.5 rounded bg-surface-high text-on-surface-muted border border-white/5">
                  {scene.scene_type}
                </span>
              )}
              <span className="text-sm font-semibold text-on-surface">
                Cena {String(scene.scene_number).padStart(2, '0')}
              </span>
              {scene.duration_seconds != null && (
                <span className="text-[0.5625rem] font-mono text-on-surface-muted bg-surface-high px-1.5 py-0.5 rounded border border-white/5">
                  {scene.duration_seconds}s
                </span>
              )}
              {scene.camera_angle && (
                <span className="text-[0.5625rem] text-on-surface-muted">{scene.camera_angle}</span>
              )}
              {scene.mood && (
                <span className="text-[0.5625rem] text-on-surface-muted">· {scene.mood}</span>
              )}
              <DialogPrimitive.Close
                className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-muted hover:text-on-surface hover:bg-white/5 transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Coluna esquerda: vídeo */}
              <div className="flex flex-col bg-black border-r border-white/5" style={{ width: isPortrait ? '30%' : '50%', flexShrink: 0 }}>
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  {proxyUrl ? (
                    <video
                      key={proxyUrl}
                      src={proxyUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full object-contain"
                      style={isPortrait ? { maxHeight: 440, aspectRatio: '9/16' } : { maxHeight: 300, aspectRatio: '16/9' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-on-surface-muted p-8">
                      <Film size={28} strokeWidth={1.5} />
                      <p className="text-[0.5625rem] text-center leading-relaxed">
                        {scene.clip_status === 'failed' ? 'Clip falhou' : 'Clip ainda não gerado'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Navegação entre cenas */}
                {scenes.length > 1 && (
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 shrink-0">
                    <button
                      onClick={() => onNavigate(Math.max(0, activeIdx - 1))}
                      disabled={activeIdx === 0}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[0.5625rem] font-medium text-on-surface-muted hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={11} strokeWidth={1.5} /> Anterior
                    </button>
                    <span className="text-[0.5rem] text-on-surface-muted font-mono tabular-nums">
                      {activeIdx + 1} / {scenes.length}
                    </span>
                    <button
                      onClick={() => onNavigate(Math.min(scenes.length - 1, activeIdx + 1))}
                      disabled={activeIdx === scenes.length - 1}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[0.5625rem] font-medium text-on-surface-muted hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima <ChevronRight size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>

              {/* Coluna direita: metadados */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">

                  {/* Narração */}
                  {scene.subtitle_text && (
                    <div>
                      <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1.5">Narração</p>
                      <p className="text-[0.8125rem] text-on-surface italic leading-relaxed">"{scene.subtitle_text}"</p>
                    </div>
                  )}

                  {/* VEO 3 prompt */}
                  {scene.veo3_prompt_en && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest">Veo 3 Prompt</p>
                        <CopyButton text={scene.veo3_prompt_en} />
                      </div>
                      <div className="bg-surface-low border border-white/5 rounded-lg px-3 py-2.5">
                        <p className="text-[0.6875rem] text-on-surface-variant font-mono leading-relaxed">{scene.veo3_prompt_en}</p>
                      </div>
                    </div>
                  )}

                  {/* Persona prompt */}
                  {scene.personas_prompt && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest">Persona Prompt</p>
                        <CopyButton text={scene.personas_prompt} />
                      </div>
                      <div className="bg-surface-low border border-white/5 rounded-lg px-3 py-2.5">
                        <p className="text-[0.6875rem] text-on-surface-variant font-mono leading-relaxed">{scene.personas_prompt}</p>
                      </div>
                    </div>
                  )}

                  {/* Midjourney */}
                  {scene.midjourney_prompt_en && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest">Midjourney</p>
                        <CopyButton text={scene.midjourney_prompt_en} />
                      </div>
                      <div className="bg-surface-low border border-white/5 rounded-lg px-3 py-2.5">
                        <p className="text-[0.6875rem] text-on-surface-variant font-mono leading-relaxed">{scene.midjourney_prompt_en}</p>
                      </div>
                    </div>
                  )}

                  {/* Câmera / movimento / mood */}
                  <div className="grid grid-cols-3 gap-3">
                    {scene.camera_angle && (
                      <div>
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Ângulo</p>
                        <p className="text-[0.6875rem] text-on-surface font-mono">{scene.camera_angle}</p>
                      </div>
                    )}
                    {scene.camera_movement && (
                      <div>
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Movimento</p>
                        <p className="text-[0.6875rem] text-on-surface font-mono">{scene.camera_movement}</p>
                      </div>
                    )}
                    {scene.mood && (
                      <div>
                        <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-0.5">Mood</p>
                        <p className="text-[0.6875rem] text-on-surface font-mono">{scene.mood}</p>
                      </div>
                    )}
                  </div>

                  {/* Overlay */}
                  {(scene.overlay_text || scene.overlay_suggestion) && (
                    <div>
                      <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Overlay</p>
                      <p className="text-[0.6875rem] text-on-surface-muted leading-relaxed">{scene.overlay_text ?? scene.overlay_suggestion}</p>
                    </div>
                  )}

                  {/* Audio cue */}
                  {scene.audio_cue && (
                    <div>
                      <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Audio cue</p>
                      <p className="text-[0.6875rem] text-on-surface-muted">{scene.audio_cue}</p>
                    </div>
                  )}

                  {/* Visual notes */}
                  {scene.visual_notes && (
                    <div>
                      <p className="text-[0.5rem] text-on-surface-muted uppercase tracking-widest mb-1">Notas visuais</p>
                      <p className="text-[0.6875rem] text-on-surface-muted leading-relaxed">{scene.visual_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ── Scene row ──────────────────────────────────────────────────────── */
function SceneRow({ scene, index, onPlayClip }: { scene: MergedScene; index: number; onPlayClip?: () => void }) {
  const [expanded, setExpanded] = useState(index === 0)
  const voiceText = scene.subtitle_text
  const hasClip   = !!scene.drive_url

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
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {hasClip && onPlayClip && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onPlayClip() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onPlayClip() } }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[0.5625rem] font-medium
                bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 transition-colors"
            >
              <PlayCircle size={10} strokeWidth={1.5} />
              Ver clip
            </span>
          )}
          {expanded
            ? <ChevronUp   size={12} strokeWidth={1.5} className="text-on-surface-muted" />
            : <ChevronDown size={12} strokeWidth={1.5} className="text-on-surface-muted" />}
        </div>
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
export function StoryboardCard({
  entry,
  onMakeVideo,
  sceneClips,
}: {
  entry:         StoryboardEntry
  onMakeVideo?:  (id: string) => void
  sceneClips?:   SceneClip[]
}) {
  const scrData = entry.script?.artifact_data
  const kfData  = entry.keyframes?.artifact_data
  const vData   = entry.video?.artifact_data
  const [open,           setOpen]           = useState(false)
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [openSceneIdx,   setOpenSceneIdx]   = useState<number | null>(null)

  const storyboardTag = vData?.storyboard_tag ?? entry.tag
  const aspectRatio   = vData?.aspect_ratio ?? kfData?.aspect_ratio
  const duration      = vData?.total_duration_seconds
  const platform      = vData?.platform
  const audioConfig   = vData?.audio_config
  const warnings      = vData?.production_warnings?.filter(Boolean)

  // Build merged scenes — script.scenes is the source of truth for `section`
  // because keyframe/video agents may incorrectly copy a single section to all scenes
  const mergedScenes: MergedScene[] = (() => {
    const scrScenes = scrData?.scenes ?? []
    const kfScenes  = kfData?.keyframes ?? []
    const vScenes   = vData?.scenes ?? []
    const count = Math.max(scrScenes.length, kfScenes.length, vScenes.length)
    if (count === 0) return []

    return Array.from({ length: count }, (_, i) => {
      const sc   = scrScenes[i]
      const kf   = kfScenes[i]
      const vs   = vScenes[i]
      const num  = kf?.scene_number ?? vs?.scene_number ?? (i + 1)
      const clip = (sceneClips ?? []).find(c => c.scene_number === num)
      return {
        scene_number:         num,
        section:              sc?.section ?? kf?.section ?? vs?.section ?? 'hook',
        scene_type:           (vs as any)?.scene_type,
        duration_seconds:     kf?.duration_seconds ?? vs?.duration_seconds ?? 0,
        subtitle_text:        vs?.subtitle_text,
        overlay_text:         vs?.overlay_text,
        visual_notes:         vs?.visual_notes,
        audio_cue:            vs?.audio_cue,
        veo3_prompt_en:       kf?.veo3_prompt_en ?? vs?.veo3_prompt_en ?? '',
        personas_prompt:      (vs as any)?.personas_prompt ?? null,
        midjourney_prompt_en: kf?.midjourney_prompt_en,
        camera_angle:         kf?.camera_angle ?? 'medium',
        camera_movement:      kf?.camera_movement ?? 'static',
        mood:                 kf?.mood ?? '',
        overlay_suggestion:   kf?.overlay_suggestion,
        drive_url:            clip?.drive_url,
        clip_status:          clip?.status,
      }
    })
  })()

  function handleMakeVideo() {
    if (onMakeVideo) onMakeVideo(entry.combinationId)
    else toast.info('Geração de vídeo via VEO 3 ainda não conectada — em breve.')
  }

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      {/* Header — clicável para abrir/fechar */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-surface-high/20 transition-colors text-left"
      >
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

        <div className="flex items-center gap-2 shrink-0">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); handleMakeVideo() }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleMakeVideo() } }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium',
              'bg-brand/10 border border-brand/20 text-brand',
              'hover:bg-brand/20 transition-all duration-150',
            )}
          >
            <Video size={12} strokeWidth={1.5} />
            Fazer Vídeo
          </span>
          {open
            ? <ChevronUp   size={13} strokeWidth={1.5} className="text-on-surface-muted" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-on-surface-muted" />}
        </div>
      </button>

      {/* Corpo — visível só quando aberto */}
      {open && (
        <>
          {/* Character anchor */}
          {kfData?.character_anchor && (
            <div className="px-4 py-2.5 border-t border-white/5">
              <span className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mr-2">Personagem</span>
              <span className="text-[0.6875rem] text-on-surface-variant font-mono">{kfData.character_anchor}</span>
            </div>
          )}

          {/* Script metadata */}
          {scrData && (
            <div className="border-t border-white/5">
              <button
                onClick={() => setScriptExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-surface-high/30 transition-colors text-left"
              >
                <FileText size={11} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
                <span className="text-[0.6875rem] text-on-surface-muted">
                  {scrData.framework_used ?? 'Roteiro'} · {scrData.total_duration_seconds}s
                </span>
                <span className="ml-auto">
                  {scriptExpanded
                    ? <ChevronUp size={11} strokeWidth={1.5} className="text-on-surface-muted" />
                    : <ChevronDown size={11} strokeWidth={1.5} className="text-on-surface-muted" />}
                </span>
              </button>
              {scriptExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {scrData.narration_full && (
                    <div>
                      <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-1">Narração completa</p>
                      <p className="text-[0.75rem] text-on-surface-variant leading-relaxed italic">"{scrData.narration_full}"</p>
                    </div>
                  )}
                  {scrData.verbatim_used && (
                    <div>
                      <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-1">Verbatim do avatar</p>
                      <p className="text-[0.75rem] text-on-surface-variant italic">"{scrData.verbatim_used}"</p>
                    </div>
                  )}
                  {scrData.script_rationale && (
                    <div>
                      <p className="text-[0.5625rem] text-on-surface-muted uppercase tracking-widest mb-1">Racional</p>
                      <p className="text-[0.75rem] text-on-surface-variant leading-relaxed">{scrData.script_rationale}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audio config */}
          {audioConfig && (
            <div className="px-4 py-2.5 border-t border-white/5 flex flex-wrap gap-4">
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
            <SceneRow
              key={scene.scene_number}
              scene={scene}
              index={i}
              onPlayClip={scene.drive_url ? () => setOpenSceneIdx(i) : undefined}
            />
          ))}

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <div className="px-4 py-3 border-t border-white/5">
              {warnings.map((w, i) => (
                <p key={i} className="text-[0.625rem] text-status-paused-text">{w}</p>
              ))}
            </div>
          )}
        </>
      )}

      {/* Scene video modal — fora do {open} para sobreviver ao fechar o card */}
      {openSceneIdx !== null && (
        <SceneVideoModal
          scenes={mergedScenes}
          activeIdx={openSceneIdx}
          aspectRatio={vData?.aspect_ratio ?? kfData?.aspect_ratio}
          onNavigate={setOpenSceneIdx}
          onClose={() => setOpenSceneIdx(null)}
        />
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
  sku:                  string
  entries?:             StoryboardEntry[]
  loading?:             boolean
  onMakeVideo?:         (combinationId: string) => void
  videosByCombination?: Record<string, import('@/hooks/useFinalVideos').FinalVideo>
}

export function StoryboardTab({ sku, entries: externalEntries, loading: externalLoading, onMakeVideo, videosByCombination = {} }: StoryboardTabProps) {
  const [internalEntries, setInternalEntries] = useState<StoryboardEntry[]>([])
  const [internalLoading, setInternalLoading] = useState(externalEntries === undefined)

  useEffect(() => {
    if (externalEntries !== undefined || !sku) return
    fetchCreativeEntries(sku)
      .then(setInternalEntries)
      .catch(() => setInternalEntries([]))
      .finally(() => setInternalLoading(false))
  }, [sku, externalEntries])

  const entries = externalEntries ?? internalEntries
  const loading = externalLoading ?? internalLoading

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
      {entries.map(entry => (
        <StoryboardCard
          key={entry.combinationId}
          entry={entry}
          onMakeVideo={onMakeVideo}
          sceneClips={videosByCombination[entry.combinationId]?.scenes}
        />
      ))}
    </div>
  )
}
