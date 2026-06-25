'use client'
import { useEffect, useRef } from 'react'
import { User, Film, Image, Video } from 'lucide-react'
import type { NodeType } from '@/hooks/useCanvas'

interface CanvasContextMenuProps {
  x:          number
  y:          number
  flowX:      number
  flowY:      number
  onAddNode:  (type: NodeType, flowX: number, flowY: number) => void
  onClose:    () => void
}

const MENU_ITEMS: { type: NodeType; label: string; Icon: React.ElementType; color: string }[] = [
  { type: 'personagem', label: 'Personagem', Icon: User,  color: '#22C55E' },
  { type: 'frame',      label: 'Frame',      Icon: Film,  color: '#22C55E' },
  { type: 'adicional',  label: 'Adicional',  Icon: Image, color: '#22C55E' },
  { type: 'video',      label: 'Vídeo',      Icon: Video, color: '#8B5CF6' },
]

export function CanvasContextMenu({ x, y, flowX, flowY, onAddNode, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="absolute z-30 bg-surface-container border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 border-b border-white/5 mb-1">
        <span className="text-[0.5625rem] font-semibold uppercase tracking-widest text-on-surface-muted">
          Adicionar nó
        </span>
      </div>
      {MENU_ITEMS.map(({ type, label, Icon, color }) => (
        <button
          key={type}
          onClick={() => onAddNode(type, flowX, flowY)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.6875rem] text-on-surface-variant
            hover:bg-surface-high hover:text-on-surface transition-colors duration-100 text-left"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: color }}
          />
          <Icon size={13} strokeWidth={1.5} className="shrink-0 text-on-surface-muted" />
          {label}
        </button>
      ))}
    </div>
  )
}
