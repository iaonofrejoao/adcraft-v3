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
        <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B6460] pointer-events-none" />
        <input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Buscar produto…"
          className={cn(
            'pl-8 pr-7 py-1.5 text-[0.75rem] rounded-lg bg-[#1C1B1C] border border-[#584237]/20',
            'text-[#E8E3DD] placeholder:text-[#6B6460] outline-none',
            'focus:border-[#F28705]/40 transition-colors w-44'
          )}
        />
        {value.search && (
          <button
            onClick={() => onChange({ ...value, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6460] hover:text-[#E8E3DD] transition-colors"
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
                ? 'bg-[#F28705]/20 text-[#F28705] ring-1 ring-[#F28705]/30'
                : 'bg-[#1C1B1C] text-[#6B6460] hover:text-[#E8E3DD] hover:bg-[#2A2829]'
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}
