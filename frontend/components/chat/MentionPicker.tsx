'use client'
import { useEffect, useRef, useState } from 'react'

export interface MentionItem {
  type: '@' | '/'
  value: string    // SKU ou goal slug
  label: string
  sublabel?: string
}

const GOALS: MentionItem[] = [
  { type: '/', value: 'avatar',   label: '/avatar',   sublabel: 'Pesquisa de avatar' },
  { type: '/', value: 'mercado',  label: '/mercado',  sublabel: 'Pesquisa de mercado' },
  { type: '/', value: 'angulos',  label: '/angulos',  sublabel: 'Geração de ângulos' },
  { type: '/', value: 'copy',     label: '/copy',     sublabel: 'Copy completa (hooks + bodies + CTAs)' },
  { type: '/', value: 'video',    label: '/video',    sublabel: 'Vídeo criativo VEO 3' },
]

interface MentionPickerProps {
  trigger: '@' | '/' | null
  query: string
  anchorRef: React.RefObject<HTMLTextAreaElement>
  onSelect: (item: MentionItem) => void
  onDismiss: () => void
}

export function MentionPicker({ trigger, query, anchorRef, onSelect, onDismiss }: MentionPickerProps) {
  const [products, setProducts] = useState<MentionItem[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Busca produtos quando trigger = '@'
  useEffect(() => {
    if (trigger !== '@') return
    fetch(`/api/products?q=${encodeURIComponent(query)}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.products ?? []).map((p: { sku: string; name: string; niche?: { name: string } }) => ({
          type: '@' as const,
          value: p.sku,
          label: `@${p.sku}`,
          sublabel: p.name,
        }))
        setProducts(items)
        setActiveIdx(0)
      })
      .catch(() => {})
  }, [trigger, query])

  const items: MentionItem[] = trigger === '@'
    ? products.filter((p) => p.value.toLowerCase().includes(query.toLowerCase()) || p.sublabel?.toLowerCase().includes(query.toLowerCase()))
    : GOALS.filter((g) => g.value.startsWith(query.toLowerCase()))

  // Navegação por teclado
  useEffect(() => {
    const el = anchorRef.current
    if (!el || !trigger) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && items[activeIdx]) { e.preventDefault(); onSelect(items[activeIdx]) }
      if (e.key === 'Escape') onDismiss()
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [trigger, items, activeIdx, anchorRef, onSelect, onDismiss])

  if (!trigger || items.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-1 left-0 w-72 rounded-xl border shadow-lg z-50 overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {trigger === '@' ? 'Produtos' : 'Ações'}
        </span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect(item)}
          className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors"
          style={i === activeIdx
            ? { background: 'var(--brand-subtle)' }
            : { background: 'transparent' }}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span className="text-xs font-mono font-medium rounded px-1.5 py-0.5"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
            {item.label}
          </span>
          {item.sublabel && (
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {item.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
