'use client'
import { useState } from 'react'
import {
  Clock, RefreshCw, MessageSquare, CheckCircle2, XCircle, Zap, X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KanbanColumn } from './KanbanColumn'
import { KanbanFilters, type KanbanFiltersValue } from './KanbanFilters'
import type { UseTasksReturn } from '@/hooks/useTasks'

interface ColumnConfig {
  id: string
  label: string
  icon: LucideIcon
  colorClass: string
}

const COLUMNS: ColumnConfig[] = [
  { id: 'pending', label: 'Aguardando',        icon: Clock,         colorClass: 'text-on-surface-variant' },
  { id: 'running', label: 'Rodando',            icon: RefreshCw,     colorClass: 'text-status-running-text' },
  { id: 'paused',  label: 'Aprovação Pendente', icon: MessageSquare, colorClass: 'text-status-paused-text' },
  { id: 'done',    label: 'Concluído',           icon: CheckCircle2,  colorClass: 'text-status-done-text' },
  { id: 'failed',  label: 'Falhou',             icon: XCircle,       colorClass: 'text-status-failed-text' },
]

export interface KanbanBoardProps extends UseTasksReturn {
  filterPipelineId?: string
  onCardClick?: (pipelineId: string) => void
  onDelete?:    (pipelineId: string) => void
}

export function KanbanBoard({ isLoading, tasksByStatus, filterPipelineId, onCardClick, onDelete }: KanbanBoardProps) {
  const [filters, setFilters] = useState<KanbanFiltersValue>({ search: '', goal: 'all' })

  const mergedByStatus: typeof tasksByStatus = {
    ...tasksByStatus,
    done: [...(tasksByStatus['done'] ?? []), ...(tasksByStatus['skipped'] ?? [])],
  }

  const filteredByStatus = Object.fromEntries(
    Object.entries(mergedByStatus).map(([status, tasks]) => {
      let list = tasks
      if (filterPipelineId) {
        list = list.filter((t) => t.pipeline_id === filterPipelineId)
      }
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        list = list.filter(
          (t) =>
            t.pipeline?.product?.name?.toLowerCase().includes(q) ||
            t.pipeline_id.slice(0, 8).toLowerCase().includes(q)
        )
      }
      if (filters.goal !== 'all') {
        list = list.filter((t) => t.agent_name === filters.goal)
      }
      return [status, list]
    })
  )

  if (isLoading) {
    return (
      <div className="flex gap-6 p-6 overflow-hidden h-full bg-background">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-[280px] shrink-0 space-y-4">
            <Skeleton className="h-5 w-36 bg-surface-high" />
            <Skeleton className="h-28 w-full bg-surface-high rounded-xl" />
            <Skeleton className="h-24 w-full bg-surface-high rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between px-6 pt-6 pb-4 shrink-0 flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface leading-none">
            Demandas
          </h2>
          <p className="text-sm text-on-surface-muted mt-1.5">
            Pipelines em andamento e histórico operacional da rede AdCraft.
          </p>
        </div>
        <KanbanFilters value={filters} onChange={setFilters} />
      </div>

      {/* Banner de filtro ativo */}
      {filterPipelineId && (
        <div className="px-6 pb-3 shrink-0">
          <Alert className="bg-brand-muted border-brand/30 py-2.5">
            <AlertDescription className="flex items-center justify-between text-[13px] text-brand">
              <span>
                Mostrando apenas o pipeline{' '}
                <span className="font-mono font-bold">
                  {filterPipelineId.slice(0, 8).toUpperCase()}
                </span>
              </span>
              <Link
                href="/demandas"
                className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors duration-150 text-[12px]"
              >
                <X size={12} strokeWidth={1.5} />
                Limpar filtro
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-20">
        <div className="flex gap-6 h-full min-w-max">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              {...col}
              tasks={filteredByStatus[col.id] ?? []}
              onCardClick={onCardClick}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {/* AI Command Bar flutuante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[520px]
        bg-surface-highest/80 backdrop-blur-[12px]
        border border-brand/20 rounded-full shadow-ambient
        px-5 py-3 flex items-center gap-3 z-50">
        <Zap size={18} strokeWidth={1.5} className="text-brand shrink-0" />
        <Input
          placeholder="Pergunte ao AI Agent sobre o status das demandas..."
          className="bg-transparent border-none shadow-none ring-0 focus-visible:ring-0 text-sm text-on-surface placeholder:text-on-surface-muted flex-1 h-auto p-0"
        />
        <div className="flex items-center gap-1 shrink-0">
          <kbd className="px-2 py-1 bg-surface-container rounded text-[10px] text-on-surface-muted font-mono">⌘</kbd>
          <kbd className="px-2 py-1 bg-surface-container rounded text-[10px] text-on-surface-muted font-mono">K</kbd>
        </div>
      </div>
    </div>
  )
}
