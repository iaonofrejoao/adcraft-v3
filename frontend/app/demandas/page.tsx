'use client'
import { Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { LayoutGrid, Table2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelines, type PipelineFilters as Filters } from '@/hooks/usePipelines'
import { PipelineTable } from '@/components/demandas/PipelineTable'
import { PipelineFilters } from '@/components/demandas/PipelineFilters'
import { KanbanBoard } from '@/components/demandas-kanban'
import { useTasks } from '@/hooks/useTasks'

// ── URL ↔ filter helpers ──────────────────────────────────────────────────────

function filtersFromParams(p: URLSearchParams): Filters {
  const status   = p.get('status')
  const dateFrom = p.get('date_from') ?? undefined
  const dateTo   = p.get('date_to')   ?? undefined
  return {
    status:   status ? status.split(',').filter(Boolean) : undefined,
    dateFrom,
    dateTo,
  }
}

function filtersToParams(f: Filters, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base.toString())
  if (f.status?.length) next.set('status', f.status.join(','))
  else                   next.delete('status')
  if (f.dateFrom) next.set('date_from', f.dateFrom)
  else            next.delete('date_from')
  if (f.dateTo)   next.set('date_to', f.dateTo)
  else            next.delete('date_to')
  return next
}

// ── Vista Kanban (tasks-level) ────────────────────────────────────────────────

function KanbanView() {
  const params           = useSearchParams()
  const filterPipelineId = params.get('pipeline') ?? undefined
  const { tasks, isLoading, tasksByStatus } = useTasks()

  return (
    <KanbanBoard
      tasks={tasks}
      isLoading={isLoading}
      tasksByStatus={tasksByStatus}
      filterPipelineId={filterPipelineId}
    />
  )
}

// ── Vista Tabela (pipelines-level) ────────────────────────────────────────────

function TableView() {
  const params   = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()

  // Inicializa filtros a partir da URL
  const urlFilters = filtersFromParams(params)

  const {
    pipelines, total, isLoading, page, pageSize, filters,
    setPage, setFilters, reload,
  } = usePipelines(50, urlFilters)

  // Sincroniza alterações de filtro com a URL
  const handleFiltersChange = useCallback((f: Filters) => {
    setFilters(f)
    const next = filtersToParams(f, params)
    // Mantém o param ?view= atual
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [setFilters, params, router, pathname])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barra de filtros */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-outline-variant/10">
        <p className="text-[12px] text-on-surface-muted">
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw size={11} strokeWidth={1.5} className="animate-spin" />
              Carregando…
            </span>
          ) : (
            `${total} execuções`
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            title="Recarregar"
            className="p-1.5 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
          <PipelineFilters filters={filters} onChange={handleFiltersChange} />
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3">
        <PipelineTable
          pipelines={pipelines}
          total={total}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          onSetPage={setPage}
        />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

type ViewMode = 'table' | 'kanban'

function DemandasContent() {
  const router       = useSearchParams()
  const view: ViewMode = (router.get('view') as ViewMode) ?? 'table'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface leading-none">
            Demandas
          </h2>
          <p className="text-[14px] text-on-surface-muted mt-1.5">
            Painel de controle operacional — pipelines e agentes em execução.
          </p>
        </div>

        {/* Toggle de vista */}
        <ViewToggle current={view} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0">
        {view === 'table' ? <TableView /> : <KanbanView />}
      </div>
    </div>
  )
}

// ── Toggle de vista ───────────────────────────────────────────────────────────

function ViewToggle({ current }: { current: ViewMode }) {
  const router   = useRouter()
  const params   = useSearchParams()

  const navigate = useCallback(
    (mode: ViewMode) => {
      const p = new URLSearchParams(params.toString())
      p.set('view', mode)
      router.push(`/demandas?${p.toString()}`)
    },
    [router, params]
  )

  return (
    <div className="flex items-center bg-surface-container p-1 rounded-lg border border-outline-variant/10">
      <button
        onClick={() => navigate('table')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
          current === 'table'
            ? 'bg-surface-container-high text-on-surface'
            : 'text-on-surface-muted hover:text-on-surface-variant',
        )}
      >
        <Table2 size={13} strokeWidth={1.5} />
        Tabela
      </button>
      <button
        onClick={() => navigate('kanban')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
          current === 'kanban'
            ? 'bg-surface-container-high text-on-surface'
            : 'text-on-surface-muted hover:text-on-surface-variant',
        )}
      >
        <LayoutGrid size={13} strokeWidth={1.5} />
        Kanban
      </button>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function DemandasPage() {
  return (
    <Suspense>
      <DemandasContent />
    </Suspense>
  )
}
