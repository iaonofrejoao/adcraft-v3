'use client'
import Link from 'next/link'
import {
  ChevronRight, Download, RefreshCw,
  ArrowUpDown, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { PipelineRow } from '@/hooks/usePipelines'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day:    '2-digit',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(startIso: string, endIso: string | null): string {
  const end  = endIso ? new Date(endIso) : new Date()
  const diff = end.getTime() - new Date(startIso).getTime()
  const s    = Math.round(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatCost(raw: string | null): string {
  if (!raw) return '—'
  const n = parseFloat(raw)
  if (isNaN(n)) return '—'
  return `$${n.toFixed(4)}`
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

// ── Export de execução ────────────────────────────────────────────────────────

function exportPipeline(pipeline: PipelineRow) {
  const blob = new Blob([JSON.stringify(pipeline, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `pipeline-${shortId(pipeline.id)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2 px-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full bg-surface-container rounded-lg" />
      ))}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PipelineTableProps {
  pipelines:  PipelineRow[]
  total:      number
  isLoading:  boolean
  page:       number
  pageSize:   number
  onSetPage:  (p: number) => void
  onRowClick?: (id: string) => void
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PipelineTable({
  pipelines,
  total,
  isLoading,
  page,
  pageSize,
  onSetPage,
  onRowClick,
}: PipelineTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (isLoading) return <TableSkeleton />

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <Package size={32} strokeWidth={1} className="text-on-surface-muted mb-4" />
        <p className="text-[14px] text-on-surface-variant font-medium">Nenhuma execução encontrada</p>
        <p className="text-[12px] text-on-surface-muted mt-1">
          Tente ajustar os filtros ou aguarde uma nova execução.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabela */}
      <div className="flex-1 overflow-x-auto px-6">
        <table className="w-full min-w-[800px] text-[13px]">
          <thead>
            <tr className="border-b border-outline-variant/10">
              {[
                { label: 'ID',        cls: 'w-28' },
                { label: 'Produto',   cls: 'min-w-[160px]' },
                { label: 'Goal',      cls: 'min-w-[140px]' },
                { label: 'Status',    cls: 'w-32' },
                { label: 'Progresso', cls: 'w-36' },
                { label: 'Custo',     cls: 'w-24 text-right' },
                { label: 'Início',    cls: 'w-36' },
                { label: 'Duração',   cls: 'w-24' },
                { label: '',          cls: 'w-20' },
              ].map(({ label, cls }) => (
                <th
                  key={label || 'actions'}
                  className={cn(
                    'py-3 px-3 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-muted',
                    cls,
                  )}
                >
                  {label && (
                    <span className="flex items-center gap-1">
                      {label}
                      {['Custo', 'Início'].includes(label) && (
                        <ArrowUpDown size={10} strokeWidth={1.5} className="opacity-40" />
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-outline-variant/10">
            {pipelines.map((p) => (
              <tr
                key={p.id}
                onClick={() => onRowClick?.(p.id)}
                className="hover:bg-surface-container/50 transition-colors group cursor-pointer"
              >
                {/* ID */}
                <td className="py-3 px-3">
                  <span className="font-mono text-[11px] text-primary font-bold">
                    {shortId(p.id)}
                  </span>
                </td>

                {/* Produto */}
                <td className="py-3 px-3">
                  {p.product ? (
                    <div>
                      <p className="text-on-surface font-medium truncate max-w-[200px]">
                        {p.product.name}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-muted mt-0.5">
                        {p.product.sku}
                      </p>
                    </div>
                  ) : (
                    <span className="text-on-surface-muted">—</span>
                  )}
                </td>

                {/* Goal */}
                <td className="py-3 px-3">
                  <span className="text-on-surface-variant capitalize text-[12px] truncate block max-w-[160px]">
                    {p.goal.replace(/_/g, ' ')}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3 px-3">
                  <StatusBadge status={p.status} />
                </td>

                {/* Progresso */}
                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <Progress
                      value={p.progress_pct}
                      className="h-1.5 bg-surface-container-high"
                    />
                    <p className="font-mono text-[10px] text-on-surface-muted">
                      {p.tasks_done}/{p.tasks_total} steps
                    </p>
                  </div>
                </td>

                {/* Custo */}
                <td className="py-3 px-3 text-right">
                  <span className="font-mono text-[12px] text-on-surface-variant">
                    {formatCost(p.cost_so_far_usd)}
                  </span>
                </td>

                {/* Início */}
                <td className="py-3 px-3">
                  <span className="text-[11px] text-on-surface-muted">
                    {formatDate(p.created_at)}
                  </span>
                </td>

                {/* Duração */}
                <td className="py-3 px-3">
                  <span className="font-mono text-[11px] text-on-surface-muted">
                    {formatDuration(p.created_at, p.completed_at)}
                  </span>
                </td>

                {/* Ações */}
                <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Exportar JSON"
                      onClick={() => exportPipeline(p)}
                      className="p-1.5 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <Download size={13} strokeWidth={1.5} />
                    </button>
                    <Link
                      href={`/demandas/${p.id}`}
                      className="p-1.5 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
                      title="Ver detalhes"
                    >
                      <ChevronRight size={13} strokeWidth={1.5} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-outline-variant/10">
          <p className="text-[11px] text-on-surface-muted">
            {total} execuções · página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => onSetPage(page - 1)}
              className="h-7 px-2 text-[11px] text-on-surface-variant disabled:opacity-30"
            >
              Anterior
            </Button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const pg = page <= 3
                ? i
                : page >= totalPages - 4
                ? totalPages - 7 + i
                : page - 3 + i
              if (pg < 0 || pg >= totalPages) return null
              return (
                <button
                  key={pg}
                  onClick={() => onSetPage(pg)}
                  className={cn(
                    'h-7 w-7 rounded-md text-[11px] font-mono transition-colors',
                    pg === page
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high',
                  )}
                >
                  {pg + 1}
                </button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => onSetPage(page + 1)}
              className="h-7 px-2 text-[11px] text-on-surface-variant disabled:opacity-30"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
