interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, size = 'md', disabled = false }: ToggleProps) {
  const trackSize  = size === 'sm' ? 'w-8 h-4'  : 'w-10 h-6'
  const thumbSize  = size === 'sm' ? 'w-3 h-3'  : 'w-4 h-4'
  const thumbPos   = size === 'sm'
    ? checked ? 'translate-x-4' : 'translate-x-0.5'
    : checked ? 'translate-x-5' : 'translate-x-1'

  return (
    <label className={`flex items-center gap-2 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative ${trackSize} rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1`}
        style={{ background: checked ? 'var(--brand-primary)' : '#E5E7EB', '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties}
      >
        <span className={`absolute top-0.5 ${thumbSize} rounded-full bg-white shadow-sm transition-transform duration-200 ${thumbPos}`} />
      </button>
      {label && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      )}
    </label>
  )
}
