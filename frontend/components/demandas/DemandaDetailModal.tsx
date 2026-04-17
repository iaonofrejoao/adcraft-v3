'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink, Loader2, XCircle, Clock, DollarSign,
  CheckCircle2, RefreshCw, AlertTriangle, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  agent_name: string
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface PipelineDetail {
  id: string
  goal: string
  status: string
  cost_so_far_usd: string | null
  created_at: string
  completed_at: string | null
  product_id: string | null
  product: { name: string; sku: string } | null
  tasks: TaskRow[]
  tasks_total: number
  tasks_done: number
  progress_pct: number
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DemandaDetailModalProps {
  pipelineId: string | null
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.round(diff / 60_000)
  const hours = Math.round(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (days > 0)   return `há ${days}d`
  if (hours > 0)  return `há ${hours}h`
  if (mins > 0)   return `há ${mins}min`
  return 'agora'
}

function formatDuration(start: string, end: string | null): string {
  const endDate = end ? new Date(end) : new Date()
  const s = Math.max(0, Math.round((endDate.getTime() - new Date(start).getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}

function formatCost(raw: string | null): string {
  if (!raw) return '—'
  const n = parseFloat(raw)
  return isNaN(n) ? '—' : `$${n.toFixed(4)}`
}

function agentLabel(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function goalLabel(goal: string): string {
  const map: Record<string, string> = {
    market_only:   'Estudo de mercado',
    avatar_only:   'Pesquisa de persona',
    angles_only:   'Geração de ângulos',
    copy_only:     'Geração de copy',
    creative_full: 'Criativo completo',
  }
  return map[goal] ?? goal.replace(/_/g, ' ')
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = {
    completed: 'bg-green-400',
    done:      'bg-green-400',
    running:   'bg-blue-400 animate-pulse',
    failed:    'bg-red-400',
    skipped:   'bg-green-400/60',
    pending:   'bg-on-surface-muted/30',
    waiting:   'bg-on-surface-muted/30',
  }[status] ?? 'bg-on-surface-muted/30'

  return <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DemandaDetailModal({ pipelineId, onClose }: DemandaDetailModalProps) {
  const router = useRouter()
  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!pipelineId) {
      setPipeline(null)
      return
    }
    setLoading(true)
    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setPipeline(data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [pipelineId])

  const handleCancel = async () => {
    if (!pipelineId) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')
      toast.success('Demanda cancelada')
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const shortId = pipelineId?.slice(0, 8).toUpperCase() ?? ''
  const runningTask = pipeline?.tasks.find((t) => t.status === 'running')
  const failedTasks = pipeline?.tasks.filter((t) => t.status === 'failed') ?? []

  return (
    <Dialog open={!!pipelineId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'bg-surface-container border border-white/8 text-on-surface',
          'w-full max-w-md p-0 gap-0 overflow-hidden rounded-2xl'
        )}
        showCloseButton={false}
      >
        {/* ── Header com gradiente sutil ──────────────────────────────── */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-b from-surface-container-high/40 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <XCircle size={16} strokeWidth={1.5} />
          </button>

          {/* Goal badge + ID */}
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} strokeWidth={1.5} className="text-brand shrink-0" />
            <span className="text-[0.75rem] font-semibold text-brand uppercase tracking-wide">
              {pipeline ? goalLabel(pipeline.goal) : '…'}
            </span>
            <span className="font-mono text-[0.625rem] text-on-surface-muted bg-surface-container-high px-1.5 py-0.5 rounded">
              #{shortId}
            </span>
          </div>

          {/* Produto */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {pipeline?.product ? (
                <Link
                  href={`/products/${pipeline.product.sku}`}
                  onClick={onClose}
                  className="text-[1.0625rem] font-bold text-on-surface hover:text-brand transition-colors truncate block"
                >
                  {pipeline.product.name}
                </Link>
              ) : (
                <p className="text-[1.0625rem] font-bold text-on-surface">
                  {loading ? '…' : 'Sem produto'}
                </p>
              )}
            </div>
            {pipeline && <StatusBadge status={pipeline.status} />}
          </div>
        </div>

        {/* ── Conteúdo ────────────────────────────────────────────────── */}
        <div className="px-5 pb-4 space-y-4">

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-2 w-full bg-surface-container-high rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-xl bg-surface-container-high" />)}
              </div>
              <Skeleton className="h-24 rounded-xl bg-surface-container-high" />
            </div>
          ) : pipeline ? (
            <>
              {/* Barra de progresso */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[0.6875rem] text-on-surface-muted">
                  <span>{pipeline.tasks_done} de {pipeline.tasks_total} agentes concluídos</span>
                  <span className="font-mono font-semibold text-on-surface">{pipeline.progress_pct}%</span>
                </div>
                <Progress value={pipeline.progress_pct} className="h-1.5 bg-surface-container-high" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-container-high rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1 text-on-surface-muted">
                    <DollarSign size={11} strokeWidth={1.5} />
                    <span className="text-[0.625rem] uppercase tracking-wide">Custo</span>
                  </div>
                  <p className="font-mono font-bold text-[0.875rem] text-on-surface">
                    {formatCost(pipeline.cost_so_far_usd)}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1 text-on-surface-muted">
                    <Clock size={11} strokeWidth={1.5} />
                    <span className="text-[0.625rem] uppercase tracking-wide">Início</span>
                  </div>
                  <p className="font-mono font-bold text-[0.875rem] text-on-surface">
                    {formatRelative(pipeline.created_at)}
                  </p>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1 text-on-surface-muted">
                    <RefreshCw size={11} strokeWidth={1.5} />
                    <span className="text-[0.625rem] uppercase tracking-wide">Duração</span>
                  </div>
                  <p className="font-mono font-bold text-[0.875rem] text-on-surface">
                    {formatDuration(pipeline.created_at, pipeline.completed_at)}
                  </p>
                </div>
              </div>

              {/* Agente ativo */}
              {runningTask && (
                <div className="flex items-center gap-2.5 bg-blue-400/8 border border-blue-400/20 rounded-xl px-3.5 py-2.5">
                  <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[0.75rem] text-blue-300 font-medium truncate">
                      {agentLabel(runningTask.agent_name)}
                    </p>
                    {runningTask.started_at && (
                      <p className="text-[0.625rem] text-blue-400/60 font-mono mt-0.5">
                        rodando há {formatDuration(runningTask.started_at, null)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Falhas */}
              {failedTasks.length > 0 && (
                <div className="flex items-start gap-2.5 bg-red-400/8 border border-red-400/20 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle size={13} strokeWidth={1.5} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[0.75rem] text-red-300 font-medium">
                      {failedTasks.length} agente{failedTasks.length > 1 ? 's' : ''} falharam
                    </p>
                    <p className="text-[0.625rem] text-red-400/60 truncate mt-0.5">
                      {failedTasks.map((t) => agentLabel(t.agent_name)).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Steps resumidos */}
              {pipeline.tasks.length > 0 && (
                <div className="space-y-0">
                  <p className="text-[0.625rem] font-bold uppercase tracking-widest text-on-surface-muted mb-2">
                    Agentes
                  </p>
                  <div className="space-y-1.5">
                    {pipeline.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2.5 text-[0.75rem]">
                        <StatusDot status={task.status} />
                        <span className={cn(
                          'flex-1 truncate',
                          task.status === 'completed' || task.status === 'skipped'
                            ? 'text-on-surface-variant'
                            : task.status === 'running'
                            ? 'text-blue-300'
                            : task.status === 'failed'
                            ? 'text-red-300'
                            : 'text-on-surface-muted'
                        )}>
                          {agentLabel(task.agent_name)}
                        </span>
                        {(task.status === 'completed' || task.status === 'skipped') && task.completed_at && (
                          <span className="text-on-surface-muted font-mono shrink-0 text-[0.625rem]">
                            {formatRelative(task.completed_at)}
                          </span>
                        )}
                        {task.status === 'skipped' && (
                          <span className="text-[0.5625rem] text-green-400/60 shrink-0">↻</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-on-surface-muted text-center py-4">
              Erro ao carregar demanda.
            </p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter
          className="px-5 py-3.5 border-t border-white/5 flex-row justify-between gap-2"
          showCloseButton={false}
        >
          {pipeline?.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cancelling}
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 text-[0.8125rem]"
            >
              {cancelling ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin mr-1.5" />
              ) : (
                <XCircle size={14} strokeWidth={1.5} className="mr-1.5" />
              )}
              Cancelar
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => {
              onClose()
              router.push(`/demandas/${pipelineId}`)
            }}
            className="ml-auto text-[0.8125rem] bg-brand text-[#131314] hover:bg-brand/90"
          >
            <ExternalLink size={14} strokeWidth={1.5} className="mr-1.5" />
            Ver detalhes completos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
