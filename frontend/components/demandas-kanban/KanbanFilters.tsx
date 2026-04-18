'use client'
import { FilterBar, type FilterOption } from '@/components/ui/FilterBar'

const GOAL_PILLS: FilterOption[] = [
  { value: 'all',                 label: 'Todos'    },
  { value: 'market_research',     label: 'Mercado'  },
  { value: 'avatar_research',     label: 'Persona'  },
  { value: 'angle_generator',     label: 'Ângulos'  },
  { value: 'copy_hook_generator', label: 'Copy'     },
  { value: 'video_maker',         label: 'Criativo' },
]

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
    <FilterBar
      search={value.search}
      onSearchChange={(s) => onChange({ ...value, search: s })}
      searchPlaceholder="Buscar produto…"
      pills={GOAL_PILLS}
      activePill={value.goal}
      onPillChange={(g) => onChange({ ...value, goal: g })}
    />
  )
}
