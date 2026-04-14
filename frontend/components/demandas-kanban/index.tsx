'use client'
import {
  Clock, RefreshCw, MessageSquare, CheckCircle2, XCircle, Zap, X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KanbanColumn } from './KanbanColumn'
import { KanbanFilters } from './KanbanFilters'
import type { UseTasksReturn } from '@/hooks/useTasks'

// ── Definição das colunas ─────────────────────────────────────────────────────

interface ColumnConfig {
  id: string
  label: string
  icon: LucideIcon
  colorClass: string
}

const COLUMNS: ColumnConfig[] = [
  { id: 'pending', label: 'Aguardando',          icon: Clock,        colorClass: 'text-[#9E9489]' },
  { id: 'running', label: 'Rodando',              icon: RefreshCw,    colorClass: 'text-[#60A5FA]' },
  { id: 'paused',  label: 'Aprovação Pendente',   icon: MessageSquare,colorClass: 'text-[#FCD34D]' },
  { id: 'done',    label: 'Concluído',             icon: CheckCircle2, colorClass: 'text-[#4ADE80]' },
  { id: 'failed',  label: 'Falhou',               icon: XCircle,      colorClass: 'text-[#F87171]' },
]

// ── Componente principal ──────────────────────────────────────────────────────

export interface KanbanBoardProps extends UseTasksReturn {
  filterPipelineId?: string
}

export function KanbanBoard({ isLoading, tasksByStatus, filterPipelineId }: KanbanBoardProps) {
  const filteredByStatus = filterPipelineId
    ? Object.fromEntries(
        Object.entries(tasksByStatus).map(([status, tasks]) => [
          status,
          tasks.filter((t) => t.pipeline_id === filterPipelineId),
        ])
      )
    : tasksByStatus

  if (isLoading) {
    return (
      <div className="flex gap-6 p-6 overflow-hidden h-full bg-[#131314]">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-[280px] shrink-0 space-y-4">
            <Skeleton className="h-5 w-36 bg-[#2A2829]" />
            <Skeleton className="h-28 w-full bg-[#2A2829] rounded-xl" />
            <Skeleton className="h-24 w-full bg-[#2A2829] rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#131314]">
      {/* Cabeçalho da página */}
      <div className="flex items-end justify-between px-6 pt-6 pb-5 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#E8E3DD] leading-none">
            Demandas
          </h2>
          <p className="text-[14px] text-[#6B6460] mt-1.5">
            Pipelines em andamento e histórico operacional da rede AdCraft.
          </p>
        </div>
        <KanbanFilters />
      </div>

      {/* Banner de filtro ativo */}
      {filterPipelineId && (
        <div className="px-6 pb-3 shrink-0">
          <Alert className="bg-[#F28705]/10 border-[#F28705]/30 py-2.5">
            <AlertDescription className="flex items-center justify-between text-[13px] text-[#F28705]">
              <span>
                Mostrando apenas o pipeline{' '}
                <span className="font-mono font-bold">
                  {filterPipelineId.slice(0, 8).toUpperCase()}
                </span>
              </span>
              <Link
                href="/demandas"
                className="flex items-center gap-1 text-[#9E9489] hover:text-[#E8E3DD] transition-colors text-[12px]"
              >
                <X size={12} strokeWidth={1.5} />
                Limpar filtro
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Board — scroll horizontal, colunas com scroll independente */}
      <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-20">
        <div className="flex gap-6 h-full min-w-max">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              {...col}
              tasks={filteredByStatus[col.id] ?? []}
            />
          ))}
        </div>
      </div>

      {/* AI Command Bar flutuante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[520px] bg-[#353436]/80 backdrop-blur-[12px] border border-[#F28705]/20 rounded-full shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.05)] px-5 py-3 flex items-center gap-3 z-50">
        <Zap size={18} strokeWidth={1.5} className="text-[#F28705] shrink-0" />
        <Input
          placeholder="Pergunte ao AI Agent sobre o status das demandas..."
          className="bg-transparent border-none shadow-none ring-0 focus-visible:ring-0 text-[14px] text-[#E8E3DD] placeholder:text-[#6B6460] flex-1 h-auto p-0"
        />
        <div className="flex items-center gap-1 shrink-0">
          <kbd className="px-2 py-1 bg-[#201F20] rounded text-[10px] text-[#6B6460] font-mono">⌘</kbd>
          <kbd className="px-2 py-1 bg-[#201F20] rounded text-[10px] text-[#6B6460] font-mono">K</kbd>
        </div>
      </div>
    </div>
  )
}
