'use client'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const GOALS = [
  { value: 'all',              label: 'Todos' },
  { value: 'market_research',  label: 'Mercado' },
  { value: 'avatar_research',  label: 'Persona' },
  { value: 'angle_generator',  label: 'Ângulos' },
  { value: 'copy_hook_generator', label: 'Copy' },
  { value: 'video_maker',      label: 'Criativo' },
] as const

export interface KanbanFiltersValue {
  search: string
  goal:   string
}

interface KanbanFiltersProps {
  value:    KanbanFiltersValue
  onChange: (v: KanbanFiltersValue) => void
}

export function KanbanFilters({ value, onChange }: KanbanFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none" />
        <input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Buscar produto…"
          className={cn(
            'pl-8 pr-7 py-1.5 text-[0.75rem] rounded-lg bg-surface-low border border-white/10',
            'text-on-surface placeholder:text-on-surface-muted outline-none',
            'focus:border-brand/40 transition-colors w-44'
          )}
        />
        {value.search && (
          <button
            onClick={() => onChange({ ...value, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface transition-colors"
          >
            <X size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Goal pills */}
      <div className="flex items-center gap-1">
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => onChange({ ...value, goal: g.value })}
            className={cn(
              'px-2.5 py-1 rounded-full text-[0.6875rem] font-medium transition-colors',
              value.goal === g.value
                ? 'bg-brand-muted text-brand ring-1 ring-brand/30'
                : 'bg-surface-low text-on-surface-muted hover:text-on-surface hover:bg-surface-high'
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}
