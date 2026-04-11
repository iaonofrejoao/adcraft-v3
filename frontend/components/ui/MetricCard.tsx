interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  format?: 'number' | 'currency' | 'percent' | 'multiplier'
  className?: string
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

export function MetricCard({ label, value, delta, deltaPositive, format = 'number', className = '' }: MetricCardProps) {
  return (
    <div className={`rounded-xl p-4 border ${className}`}
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
        {formatValue(value, format)}
      </p>
      {delta && (
        <p className={`text-xs mt-1 ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
          {delta}
        </p>
      )}
    </div>
  )
}
