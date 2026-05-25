'use client'
import { useEffect, useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Clapperboard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
  combination_tag:        string
  total_duration_seconds: number
  format:                 string
  framework_used:         string
  narration_full:         string
  cta_text:               string
  script_rationale:       string
  scenes:                 ScriptScene[]
}

interface ArtifactRow {
  id:                   string
  artifact_type:        string
  artifact_data:        ScriptData
  copy_combination_id:  string
  created_at:           string
  copy_combinations:    { tag: string; script_status: string } | null
}

/* ── Helpers ────────────────────────────────────────────────────────── */
const SECTION_COLOR: Record<string, string> = {
  hook:      'text-brand bg-brand-muted',
  problem:   'text-status-failed-text bg-status-failed',
  agitation: 'text-brand bg-brand-muted',
  mechanism: 'text-status-running-text bg-status-running',
  proof:     'text-status-done-text bg-status-done',
  offer:     'text-accent-violet bg-accent-violet/10',
  cta:       'text-status-paused-text bg-status-paused',
}

/* ── Script card ────────────────────────────────────────────────────── */
function ScriptCard({ row }: { row: ArtifactRow }) {
  const d = row.artifact_data
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText size={15} strokeWidth={1.5} className="text-brand" />
          <span className="text-sm font-semibold text-on-surface font-mono">
            {d.combination_tag ?? row.copy_combinations?.tag ?? '—'}
          </span>
          {d.format && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {d.format}
            </span>
          )}
          {d.framework_used && (
            <span className="text-[0.625rem] bg-surface-high text-on-surface-muted px-1.5 py-0.5 rounded font-mono">
              {d.framework_used}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {d.total_duration_seconds && (
            <span className="text-[0.6875rem] font-mono text-on-surface-muted">
              {d.total_duration_seconds}s · {d.scenes?.length ?? 0} cenas
            </span>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[0.6875rem] text-brand hover:underline"
          >
            {expanded ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
            {expanded ? 'Recolher' : 'Ver cenas'}
          </button>
        </div>
      </div>

      <div className="p-4">
        <p className="text-[0.75rem] text-on-surface-variant leading-relaxed italic">
          "{d.narration_full}"
        </p>
        {d.cta_text && (
          <p className="mt-2 text-[0.6875rem] font-semibold text-status-paused-text">CTA: {d.cta_text}</p>
        )}
      </div>

      {expanded && d.scenes?.length > 0 && (
        <div className="border-t border-white/5">
          {d.scenes.map((scene) => (
            <div key={scene.scene_number} className="p-4 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded',
                  SECTION_COLOR[scene.section] ?? 'text-on-surface-variant bg-surface-high',
                )}>
                  {scene.section}
                </span>
                <span className="text-[0.6875rem] font-mono text-on-surface-muted">
                  Cena {scene.scene_number} · {scene.duration_seconds}s · {scene.emotion_cue}
                </span>
              </div>
              <p className="text-[0.8125rem] text-on-surface mb-2 leading-relaxed">{scene.narration}</p>
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

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function ScriptsTabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl bg-surface-highest" />
      ))}
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────── */
export interface ScriptsTabProps {
  sku: string
}

export function ScriptsTab({ sku }: ScriptsTabProps) {
  const [scripts,  setScripts]  = useState<ArtifactRow[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}/creative-artifacts?type=script`)
      .then(r => r.json())
      .then(d => setScripts(d.artifacts ?? []))
      .finally(() => setLoading(false))
  }, [sku])

  if (loading) return <ScriptsTabSkeleton />

  if (scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Clapperboard size={22} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum script gerado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant max-w-xs">
            Aprove as copies na aba <span className="font-mono text-brand">Copy</span> e clique em
            "Gerar script" em cada combinação.
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
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} strokeWidth={1.5} className="text-brand" />
        <h3 className="text-sm font-semibold text-on-surface">
          Roteiros <span className="text-on-surface-muted font-normal">({scripts.length})</span>
        </h3>
      </div>
      {scripts.map(row => <ScriptCard key={row.id} row={row} />)}
    </div>
  )
}
