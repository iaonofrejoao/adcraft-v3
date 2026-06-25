'use client'
import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Video, Loader2, X, Zap, Download, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasNode, CanvasOutput } from '@/hooks/useCanvas'

interface VideoNodeData {
  node:           CanvasNode
  onGenerate:     (nodeId: string) => void
  onDeleteOutput: (outputId: string, nodeId: string) => void
  onDeleteNode?:  (nodeId: string) => void
  connectionType: 'animate-frame' | 'reference' | 'none'
  handleColor:    string
}

// Nós fixos — frame inicial vem do pipeline; apenas vídeos "extras" criados pelo usuário são deletáveis
const FIXED_SCENE_THRESHOLD = 1  // scene_index existente = fixo

async function downloadVideo(proxyUrl: string) {
  const res  = await fetch(proxyUrl)
  const blob = await res.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `video_${Date.now()}.mp4`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function VideoNode({ data, selected }: NodeProps & { data: VideoNodeData }) {
  const { node } = data
  const handleColor   = data.handleColor ?? '#8B5CF6'
  const outputs       = node.canvas_node_outputs ?? []
  const isGenerating  = node.generation_status === 'generating'
  const isError       = node.generation_status === 'error'
  const config        = node.config

  // Nós com scene_index do pipeline são fixos; criados via context menu não têm scene_index
  const isDeletable = config.scene_index == null && !!data.onDeleteNode

  const activeOutput = outputs.find((o: CanvasOutput) => o.is_active)
  const proxyUrl     = activeOutput?.drive_url
    ? `/api/drive-image?url=${encodeURIComponent(activeOutput.drive_url)}`
    : null

  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={cn(
      'w-52 rounded-xl border bg-surface-container text-on-surface',
      'transition-all duration-150 flex flex-col',
      selected ? 'border-brand/60 shadow-[0_0_0_2px_var(--color-brand)]' : 'border-white/10',
    )}>
      <Handle
        type="target"
        id="t"
        position={Position.Top}
        style={{ background: handleColor, borderColor: 'var(--surface)' }}
        className="!w-3 !h-3 !border-2"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 relative">
        <Video size={13} strokeWidth={1.5} className="text-on-surface-muted shrink-0" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-on-surface-variant flex-1 truncate">
          Vídeo{config.scene_index != null ? ` ${config.scene_index}` : ''}
        </span>
        {data.connectionType !== 'none' && (
          <span className={cn(
            'text-[0.5rem] px-1.5 py-0.5 rounded-full font-medium shrink-0',
            data.connectionType === 'animate-frame'
              ? 'bg-status-running text-status-running-text'
              : 'bg-surface-high text-on-surface-muted',
          )}>
            {data.connectionType === 'animate-frame' ? 'Animar frame' : 'Referência'}
          </span>
        )}
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

      {/* Player */}
      <div className="relative bg-surface-high overflow-hidden group" style={{ aspectRatio: '9/16' }}>
        {proxyUrl ? (
          <div className="relative w-full h-full">
            <video
              src={proxyUrl}
              controls
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => downloadVideo(proxyUrl)}
                className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                title="Baixar vídeo"
              >
                <Download size={10} strokeWidth={2} className="text-white" />
              </button>
              <button
                onClick={() => data.onDeleteOutput(activeOutput!.id, node.id)}
                className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                title="Remover vídeo"
              >
                <X size={10} strokeWidth={2} className="text-white" />
              </button>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Loader2 size={22} strokeWidth={1.5} className="text-brand animate-spin" />
            <span className="text-[0.5625rem] text-on-surface-muted">Gerando…</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Video size={22} strokeWidth={1.5} className="text-on-surface-muted" />
            {node.prompt && (
              <p className="text-[0.5rem] text-on-surface-muted text-center line-clamp-4 px-3">{node.prompt}</p>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {isError && node.error_message && (
        <div className="px-3 py-1.5 bg-status-failed">
          <p className="text-[0.5rem] text-status-failed-text font-mono line-clamp-2">{node.error_message}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-end px-2.5 py-2 border-t border-white/5">
        <button
          onClick={() => data.onGenerate(node.id)}
          disabled={isGenerating}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-[0.5625rem] font-medium transition-all duration-150',
            'bg-brand text-white hover:opacity-90 disabled:opacity-40',
          )}
        >
          <Zap size={9} strokeWidth={2} />
          Gerar vídeo
        </button>
      </div>
    </div>
  )
}
