'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { JARVIS_GOALS } from '@/lib/jarvis/goals'

export interface MentionItem {
  type:      '@' | '/'
  value:     string
  label:     string
  sublabel?: string
}

const GOAL_ITEMS: MentionItem[] = JARVIS_GOALS.map((g) => ({
  type:     '/' as const,
  value:    g.command.slice(1),   // remove leading '/'
  label:    g.command,
  sublabel: g.label,
}))

interface MentionPickerProps {
  trigger:    '@' | '/' | null
  query:      string
  anchorRef:  React.RefObject<HTMLTextAreaElement>
  onSelect:   (item: MentionItem) => void
  onDismiss:  () => void
}

export function MentionPicker({
  trigger, query, anchorRef, onSelect, onDismiss,
}: MentionPickerProps) {
  const [products,  setProducts]  = useState<MentionItem[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Busca produtos quando trigger = '@' — lógica original preservada
  useEffect(() => {
    if (trigger !== '@') return
    fetch(`/api/products?q=${encodeURIComponent(query)}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.products ?? []).map(
          (p: { sku: string; name: string; niche?: { name: string } }) => ({
            type:     '@' as const,
            value:    p.sku,
            label:    `@${p.sku}`,
            sublabel: p.name,
          }),
        )
        setProducts(items)
        setActiveIdx(0)
      })
      .catch(() => {})
  }, [trigger, query])

  const items: MentionItem[] = trigger === '@'
    ? products.filter(
        (p) =>
          p.value.toLowerCase().includes(query.toLowerCase()) ||
          p.sublabel?.toLowerCase().includes(query.toLowerCase()),
      )
    : GOAL_ITEMS.filter((g) => g.value.startsWith(query.toLowerCase()))

  // Navegação por teclado — lógica original preservada
  useEffect(() => {
    const el = anchorRef.current
    if (!el || !trigger) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
      if ((e.key === 'Enter' || e.key === 'Tab') && items[activeIdx]) {
        e.preventDefault()
        e.stopPropagation()   // prevents event from reaching MessageInput's handleKeyDown
        onSelect(items[activeIdx])
      }
      if (e.key === 'Escape') onDismiss()
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [trigger, items, activeIdx, anchorRef, onSelect, onDismiss])

  if (!trigger || items.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-2 left-0 w-72 rounded-xl border border-white/5
        bg-surface-highest/80 backdrop-blur-[12px] shadow-ambient z-50 overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-white/5">
        <span className="text-[0.625rem] font-medium text-on-surface-muted">
          {trigger === '@' ? 'Produtos' : 'Ações'}
        </span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect(item)}
          onMouseEnter={() => setActiveIdx(i)}
          className={cn(
            'w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-100',
            i === activeIdx ? 'bg-brand-muted' : 'hover:bg-surface-high',
          )}
        >
          <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded
            bg-brand-muted text-brand">
            {item.label}
          </span>
          {item.sublabel && (
            <span className="text-xs text-on-surface-variant truncate">
              {item.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
