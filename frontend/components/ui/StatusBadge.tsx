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
    classes: 'bg-[rgba(161,161,170,0.15)] text-[#A1A1AA]',
    dot: 'bg-[#A1A1AA]',
  },
  running: {
    label: 'Executando',
    classes: 'bg-[rgba(59,130,246,0.15)] text-[#60A5FA]',
    dot: 'bg-[#60A5FA]',
    animate: true,
  },
  done: {
    label: 'Concluído',
    classes: 'bg-[rgba(34,197,94,0.15)] text-[#4ADE80]',
    dot: 'bg-[#4ADE80]',
  },
  failed: {
    label: 'Falha',
    classes: 'bg-[rgba(239,68,68,0.15)] text-[#F87171]',
    dot: 'bg-[#F87171]',
  },
  paused: {
    label: 'Pausado',
    classes: 'bg-[rgba(245,158,11,0.15)] text-[#FCD34D]',
    dot: 'bg-[#FCD34D]',
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
