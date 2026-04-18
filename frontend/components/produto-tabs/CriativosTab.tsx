'use client'
import { useEffect, useState } from 'react'
import { Film, FileText, Grid3x3, Loader2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Pipeline } from '@/components/detalhes-produto'

/* ── Types ─────────────────────────────────────────────────────────── */
interface ScriptScene {
  scene_number:     number
  section:          string
  duration_seconds: number
  narration:        string
  visual_direction: string
  emotion_cue:      string
}

interface ScriptData {
  script_tag:           string
  total_duration_seconds: number
  format:               string
  platform:             string
  framework_used:       string
  narration_full:       string
  scenes:               ScriptScene[]
  cta_text:             string
  verbatim_used:        string
  script_rationale:     string
}

interface Keyframe {
  scene_number:      number
  section:           string
  duration_seconds:  number
  veo3_prompt_en:    string
  midjourney_prompt_en: string
  camera_angle:      string
  camera_movement:   string
  lighting:          string
  mood:              string
  overlay_suggestion?: string | null
  compliance_note?:  string | null
}

interface KeyframesData {
  aspect_ratio:            string
  character_anchor:        string
  style_suffix:            string
  keyframes:               Keyframe[]
  style_consistency_notes?: string
}

interface KnowledgeRow<T = unknown> {
  id:                 string
  artifact_type:      string
  artifact_data:      T
  status:             string
  source_pipeline_id: string
  created_at:         string
}

/* ── Helpers ────────────────────────────────────────────────────────── */
const SECTION_COLOR: Record<string, string> = {
  hook:         'text-[#F28705] bg-[#F28705]/10',
  problem:      'text-[#F87171] bg-[#F87171]/10',
  agitation:    'text-[#F97316] bg-[#F97316]/10',
  mechanism:    'text-[#60A5FA] bg-[#60A5FA]/10',
  proof:        'text-[#4ADE80] bg-[#4ADE80]/10',
  offer:        'text-[#A78BFA] bg-[#A78BFA]/10',
  cta:          'text-[#FCD34D] bg-[#FCD34D]/10',
}

/* ── Copy-to-clipboard button ───────────────────────────────────────── */
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
      className="flex items-center gap-1 text-[0.625rem] text-on-surface-muted hover:text-on-surface transition-colors duration-150"
    >
      {copied ? (
        <><Check size={10} strokeWidth={1.5} className="text-[#4ADE80]" /> copiado</>
      ) : (
        <><Copy size={10} strokeWidth={1.5} /> copiar</>
      )}
    </button>
  )
}

/* ── Script section ─────────────────────────────────────────────────── */
function ScriptCard({ row }: { row: KnowledgeRow<ScriptData> }) {
  const d = row.artifact_data
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <FileText size={15} strokeWidth={1.5} className="text-[#F28705]" />
          <span className="text-sm font-semibold text-on-surface font-mono">{d.script_tag}</span>
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {d.format}
          </span>
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {d.framework_used}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] font-mono text-on-surface-muted">
            {d.total_duration_seconds}s · {d.scenes?.length ?? 0} cenas
          </span>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[0.6875rem] text-brand hover:underline"
          >
            {expanded ? 'Recolher' : 'Ver cenas'}
          </button>
        </div>
      </div>

      {/* Narration full */}
      <div className="p-4">
        <p className="text-[0.75rem] text-on-surface-variant leading-relaxed italic">
          "{d.narration_full}"
        </p>
        {d.cta_text && (
          <p className="mt-2 text-[0.6875rem] font-semibold text-[#FCD34D]">
            CTA: {d.cta_text}
          </p>
        )}
      </div>

      {/* Scenes detail */}
      {expanded && d.scenes?.length > 0 && (
        <div className="border-t border-white/5">
          {d.scenes.map((scene) => (
            <div key={scene.scene_number} className="p-4 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded',
                  SECTION_COLOR[scene.section] ?? 'text-on-surface-variant bg-surface-high'
                )}>
                  {scene.section}
                </span>
                <span className="text-[0.6875rem] font-mono text-on-surface-muted">
                  Cena {scene.scene_number} · {scene.duration_seconds}s · {scene.emotion_cue}
                </span>
              </div>
              <p className="text-[0.8125rem] text-on-surface mb-2 leading-relaxed">
                {scene.narration}
              </p>
              <p className="text-[0.6875rem] text-on-surface-muted/70 italic leading-relaxed">
                Visual: {scene.visual_direction}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Keyframes section ──────────────────────────────────────────────── */
function KeyframesCard({ row }: { row: KnowledgeRow<KeyframesData> }) {
  const d = row.artifact_data
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Grid3x3 size={15} strokeWidth={1.5} className="text-[#60A5FA]" />
          <span className="text-sm font-semibold text-on-surface">Keyframes</span>
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {d.aspect_ratio}
          </span>
          <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
            {d.keyframes?.length ?? 0} cenas
          </span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[0.6875rem] text-brand hover:underline"
        >
          {expanded ? 'Recolher' : 'Ver prompts'}
        </button>
      </div>

      {/* Character anchor */}
      <div className="p-4 border-b border-white/5">
        <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">
          Character anchor
        </p>
        <p className="text-[0.75rem] text-on-surface-variant font-mono leading-relaxed">
          {d.character_anchor}
        </p>
      </div>

      {/* Keyframes list */}
      {expanded && d.keyframes?.length > 0 && (
        <div className="divide-y divide-white/5">
          {d.keyframes.map((kf) => (
            <div key={kf.scene_number} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded',
                    SECTION_COLOR[kf.section] ?? 'text-on-surface-variant bg-surface-high'
                  )}>
                    {kf.section}
                  </span>
                  <span className="text-[0.6875rem] font-mono text-on-surface-muted">
                    Cena {kf.scene_number} · {kf.duration_seconds}s · {kf.camera_angle} · {kf.mood}
                  </span>
                </div>
                <CopyButton text={kf.veo3_prompt_en} />
              </div>

              {/* VEO3 prompt */}
              <div className="bg-surface-high rounded-lg p-3 mb-2">
                <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">VEO 3</p>
                <p className="text-[0.75rem] text-on-surface leading-relaxed font-mono">
                  {kf.veo3_prompt_en}
                </p>
              </div>

              {/* Midjourney prompt */}
              <div className="bg-surface-high rounded-lg p-3">
                <p className="text-[0.625rem] text-on-surface-muted uppercase tracking-widest mb-1">Midjourney</p>
                <p className="text-[0.75rem] text-on-surface leading-relaxed font-mono">
                  {kf.midjourney_prompt_en}
                </p>
              </div>

              {kf.overlay_suggestion && (
                <p className="mt-2 text-[0.6875rem] text-[#FCD34D]">
                  Overlay: {kf.overlay_suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Video pipeline row (mantido do original) ───────────────────────── */
function VideoPipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const cost      = parseFloat(pipeline.cost_so_far_usd ?? '0')
  const isRunning = pipeline.status === 'running'

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl p-5 hover:bg-surface-high transition-colors duration-150">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#60A5FA]/10 flex items-center justify-center shrink-0">
            <Film size={18} strokeWidth={1.5} className="text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface font-mono">{pipeline.goal}</p>
            <p className="text-[0.6875rem] text-on-surface-muted/60 mt-0.5">
              {new Date(pipeline.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={pipeline.status as 'running' | 'done' | 'failed' | 'pending' | 'paused'} />
          {isRunning && pipeline.progress_pct != null && (
            <span className="text-xs font-mono text-[#60A5FA]">{pipeline.progress_pct}%</span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-white/5">
        <span className="text-xs text-on-surface-muted font-mono">Custo: ${cost.toFixed(4)}</span>
        {isRunning ? (
          <span className="flex items-center gap-1.5 text-xs text-[#60A5FA]">
            <Loader2 size={10} strokeWidth={1.5} className="animate-spin" /> Em produção…
          </span>
        ) : pipeline.status === 'done' ? (
          <span className="text-xs text-[#4ADE80] font-medium">Concluído</span>
        ) : null}
      </div>
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function CriativosTabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl bg-surface-highest" />
      ))}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface CriativosTabProps {
  pipelines: Pipeline[]
  sku:       string
}

export function CriativosTab({ pipelines, sku }: CriativosTabProps) {
  const [scripts,   setScripts]   = useState<KnowledgeRow<ScriptData>[]>([])
  const [keyframes, setKeyframes] = useState<KnowledgeRow<KeyframesData>[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}/knowledge?type=script&status=fresh`).then(r => r.json()),
      fetch(`/api/products/${sku}/knowledge?type=keyframes&status=fresh`).then(r => r.json()),
    ]).then(([s, k]) => {
      setScripts(s.knowledge ?? [])
      setKeyframes(k.knowledge ?? [])
    }).finally(() => setLoading(false))
  }, [sku])

  const videoPipelines = pipelines.filter(p => p.goal === 'video_prod')
  const hasContent     = scripts.length > 0 || keyframes.length > 0 || videoPipelines.length > 0

  if (loading) return <CriativosTabSkeleton />

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Film size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum criativo gerado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            Execute o pipeline completo para gerar roteiro, keyframes e criativos de vídeo.
            Os agentes <span className="font-mono text-brand">script_writer</span> e{' '}
            <span className="font-mono text-brand">keyframe_generator</span> produzem estes artefatos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Roteiros ── */}
      {scripts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} strokeWidth={1.5} className="text-[#F28705]" />
            <h3 className="text-sm font-semibold text-on-surface">
              Roteiros ({scripts.length})
            </h3>
          </div>
          <div className="space-y-3">
            {scripts.map(row => (
              <ScriptCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* ── Keyframes ── */}
      {keyframes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Grid3x3 size={16} strokeWidth={1.5} className="text-[#60A5FA]" />
            <h3 className="text-sm font-semibold text-on-surface">
              Keyframes / Prompts visuais ({keyframes.length})
            </h3>
          </div>
          <div className="space-y-3">
            {keyframes.map(row => (
              <KeyframesCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* ── Pipelines de vídeo (produção) ── */}
      {videoPipelines.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Film size={16} strokeWidth={1.5} className="text-[#60A5FA]" />
            <h3 className="text-sm font-semibold text-on-surface">
              Pipelines de produção de vídeo ({videoPipelines.length})
            </h3>
          </div>
          <div className="space-y-3">
            {videoPipelines.map(p => (
              <VideoPipelineRow key={p.id} pipeline={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
