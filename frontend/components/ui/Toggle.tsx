import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, size = 'md', disabled = false }: ToggleProps) {
  const trackSize = size === 'sm' ? 'w-8 h-4'  : 'w-10 h-6'
  const thumbSize = size === 'sm' ? 'w-3 h-3'  : 'w-4 h-4'
  const thumbPos  = size === 'sm'
    ? checked ? 'translate-x-4' : 'translate-x-0.5'
    : checked ? 'translate-x-5' : 'translate-x-1'

  return (
    <label className={cn('flex items-center gap-2 select-none', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative rounded-full transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-1',
          trackSize,
          checked ? 'bg-brand' : 'bg-surface-highest',
        )}
      >
        <span className={cn(
          'absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          thumbSize,
          thumbPos,
        )} />
      </button>
      {label && (
        <span className="text-sm text-on-surface-variant">{label}</span>
      )}
    </label>
  )
}
