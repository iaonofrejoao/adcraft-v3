'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Minus, Plus, Zap, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasNode } from '@/hooks/useCanvas'

interface NodeInspectorProps {
  node:           CanvasNode | null
  onClose:        () => void
  onUpdateConfig: (nodeId: string, config: Record<string, unknown>) => void
  onUpdatePrompt: (nodeId: string, prompt: string) => void
  onDeleteNode:   (nodeId: string) => void
  onGenerate:     (nodeId: string) => void
}

const ASPECT_RATIOS = ['1:1', '9:16', '16:9', '4:3']

const TYPE_LABEL: Record<string, string> = {
  copy:       'Copy',
  storyboard: 'Storyboard',
  personagem: 'Personagem',
  cenario:    'Cenário',
  produto:    'Produto',
  frame:      'Frame',
  adicional:  'Adicional',
  video:      'Vídeo',
}

// Nós fixos (gerados pelo pipeline) — não deletáveis
const FIXED_TYPES = new Set(['copy', 'storyboard', 'personagem', 'cenario', 'produto'])

export function NodeInspector({
  node,
  onClose,
  onUpdateConfig,
  onUpdatePrompt,
  onDeleteNode,
  onGenerate,
}: NodeInspectorProps) {
  const [promptDraft, setPromptDraft] = useState('')
  const [count,       setCount]       = useState(1)
  const [ratio,       setRatio]       = useState('1:1')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sincroniza campos quando o nó selecionado muda
  useEffect(() => {
    if (!node) return
    setPromptDraft(node.prompt ?? '')
    setCount(node.config.count ?? 1)
    setRatio(node.config.aspect_ratio ?? '1:1')
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null

  const isGenerating = node.generation_status === 'generating'
  const isDeletable  = !FIXED_TYPES.has(node.type)
  const hasGenerate  = node.type !== 'copy' && node.type !== 'storyboard'
  const hasConfig    = node.type !== 'copy' && node.type !== 'storyboard' && node.type !== 'video'
  const hasPrompt    = node.type !== 'copy' && node.type !== 'storyboard'

  const handlePromptBlur = () => {
    if (promptDraft !== (node.prompt ?? '')) {
      onUpdatePrompt(node.id, promptDraft)
    }
  }

  const handleCountChange = (n: number) => {
    const next = Math.max(1, Math.min(4, n))
    setCount(next)
    onUpdateConfig(node.id, { ...node.config, count: next })
  }

  const handleRatioChange = (r: string) => {
    setRatio(r)
    onUpdateConfig(node.id, { ...node.config, aspect_ratio: r })
  }

  return (
    <div className={cn(
      'absolute right-0 top-0 h-full w-72 z-20 flex flex-col',
      'bg-surface-container/95 border-l border-white/5 backdrop-blur-sm',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-variant flex-1">
          {TYPE_LABEL[node.type] ?? node.type}
          {node.config.scene_index != null ? ` ${node.config.scene_index}` : ''}
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors"
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-none">

        {/* Prompt */}
        {hasPrompt && (
          <div className="space-y-1.5">
            <label className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-muted">
              Prompt
            </label>
            <textarea
              ref={textareaRef}
              value={promptDraft}
              onChange={e => setPromptDraft(e.target.value)}
              onBlur={handlePromptBlur}
              rows={6}
              placeholder="Descreva o conteúdo visual…"
              className={cn(
                'w-full resize-none rounded-lg px-3 py-2.5',
                'bg-surface-high border border-white/5',
                'text-[0.6875rem] text-on-surface placeholder:text-on-surface-muted',
                'focus:outline-none focus:border-brand/40 transition-colors',
              )}
            />
            <p className="text-[0.5rem] text-on-surface-muted">Salvo automaticamente ao sair do campo.</p>
          </div>
        )}

        {/* Count + Aspect Ratio */}
        {hasConfig && (
          <>
            <div className="space-y-1.5">
              <label className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-muted">
                Quantidade
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCountChange(count - 1)}
                  disabled={count <= 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-high border border-white/5
                    text-on-surface-muted hover:bg-surface-highest disabled:opacity-30 transition-colors"
                >
                  <Minus size={11} strokeWidth={2} />
                </button>
                <span className="text-sm font-mono text-on-surface w-6 text-center">{count}</span>
                <button
                  onClick={() => handleCountChange(count + 1)}
                  disabled={count >= 4}
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-high border border-white/5
                    text-on-surface-muted hover:bg-surface-highest disabled:opacity-30 transition-colors"
                >
                  <Plus size={11} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-muted">
                Proporção
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {ASPECT_RATIOS.map(r => (
                  <button
                    key={r}
                    onClick={() => handleRatioChange(r)}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-[0.625rem] font-mono border transition-all duration-100',
                      ratio === r
                        ? 'bg-brand/15 border-brand/40 text-brand'
                        : 'bg-surface-high border-white/5 text-on-surface-muted hover:border-white/20 hover:text-on-surface',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Video aspect ratio (sem count) */}
        {node.type === 'video' && (
          <div className="space-y-1.5">
            <label className="text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-muted">
              Proporção
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ASPECT_RATIOS.map(r => (
                <button
                  key={r}
                  onClick={() => handleRatioChange(r)}
                  className={cn(
                    'px-2 py-1.5 rounded-lg text-[0.625rem] font-mono border transition-all duration-100',
                    ratio === r
                      ? 'bg-brand/15 border-brand/40 text-brand'
                      : 'bg-surface-high border-white/5 text-on-surface-muted hover:border-white/20 hover:text-on-surface',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 shrink-0">
        {hasGenerate && (
          <button
            onClick={() => onGenerate(node.id)}
            disabled={isGenerating}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[0.6875rem] font-medium',
              'bg-brand text-white hover:opacity-90 disabled:opacity-40 transition-all duration-150',
            )}
          >
            <Zap size={11} strokeWidth={2} />
            {isGenerating ? 'Gerando…' : 'Gerar'}
          </button>
        )}
        {isDeletable && (
          <button
            onClick={() => onDeleteNode(node.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[0.6875rem] font-medium',
              'bg-status-failed/30 text-status-failed-text border border-status-failed-text/20',
              'hover:bg-status-failed/50 transition-all duration-150',
              !hasGenerate && 'flex-1',
            )}
          >
            <Trash2 size={11} strokeWidth={1.5} />
            {!hasGenerate ? 'Deletar' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
