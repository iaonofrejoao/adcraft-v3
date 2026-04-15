import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  format?: 'number' | 'currency' | 'percent' | 'multiplier'
}

export function MetricCard({
  label,
  value,
  delta,
  deltaPositive,
  format = 'number',
}: MetricCardProps) {
  return (
    <div className="bg-surface-container border border-outline-variant/15 rounded-md p-4">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.02em] text-on-surface-muted mb-2">
        {label}
      </p>
      <p className="text-[2.75rem] font-semibold leading-none tracking-[-0.02em] font-mono text-on-surface">
        {formatValue(value, format)}
      </p>
      {delta && (
        <p className={cn(
          'text-[0.6875rem] font-mono mt-1',
          deltaPositive ? 'text-status-done-text' : 'text-status-failed-text'
        )}>
          {delta}
        </p>
      )}
    </div>
  )
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency':   return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    case 'percent':    return `${value.toFixed(1)}%`
    case 'multiplier': return `${value.toFixed(1)}x`
    default:           return value.toLocaleString('pt-BR')
  }
}
