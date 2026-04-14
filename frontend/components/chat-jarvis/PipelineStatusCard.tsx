'use client'
import { CheckCircle2, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface PipelineTask {
  name:   string
  status: string
}

interface PipelineStatusCardProps {
  pipeline: Record<string, unknown>
}

export function PipelineStatusCard({ pipeline }: PipelineStatusCardProps) {
  const status   = pipeline.status as string
  const goal     = pipeline.goal as string
  const cost     = parseFloat((pipeline.cost_so_far_usd as string) ?? '0')
  const budget   = parseFloat((pipeline.budget_usd as string) ?? '0')
  const progress = (pipeline as { progress_pct?: number }).progress_pct ?? 0
  const tasks    = (pipeline as { tasks?: PipelineTask[] }).tasks ?? []

  return (
    <div className="bg-surface-container border border-white/5 rounded-xl p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            Status do Pipeline
          </h3>
          <p className="text-xs text-on-surface-muted font-medium">{goal}</p>
        </div>
        <span className="text-xs font-mono font-bold text-brand">{progress}%</span>
      </div>

      {/* Progress bar */}
      <Progress
        value={progress}
        className="h-1.5 mb-4 bg-surface-highest [&>div]:bg-brand [&>div]:shadow-[0_0_10px_rgba(242,135,5,0.4)]"
      />

      {/* Task list (from pipeline.tasks when available) */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <TaskRow key={i} task={task} />
          ))}
        </div>
      ) : (
        <p className="text-[0.6875rem] text-on-surface-muted font-mono">
          {progress}% · ${cost.toFixed(4)} / ${budget.toFixed(2)} · {status}
        </p>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: PipelineTask }) {
  const isDone    = task.status === 'done' || task.status === 'completed'
  const isRunning = task.status === 'running'

  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 rounded bg-surface-high/40',
      isRunning && 'border-l-2 border-brand',
    )}>
      <div className="flex items-center gap-3">
        {isDone ? (
          <CheckCircle2 size={14} strokeWidth={1.5} className="text-[#4ADE80]" />
        ) : isRunning ? (
          <Loader2 size={14} strokeWidth={1.5} className="text-brand animate-spin" />
        ) : (
          <Clock size={14} strokeWidth={1.5} className="text-on-surface-muted/40" />
        )}
        <span className="text-[0.6875rem] font-medium text-on-surface">{task.name}</span>
      </div>
      <span className={cn(
        'text-[0.5625rem] font-mono uppercase',
        isDone    && 'text-[#4ADE80]/70',
        isRunning && 'text-brand',
        !isDone && !isRunning && 'text-on-surface-muted/40',
      )}>
        {task.status}
      </span>
    </div>
  )
}
