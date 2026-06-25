'use client'
import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Download, Expand, MoreHorizontal, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageLightbox } from '../ImageLightbox'
import type { CanvasNode, CanvasOutput } from '@/hooks/useCanvas'

// Nós criados pelo usuário via context menu — deletáveis
const USER_CREATED_TYPES = new Set(['adicional'])

interface ImageNodeData {
  node:           CanvasNode
  onGenerate:     (nodeId: string) => void
  onUpdateConfig: (nodeId: string, config: Record<string, unknown>) => void
  onToggleOutput: (outputId: string, nodeId: string, active: boolean) => void
  onDeleteOutput: (outputId: string, nodeId: string) => void
  onDeleteNode?:  (nodeId: string) => void
  handleColor:    string
}

const TYPE_LABEL: Record<string, string> = {
  personagem: 'Personagem',
  cenario:    'Cenário',
  produto:    'Produto',
  adicional:  'Adicional',
  frame:      'Frame',
}

async function downloadImage(proxyUrl: string) {
  const res  = await fetch(proxyUrl)
  const blob = await res.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `imagem_${Date.now()}.png`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Converte "9:16" → "9/16" para a propriedade CSS aspect-ratio
function toAspectRatioCss(ratio: string | undefined): string {
  if (!ratio) return '4/3'
  return ratio.replace(':', '/')
}

export function ImageNode({ data, selected }: NodeProps & { data: ImageNodeData }) {
  const { node } = data
  const handleColor   = data.handleColor ?? '#22C55E'
  const isGenerating  = node.generation_status === 'generating'
  const isError       = node.generation_status === 'error'
  const outputs       = node.canvas_node_outputs ?? []
  const isDeletable   = USER_CREATED_TYPES.has(node.type) && !!data.onDeleteNode
  const previewRatio  = toAspectRatioCss(node.config.aspect_ratio)

  const [carouselIdx,  setCarouselIdx]  = useState(0)
  const [lightboxUrl,  setLightboxUrl]  = useState<string | null>(null)
  const [hovering,     setHovering]     = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)

  // Reseta carousel quando novos outputs chegam
  useEffect(() => {
    setCarouselIdx(idx => Math.min(idx, Math.max(0, outputs.length - 1)))
  }, [outputs.length])

  const currentOutput: CanvasOutput | undefined = outputs[carouselIdx]
  const proxyUrl = currentOutput?.drive_url
    ? `/api/drive-image?url=${encodeURIComponent(currentOutput.drive_url)}`
    : null

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCarouselIdx(i => Math.max(0, i - 1))
  }
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCarouselIdx(i => Math.min(outputs.length - 1, i + 1))
  }
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentOutput) data.onToggleOutput(currentOutput.id, node.id, !currentOutput.is_active)
  }

  return (
    <>
      <div
        className={cn(
          'w-64 rounded-xl border bg-surface-container text-on-surface',
          'transition-all duration-150 flex flex-col gap-0',
          selected ? 'border-brand/60 shadow-[0_0_0_2px_var(--color-brand)]' : 'border-white/10',
        )}
      >
        <Handle
          type="target"
          id="t"
          position={Position.Top}
          style={{ background: handleColor, borderColor: 'var(--surface)' }}
          className="!w-3 !h-3 !border-2"
        />
        <Handle
          type="source"
          id="s"
          position={Position.Bottom}
          style={{ background: handleColor, borderColor: 'var(--surface)' }}
          className="!w-3 !h-3 !border-2"
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <ImageIcon size={13} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-variant flex-1 truncate">
            {TYPE_LABEL[node.type] ?? node.type}
            {node.config.scene_index != null ? ` ${node.config.scene_index}` : ''}
          </span>
          {isGenerating && (
            <Loader2 size={11} strokeWidth={1.5} className="text-brand animate-spin shrink-0" />
          )}

          {/* Options menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-5 h-5 rounded flex items-center justify-center text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors"
            >
              <MoreHorizontal size={11} strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <div
                className="absolute top-6 right-0 z-30 bg-surface-container border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px] py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => { data.onGenerate(node.id); setMenuOpen(false) }}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.625rem] text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
                >
                  <Zap size={10} strokeWidth={1.5} />
                  Regenerar
                </button>
                {isDeletable && (
                  <button
                    onClick={() => { data.onDeleteNode!(node.id); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.625rem] text-status-failed-text hover:bg-status-failed/20 transition-colors"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                    Deletar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Prompt preview */}
        {node.prompt && outputs.length === 0 && !isGenerating && (
          <div className="px-3 pt-2 pb-0">
            <p className="text-[0.5rem] text-on-surface-muted line-clamp-2 leading-relaxed">
              {node.prompt}
            </p>
          </div>
        )}

        {/* Preview / Carousel */}
        <div
          className="relative bg-surface-high overflow-hidden"
          style={{ aspectRatio: previewRatio }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {outputs.length > 0 && proxyUrl ? (
            <>
              {/* Imagem ativa */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxyUrl}
                alt=""
                className={cn(
                  'w-full h-full object-cover cursor-pointer transition-opacity duration-150',
                  currentOutput?.is_active ? 'opacity-100' : 'opacity-50',
                )}
                onClick={handleToggle}
              />

              {/* Overlay ao hover */}
              {hovering && (
                <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
                  {/* Prev */}
                  <button
                    onClick={handlePrev}
                    disabled={carouselIdx === 0}
                    className={cn(
                      'pointer-events-auto w-6 h-6 rounded-full bg-black/60 flex items-center justify-center transition-opacity',
                      carouselIdx === 0 ? 'opacity-0' : 'opacity-100 hover:bg-black/80',
                    )}
                  >
                    <ChevronLeft size={12} strokeWidth={2} className="text-white" />
                  </button>
                  {/* Actions */}
                  <div className="pointer-events-auto flex items-center gap-1 absolute top-1.5 right-1.5">
                    <button
                      onClick={e => { e.stopPropagation(); setLightboxUrl(currentOutput?.drive_url ?? null) }}
                      className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
                      title="Ampliar"
                    >
                      <Expand size={10} strokeWidth={2} className="text-white" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); proxyUrl && downloadImage(proxyUrl) }}
                      className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
                      title="Baixar"
                    >
                      <Download size={10} strokeWidth={2} className="text-white" />
                    </button>
                  </div>
                  {/* Next */}
                  <button
                    onClick={handleNext}
                    disabled={carouselIdx >= outputs.length - 1}
                    className={cn(
                      'pointer-events-auto w-6 h-6 rounded-full bg-black/60 flex items-center justify-center transition-opacity ml-auto',
                      carouselIdx >= outputs.length - 1 ? 'opacity-0' : 'opacity-100 hover:bg-black/80',
                    )}
                  >
                    <ChevronRight size={12} strokeWidth={2} className="text-white" />
                  </button>
                </div>
              )}

              {/* Dots */}
              {outputs.length > 1 && (
                <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                  {outputs.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-1 h-1 rounded-full transition-colors',
                        i === carouselIdx ? 'bg-white' : 'bg-white/40',
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Anel de ativo */}
              {currentOutput && !currentOutput.is_active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-on-surface-muted/30" />
              )}
              {currentOutput?.is_active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: data.handleColor }} />
              )}
            </>
          ) : isGenerating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} strokeWidth={1.5} className="text-brand animate-spin" />
              <span className="text-[0.5625rem] text-on-surface-muted">Gerando…</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-3">
              <ImageIcon size={18} strokeWidth={1.5} className="text-on-surface-muted" />
            </div>
          )}
        </div>

        {/* Error */}
        {isError && node.error_message && (
          <div className="px-3 py-1.5 bg-status-failed">
            <p className="text-[0.5rem] text-status-failed-text font-mono line-clamp-2">{node.error_message}</p>
          </div>
        )}

        {/* Bottom bar — só o botão Gerar */}
        <div className="flex items-center justify-end px-2.5 py-2 border-t border-white/5">
          <button
            onClick={() => data.onGenerate(node.id)}
            disabled={isGenerating}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-[0.5625rem] font-medium transition-all duration-150',
              'bg-brand text-white hover:opacity-90 disabled:opacity-40',
            )}
          >
            <span className="text-[0.5rem]">⚡</span>
            Gerar
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}
