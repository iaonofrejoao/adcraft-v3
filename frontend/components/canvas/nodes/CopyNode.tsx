'use client'
import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileText, X, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyNodeData {
  label:    string
  fullText: string | null
}

function CopyModal({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5 shrink-0">
          <FileText size={15} strokeWidth={1.5} className="text-on-surface-muted" />
          <span className="text-sm font-semibold text-on-surface flex-1">Copy completa</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-none">
          <p className="text-[0.8125rem] text-on-surface leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>
    </div>
  )
}

export function CopyNode({ data, selected }: NodeProps & { data: CopyNodeData }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className={cn(
        'w-72 rounded-xl border bg-surface-container text-on-surface',
        'transition-all duration-150',
        selected ? 'border-brand/60 shadow-[0_0_0_2px_var(--color-brand)]' : 'border-white/10',
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <FileText size={13} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-variant flex-1">
            {data.label}
          </span>
          {data.fullText && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-5 h-5 rounded flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors"
              title="Ver copy completa"
            >
              <Maximize2 size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2.5">
          {data.fullText ? (
            <p className="text-[0.625rem] text-on-surface-variant leading-relaxed line-clamp-10 whitespace-pre-wrap">
              {data.fullText}
            </p>
          ) : (
            <p className="text-[0.625rem] text-on-surface-muted italic">Sem copy gerada</p>
          )}
        </div>

        {/* Footer */}
        {data.fullText && (
          <div className="px-3 pb-2.5 pt-0">
            <button
              onClick={() => setModalOpen(true)}
              className="text-[0.5625rem] text-brand hover:underline transition-colors"
            >
              Ver tudo →
            </button>
          </div>
        )}

        {/* Handle com cor âmbar (texto) */}
        <Handle
          type="source"
          id="s"
          position={Position.Right}
          style={{ background: '#F59E0B', borderColor: 'var(--surface)' }}
          className="!w-3 !h-3 !border-2"
        />
      </div>

      {modalOpen && data.fullText && (
        <CopyModal text={data.fullText} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
