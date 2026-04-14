'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { CopyCombination } from '@/hooks/useCopyBoard'

/* ── Video toggle — no Switch in ui/, Tailwind-only implementation ── */
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

/* ── Combination row ─────────────────────────────────────────────── */
interface CombinationRowProps {
  combination:   CopyCombination
  onToggleVideo: (selected: boolean) => void
}

function CombinationRow({ combination: c, onToggleVideo }: CombinationRowProps) {
  const [expanded, setExpanded] = useState(false)

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

        <div className="ml-auto flex items-center gap-2">
          <Video size={12} strokeWidth={1.5} className="text-on-surface-muted" />
          <span className="text-[0.625rem] text-on-surface-muted">Gerar vídeo</span>
          <VideoToggle checked={c.selected_for_video} onChange={onToggleVideo} />
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

/* ── Combinations list section ───────────────────────────────────── */
interface CombinacoesListProps {
  combinations:  CopyCombination[]
  onToggleVideo: (id: string, selected: boolean) => void
}

export function CombinacoesList({ combinations, onToggleVideo }: CombinacoesListProps) {
  if (combinations.length === 0) return null

  const selectedCount = combinations.filter((c) => c.selected_for_video).length

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-on-surface">
          Combinações{' '}
          <span className="text-on-surface-muted text-sm font-normal">
            ({combinations.length})
          </span>
        </h3>
        <span className="text-[0.6875rem] font-mono text-on-surface-muted">
          {selectedCount} selecionada{selectedCount !== 1 ? 's' : ''} para vídeo
        </span>
      </div>

      <div className="space-y-2">
        {combinations.map((combo) => (
          <CombinationRow
            key={combo.id}
            combination={combo}
            onToggleVideo={(selected) => onToggleVideo(combo.id, selected)}
          />
        ))}
      </div>
    </div>
  )
}
