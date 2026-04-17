'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'

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
  const s = Math.round((endDate.getTime() - new Date(start).getTime()) / 1000)
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

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = {
    completed: 'bg-green-400',
    done:      'bg-green-400',
    running:   'bg-blue-400 animate-pulse',
    failed:    'bg-red-400',
    skipped:   'bg-green-400/60',
    pending:   'bg-on-surface-muted/40',
  }[status] ?? 'bg-on-surface-muted/40'

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

  const shortId = pipelineId?.slice(0, 4).toUpperCase() ?? ''
  const demandaName = pipeline?.product
    ? `Demanda ${pipeline.product.name} #${shortId}`
    : `Demanda #${shortId}`

  // Running agent: última task em status 'running'
  const runningTask = pipeline?.tasks.find((t) => t.status === 'running')

  // Últimas 3 tasks (invertidas = mais recentes primeiro)
  const lastThree = [...(pipeline?.tasks ?? [])].reverse().slice(0, 3)

  return (
    <Dialog open={!!pipelineId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'bg-surface-container border border-white/8 text-on-surface',
          'w-full max-w-lg p-0 gap-0 overflow-hidden'
        )}
        showCloseButton={false}
      >
        {/* ── Seção 1 — Header ─────────────────────────────────────────────── */}
        <DialogHeader className="px-5 pt-5 pb-0 gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-on-surface truncate">
                {demandaName}
              </DialogTitle>
              {pipeline && (
                <p className="text-[0.6875rem] font-mono text-on-surface-muted mt-0.5">
                  {pipeline.goal.replace(/_/g, ' ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pipeline && <StatusBadge status={pipeline.status} />}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <XCircle size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Conteúdo ────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-4">

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-48 bg-surface-container-high" />
              <Skeleton className="h-2 w-full bg-surface-container-high" />
              <Skeleton className="h-12 w-full bg-surface-container-high rounded-lg" />
            </div>
          ) : pipeline ? (
            <>
              {/* ── Seção 2 — Resumo ─────────────────────────────────────── */}
              <div className="space-y-3">
                {/* Produto */}
                {pipeline.product && (
                  <div className="flex items-center justify-between text-[0.8125rem]">
                    <span className="text-on-surface-muted">Produto</span>
                    <Link
                      href={`/products/${pipeline.product.sku}`}
                      onClick={onClose}
                      className="text-brand hover:underline font-medium flex items-center gap-1"
                    >
                      {pipeline.product.name}
                      <ExternalLink size={11} strokeWidth={1.5} />
                    </Link>
                  </div>
                )}

                {/* Progresso */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[0.75rem] text-on-surface-muted">
                    <span>{pipeline.tasks_done}/{pipeline.tasks_total} tasks concluídas</span>
                    <span className="font-mono">{pipeline.progress_pct}%</span>
                  </div>
                  <Progress
                    value={pipeline.progress_pct}
                    className="h-1.5 bg-surface-container-high"
                  />
                </div>

                {/* Métricas em linha */}
                <div className="grid grid-cols-3 gap-2 text-[0.75rem]">
                  <div className="bg-surface-container-high rounded-lg px-3 py-2">
                    <p className="text-on-surface-muted mb-0.5">Custo</p>
                    <p className="font-mono font-bold text-on-surface">
                      {formatCost(pipeline.cost_so_far_usd)}
                    </p>
                  </div>
                  <div className="bg-surface-container-high rounded-lg px-3 py-2">
                    <p className="text-on-surface-muted mb-0.5">Iniciado</p>
                    <p className="font-mono font-bold text-on-surface">
                      {formatRelative(pipeline.created_at)}
                    </p>
                  </div>
                  <div className="bg-surface-container-high rounded-lg px-3 py-2">
                    <p className="text-on-surface-muted mb-0.5">Duração</p>
                    <p className="font-mono font-bold text-on-surface">
                      {formatDuration(pipeline.created_at, pipeline.completed_at)}
                    </p>
                  </div>
                </div>

                {/* Agente ativo */}
                {runningTask && (
                  <div className="flex items-center gap-2 text-[0.75rem] text-blue-400">
                    <Loader2 size={12} strokeWidth={1.5} className="animate-spin shrink-0" />
                    <span>Rodando: <strong>{agentLabel(runningTask.agent_name)}</strong></span>
                  </div>
                )}
              </div>

              {/* ── Seção 3 — Últimas atualizações ───────────────────────── */}
              {lastThree.length > 0 && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-muted">
                    Últimas atualizações
                  </p>
                  {lastThree.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 text-[0.75rem]">
                      <StatusDot status={task.status} />
                      <span className="flex-1 text-on-surface-variant truncate">
                        {agentLabel(task.agent_name)}
                      </span>
                      <span className="text-on-surface-muted font-mono shrink-0">
                        {task.completed_at
                          ? formatRelative(task.completed_at)
                          : task.started_at
                            ? formatRelative(task.started_at)
                            : formatRelative(task.created_at)
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-on-surface-muted text-center py-4">
              Erro ao carregar demanda.
            </p>
          )}
        </div>

        {/* ── Seção 4 — Rodapé ─────────────────────────────────────────────── */}
        <DialogFooter
          className="px-5 py-4 border-t border-white/5 flex-row justify-between gap-2"
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
              Cancelar demanda
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
