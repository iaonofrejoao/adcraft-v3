'use client'
import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { PipelineFilters as Filters } from '@/hooks/usePipelines'

// ── Status disponíveis para filtro ────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'pending',            label: 'Pendente',   color: 'text-on-surface-variant' },
  { value: 'running',            label: 'Rodando',    color: 'text-[#60A5FA]' },
  { value: 'paused_for_approval',label: 'Aprovação',  color: 'text-status-paused-text' },
  { value: 'completed',          label: 'Concluído',  color: 'text-status-done-text' },
  { value: 'failed',             label: 'Falhou',     color: 'text-status-failed-text' },
  { value: 'cancelled',          label: 'Cancelado',  color: 'text-on-surface-muted' },
] as const

export interface PipelineFiltersProps {
  filters:    Filters
  onChange:   (f: Filters) => void
  className?: string
}

export function PipelineFilters({ filters, onChange, className }: PipelineFiltersProps) {
  const [open, setOpen] = useState(false)

  const hasActiveFilters =
    (filters.status?.length ?? 0) > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo

  const toggleStatus = (value: string) => {
    const current = filters.status ?? []
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value]
    onChange({ ...filters, status: next.length ? next : undefined })
  }

  const clearAll = () => onChange({})

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'gap-2 text-[12px] border',
          hasActiveFilters
            ? 'border-primary/40 text-primary bg-brand-muted'
            : 'border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
        )}
      >
        <Filter size={13} strokeWidth={1.5} />
        Filtros
        {hasActiveFilters && (
          <span className="ml-0.5 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            {(filters.status?.length ?? 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Overlay para fechar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)] w-72 p-4 space-y-4">

            {/* Status */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-muted mb-2">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => {
                  const active = filters.status?.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleStatus(opt.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                        active
                          ? 'bg-surface-container border-outline-variant text-on-surface'
                          : 'border-outline-variant/10 text-on-surface-muted hover:border-outline-variant/30 hover:text-on-surface-variant',
                        active && opt.color,
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Período */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-muted mb-2">
                Período
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom?.slice(0, 10) ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      dateFrom: e.target.value ? `${e.target.value}T00:00:00Z` : undefined,
                    })
                  }
                  className="flex-1 bg-surface-container border border-outline-variant/20 text-on-surface text-[11px] rounded-md px-2 py-1.5 font-mono"
                />
                <input
                  type="date"
                  value={filters.dateTo?.slice(0, 10) ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      dateTo: e.target.value ? `${e.target.value}T23:59:59Z` : undefined,
                    })
                  }
                  className="flex-1 bg-surface-container border border-outline-variant/20 text-on-surface text-[11px] rounded-md px-2 py-1.5 font-mono"
                />
              </div>
            </div>

            {/* Limpar */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearAll(); setOpen(false) }}
                className="w-full gap-2 text-[11px] text-on-surface-variant hover:text-on-surface border border-outline-variant/15"
              >
                <X size={12} strokeWidth={1.5} />
                Limpar filtros
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
