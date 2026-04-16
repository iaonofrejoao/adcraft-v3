'use client'
import Link from 'next/link'
import { use } from 'react'
import {
  ArrowLeft, RefreshCw, Download, Clock,
  CheckCircle2, XCircle, AlertTriangle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelineDetail } from '@/hooks/usePipelineDetail'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskStepCard } from '@/components/demandas/TaskStepCard'
import { RerunModal } from '@/components/demandas/RerunModal'
import { useState } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
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
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatCost(raw: string | null): string {
  if (!raw) return '$0.0000'
  const n = parseFloat(raw)
  return isNaN(n) ? '$0.0000' : `$${n.toFixed(4)}`
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64 bg-surface-container" />
      <Skeleton className="h-24 w-full bg-surface-container rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-surface-container rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Stats do cabeçalho ────────────────────────────────────────────────────────

interface StatItemProps {
  label: string
  value: string
  icon?: React.ReactNode
  highlight?: boolean
}

function StatItem({ label, value, icon, highlight }: StatItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-muted">{label}</p>
      <div className={cn(
        'flex items-center gap-1.5 text-[14px] font-mono font-semibold',
        highlight ? 'text-primary' : 'text-on-surface',
      )}>
        {icon}
        {value}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { pipeline, isLoading, error, reload, rerunTask } = usePipelineDetail(id)

  const [rerunAllOpen, setRerunAllOpen] = useState(false)
  const [rerunAllLoading, setRerunAllLoading] = useState(false)

  if (isLoading) return <DetailSkeleton />

  if (error || !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-muted">
        <XCircle size={32} strokeWidth={1} className="text-status-failed-text" />
        <p className="text-[14px]">{error ?? 'Pipeline não encontrado'}</p>
        <Link href="/demandas" className="text-primary text-[13px] hover:underline flex items-center gap-1">
          <ArrowLeft size={13} strokeWidth={1.5} />
          Voltar
        </Link>
      </div>
    )
  }

  // Re-executar tudo = re-rodar a primeira task; as downstream seguem automaticamente
  const handleRerunAll = async () => {
    if (!pipeline.tasks.length) return
    setRerunAllLoading(true)
    try {
      const firstTask = pipeline.tasks[0]
      await rerunTask(firstTask.id)
    } finally {
      setRerunAllLoading(false)
      setRerunAllOpen(false)
    }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(pipeline, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `pipeline-${shortId(pipeline.id)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const runningCount = pipeline.tasks.filter((t) => t.status === 'running').length
  const failedCount  = pipeline.tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      {/* Cabeçalho */}
      <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container/40 px-6 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/demandas"
            className="flex items-center gap-1.5 text-[12px] text-on-surface-muted hover:text-on-surface transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Demandas
          </Link>
          <span className="text-on-surface-muted">/</span>
          <span className="font-mono text-[12px] text-primary font-bold">
            {shortId(pipeline.id)}
          </span>
        </div>

        {/* Título + ações */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-on-surface leading-tight truncate">
              {pipeline.product
                ? `${pipeline.product.name}`
                : pipeline.goal.replace(/_/g, ' ')}
            </h1>
            <p className="text-[13px] text-on-surface-muted mt-0.5 capitalize">
              {pipeline.goal.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportJson}
              className="gap-2 text-[12px] text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
            >
              <Download size={13} strokeWidth={1.5} />
              Export JSON
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
              className="gap-2 text-[12px] text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              Atualizar
            </Button>

            {['failed', 'completed'].includes(pipeline.status) && (
              <Button
                size="sm"
                disabled={rerunAllLoading}
                onClick={() => setRerunAllOpen(true)}
                className="gap-2 text-[12px] bg-primary text-on-primary hover:bg-primary/90"
              >
                <RefreshCw size={13} strokeWidth={1.5} className={rerunAllLoading ? 'animate-spin' : ''} />
                Re-executar tudo
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 mt-5 flex-wrap">
          <StatusBadge status={pipeline.status} />

          <StatItem
            label="Custo total"
            value={formatCost(pipeline.cost_so_far_usd)}
            icon={<span className="text-[11px] text-on-surface-muted">💸</span>}
            highlight
          />

          <StatItem
            label="Início"
            value={formatDate(pipeline.created_at)}
            icon={<Clock size={13} strokeWidth={1.5} className="text-on-surface-muted" />}
          />

          <StatItem
            label="Duração"
            value={formatDuration(pipeline.created_at, pipeline.completed_at)}
          />

          <div className="flex flex-col gap-0.5 min-w-[120px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-muted">
              Progresso
            </p>
            <div className="flex items-center gap-2">
              <Progress value={pipeline.progress_pct} className="h-1.5 flex-1 bg-surface-container-high" />
              <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
                {pipeline.tasks_done}/{pipeline.tasks_total}
              </span>
            </div>
          </div>
        </div>

        {/* Alertas ativos */}
        {(runningCount > 0 || failedCount > 0) && (
          <div className="flex gap-3 mt-4 flex-wrap">
            {runningCount > 0 && (
              <div className="flex items-center gap-2 bg-[#60A5FA]/10 border border-[#60A5FA]/20 rounded-md px-3 py-1.5">
                <RefreshCw size={12} strokeWidth={1.5} className="text-[#60A5FA] animate-spin" />
                <span className="text-[11px] text-[#60A5FA]">
                  {runningCount} {runningCount === 1 ? 'agente rodando' : 'agentes rodando'}
                </span>
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center gap-2 bg-status-failed-bg border border-status-failed-text/20 rounded-md px-3 py-1.5">
                <AlertTriangle size={12} strokeWidth={1.5} className="text-status-failed-text" />
                <span className="text-[11px] text-status-failed-text">
                  {failedCount} {failedCount === 1 ? 'agente falhou' : 'agentes falharam'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {pipeline.tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap size={28} strokeWidth={1} className="text-on-surface-muted mb-3" />
            <p className="text-[14px] text-on-surface-variant">Nenhum agente registrado ainda</p>
            <p className="text-[12px] text-on-surface-muted mt-1">
              O pipeline ainda não iniciou ou os dados estão sendo carregados.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Legenda de steps */}
            <div className="flex items-center gap-1.5 mb-6">
              <CheckCircle2 size={12} strokeWidth={1.5} className="text-status-done-text" />
              <span className="text-[11px] text-on-surface-muted">Concluído</span>
              <span className="text-on-surface-muted mx-2">·</span>
              <RefreshCw size={12} strokeWidth={1.5} className="text-[#60A5FA]" />
              <span className="text-[11px] text-on-surface-muted">Rodando</span>
              <span className="text-on-surface-muted mx-2">·</span>
              <Clock size={12} strokeWidth={1.5} className="text-on-surface-muted" />
              <span className="text-[11px] text-on-surface-muted">Pendente</span>
              <span className="text-on-surface-muted mx-2">·</span>
              <XCircle size={12} strokeWidth={1.5} className="text-status-failed-text" />
              <span className="text-[11px] text-on-surface-muted">Falhou</span>
            </div>

            {/* Cards de steps */}
            {pipeline.tasks.map((task, index) => (
              <TaskStepCard
                key={task.id}
                task={task}
                index={index}
                isLast={index === pipeline.tasks.length - 1}
                onRerun={(taskId) => rerunTask(taskId).then(() => undefined)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal re-executar tudo */}
      <RerunModal
        open={rerunAllOpen}
        agentName="todos os agentes"
        downstreamCount={pipeline.tasks.length - 1}
        onConfirm={handleRerunAll}
        onCancel={() => setRerunAllOpen(false)}
      />
    </div>
  )
}
