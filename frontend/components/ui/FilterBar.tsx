'use client'
import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterBarProps {
  /** Valor atual do campo de busca */
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string

  /** Pills de filtro (seleção única) */
  pills?: FilterOption[]
  activePill?: string
  onPillChange?: (v: string) => void

  /** Controles extras à direita (Switch, selects, etc.) */
  children?: ReactNode

  className?: string
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  pills,
  activePill,
  onPillChange,
  children,
  className,
}: FilterBarProps) {
  const hasSearch = onSearchChange !== undefined
  const hasPills  = pills && pills.length > 0 && onPillChange

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {hasSearch && (
        <div className="relative">
          <Search
            size={13}
            strokeWidth={1.5}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
          />
          <input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              'pl-8 pr-7 py-1.5 text-[0.8125rem] rounded-lg',
              'bg-surface-container border border-white/8',
              'text-on-surface placeholder:text-on-surface-muted outline-none',
              'focus:border-brand/40 transition-colors w-52',
            )}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface transition-colors"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {hasPills && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {pills.map((pill) => (
            <button
              key={pill.value}
              onClick={() => onPillChange(pill.value)}
              className={cn(
                'px-3 py-1 rounded-full text-[0.75rem] font-medium capitalize transition-colors',
                activePill === pill.value
                  ? 'bg-brand-muted text-brand ring-1 ring-brand/30'
                  : 'bg-surface-container text-on-surface-muted hover:text-on-surface hover:bg-surface-high',
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {children && (
        <div className="ml-auto flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  )
}
