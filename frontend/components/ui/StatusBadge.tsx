import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/lib/constants'

const statusConfig: Record<TaskStatus, {
  label: string
  classes: string
  dot: string
  animate?: boolean
}> = {
  pending: {
    label: 'Pendente',
    classes: 'bg-status-pending text-status-pending-text',
    dot: 'bg-status-pending-text',
  },
  running: {
    label: 'Executando',
    classes: 'bg-status-running text-status-running-text',
    dot: 'bg-status-running-text',
    animate: true,
  },
  done: {
    label: 'Concluído',
    classes: 'bg-status-done text-status-done-text',
    dot: 'bg-status-done-text',
  },
  failed: {
    label: 'Falha',
    classes: 'bg-status-failed text-status-failed-text',
    dot: 'bg-status-failed-text',
  },
  paused: {
    label: 'Pausado',
    classes: 'bg-status-paused text-status-paused-text',
    dot: 'bg-status-paused-text',
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as TaskStatus] ?? statusConfig.pending

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[0.6875rem] font-medium tracking-[0.02em]',
      config.classes,
      className
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        config.dot,
        config.animate && 'animate-pulse'
      )} />
      {config.label}
    </span>
  )
}
