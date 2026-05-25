'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Video, Clapperboard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { CopyCombination } from '@/hooks/useCopyBoard'

/* ── Video toggle ────────────────────────────────────────────────────── */
function VideoToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-8 h-4 rounded-full transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        checked ? 'bg-brand' : 'bg-surface-highest',
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  )
}

/* ── Script status badge ─────────────────────────────────────────────── */
function ScriptStatusBadge({ status }: { status: CopyCombination['script_status'] }) {
  if (!status || status === 'pending') return null

  const map = {
    queued: {
      icon: <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />,
      label: 'na fila',
      cls: 'text-on-surface-muted bg-surface-highest',
    },
    generating: {
      icon: <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />,
      label: 'gerando…',
      cls: 'text-status-running-text bg-status-running',
    },
    ready: {
      icon: <CheckCircle2 size={10} strokeWidth={1.5} />,
      label: 'pronto',
      cls: 'text-status-done-text bg-status-done',
    },
    error: {
      icon: <AlertCircle size={10} strokeWidth={1.5} />,
      label: 'erro',
      cls: 'text-status-failed-text bg-status-failed',
    },
  } as const

  const { icon, label, cls } = map[status as keyof typeof map]

  return (
    <span className={cn('flex items-center gap-1 text-[0.625rem] font-mono px-1.5 py-0.5 rounded', cls)}>
      {icon} {label}
    </span>
  )
}

/* ── Combination row ─────────────────────────────────────────────────── */
interface CombinationRowProps {
  combination:     CopyCombination
  onToggleVideo:   (selected: boolean) => void
  onGenerateScript: () => void
}

function CombinationRow({ combination: c, onToggleVideo, onGenerateScript }: CombinationRowProps) {
  const [expanded, setExpanded] = useState(false)
  const scriptStatus = c.script_status ?? 'pending'
  const isGenerating = scriptStatus === 'generating' || scriptStatus === 'queued'

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 transition-all duration-150',
      c.selected_for_video
        ? 'bg-surface-container border-brand/30'
        : 'bg-surface-container border-white/5',
    )}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.6875rem] text-brand shrink-0">{c.tag}</span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-auto p-0 gap-1 text-[0.6875rem] text-on-surface-muted
            hover:text-on-surface-variant hover:bg-transparent"
        >
          {expanded
            ? <ChevronUp size={12} strokeWidth={1.5} />
            : <ChevronDown size={12} strokeWidth={1.5} />}
          {expanded ? 'ocultar' : 'ver texto'}
        </Button>

        <ScriptStatusBadge status={c.script_status} />

        <div className="ml-auto flex items-center gap-3">
          {/* Gerar script button */}
          {(scriptStatus === 'pending' || scriptStatus === 'error') && (
            <button
              onClick={onGenerateScript}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.6875rem] font-medium',
                'bg-surface-high border border-white/5 text-on-surface-variant',
                'hover:bg-surface-highest hover:text-on-surface transition-all duration-150',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              <Clapperboard size={11} strokeWidth={1.5} />
              {scriptStatus === 'error' ? 'Tentar novamente' : 'Gerar script'}
            </button>
          )}

          {/* Video toggle */}
          <div className="flex items-center gap-2">
            <Video size={12} strokeWidth={1.5} className="text-on-surface-muted" />
            <span className="text-[0.625rem] text-on-surface-muted">Gerar vídeo</span>
            <VideoToggle checked={c.selected_for_video} onChange={onToggleVideo} />
          </div>
        </div>
      </div>

      {expanded && c.full_text && (
        <div className="mt-3 pt-3 border-t border-white/5
          text-[0.6875rem] text-on-surface-variant leading-relaxed whitespace-pre-wrap">
          {c.full_text}
        </div>
      )}
    </div>
  )
}

/* ── Combinations list ───────────────────────────────────────────────── */
interface CombinacoesListProps {
  combinations:    CopyCombination[]
  onToggleVideo:   (id: string, selected: boolean) => void
  onGenerateScript: (id: string) => void
}

export function CombinacoesList({ combinations, onToggleVideo, onGenerateScript }: CombinacoesListProps) {
  if (combinations.length === 0) return null

  const selectedCount   = combinations.filter((c) => c.selected_for_video).length
  const readyCount      = combinations.filter((c) => c.script_status === 'ready').length
  const queuedCount     = combinations.filter((c) => c.script_status === 'queued').length
  const generatingCount = combinations.filter((c) => c.script_status === 'generating').length

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-on-surface">
          Combinações{' '}
          <span className="text-on-surface-muted text-sm font-normal">
            ({combinations.length})
          </span>
        </h3>
        <div className="flex items-center gap-3 text-[0.6875rem] font-mono text-on-surface-muted">
          {readyCount > 0 && (
            <span className="text-status-done-text">{readyCount} script{readyCount !== 1 ? 's' : ''} prontos</span>
          )}
          {queuedCount > 0 && (
            <span className="text-on-surface-muted flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {queuedCount} na fila — rode no Claude Code
            </span>
          )}
          {generatingCount > 0 && (
            <span className="text-status-running-text flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {generatingCount} gerando…
            </span>
          )}
          <span>{selectedCount} selecionada{selectedCount !== 1 ? 's' : ''} para vídeo</span>
        </div>
      </div>

      <div className="space-y-2">
        {combinations.map((combo) => (
          <CombinationRow
            key={combo.id}
            combination={combo}
            onToggleVideo={(selected) => onToggleVideo(combo.id, selected)}
            onGenerateScript={() => onGenerateScript(combo.id)}
          />
        ))}
      </div>
    </div>
  )
}
