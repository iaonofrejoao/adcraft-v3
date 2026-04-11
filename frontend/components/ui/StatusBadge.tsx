type Status = 'active' | 'running' | 'draft' | 'paused' | 'failed' | 'completed' | 'pending' | 'waiting' | 'skipped'

const statusConfig: Record<Status, { label: string; bg: string; text: string; dot: string; pulse?: boolean }> = {
  active:    { label: 'ativo',      bg: 'bg-green-50',  text: 'text-green-800',  dot: 'bg-green-500' },
  running:   { label: 'executando', bg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500', pulse: true },
  draft:     { label: 'rascunho',   bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  paused:    { label: 'pausado',    bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  failed:    { label: 'falha',      bg: 'bg-red-50',    text: 'text-red-800',    dot: 'bg-red-500' },
  completed: { label: 'concluído',  bg: 'bg-blue-50',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  pending:   { label: 'pendente',   bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  waiting:   { label: 'aguardando', bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-400' },
  skipped:   { label: 'reutilizado',bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  )
}

export type { Status }
