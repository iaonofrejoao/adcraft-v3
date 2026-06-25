'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, LayoutTemplate, AlertCircle, Plus, Zap,
  Maximize2, Minimize2,
} from 'lucide-react'
import { CombinationSelector } from '@/components/canvas/CombinationSelector'
import { useCanvas } from '@/hooks/useCanvas'
import { cn } from '@/lib/utils'

const CanvasBoard = dynamic(
  () => import('@/components/canvas/CanvasBoard').then(m => m.CanvasBoard),
  { ssr: false, loading: () => <CanvasPlaceholder /> },
)

function CanvasPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Loader2 size={22} strokeWidth={1.5} className="animate-spin text-on-surface-muted" />
    </div>
  )
}

export interface CriativosTabProps {
  sku:              string
  productId:        string
  initialCanvasId?: string
}

export function CriativosTab({ sku, productId: _productId, initialCanvasId }: CriativosTabProps) {
  const router = useRouter()

  const [comboToCanvas, setComboToCanvas] = useState<Record<string, string>>({})
  const [canvasId,      setCanvasId]      = useState<string | null>(initialCanvasId ?? null)
  const [pendingComboId, setPendingComboId] = useState<string | null>(null)
  const [noStoryboard,   setNoStoryboard]   = useState(false)
  const [isCreating,     setIsCreating]     = useState(false)
  const [isFullscreen,   setIsFullscreen]   = useState(false)
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    fetch(`/api/products/${sku}/canvas`)
      .then(r => r.json())
      .then((d: { canvases?: Array<{ id: string; copy_combination_id: string }> }) => {
        const map: Record<string, string> = {}
        for (const cv of d.canvases ?? []) map[cv.copy_combination_id] = cv.id
        setComboToCanvas(map)
      })
      .catch(() => {})
  }, [sku])

  const {
    data, isLoading,
    generateNode, runAllNodes, updateNode, updatePrompt,
    saveNodePosition, createNode, deleteNode,
    createEdge, deleteEdge, toggleOutput, deleteOutput,
  } = useCanvas(canvasId)

  const selectedComboId = data?.canvas.copy_combination_id ?? pendingComboId
  const hasActiveContent = !!(selectedComboId || canvasId)

  const handleSelectCombo = useCallback((comboId: string) => {
    setNoStoryboard(false)
    const existingCanvasId = comboToCanvas[comboId]
    if (existingCanvasId) {
      router.push(`/products/${sku}/criativos/${existingCanvasId}`)
      setCanvasId(existingCanvasId)
      setPendingComboId(null)
    } else {
      setPendingComboId(comboId)
      setCanvasId(null)
      if (initialCanvasId) router.push(`/products/${sku}/criativos`)
    }
  }, [comboToCanvas, sku, router, initialCanvasId])

  const handleCreateCanvas = useCallback(async (comboId: string): Promise<string | null> => {
    const res  = await fetch(`/api/products/${sku}/canvas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ copy_combination_id: comboId }),
    })
    const json = await res.json() as { canvas_id?: string; status?: string }
    if (json.status === 'no_storyboard') { setNoStoryboard(true); return null }
    if (json.canvas_id) {
      setComboToCanvas(prev => ({ ...prev, [comboId]: json.canvas_id! }))
      router.push(`/products/${sku}/criativos/${json.canvas_id}`)
      setCanvasId(json.canvas_id)
      setPendingComboId(null)
      return json.canvas_id
    }
    return null
  }, [sku, router])

  const handleCreateFromEmptyState = useCallback(async () => {
    if (!pendingComboId) return
    setIsCreating(true)
    try { await handleCreateCanvas(pendingComboId) }
    finally { setIsCreating(false) }
  }, [pendingComboId, handleCreateCanvas])

  const handleAddAdicional = useCallback(async () => {
    if (!canvasId || !data) return
    await createNode({
      canvas_id: canvasId, type: 'adicional', label: 'Adicional',
      position_x: Math.random() * 400 + 200, position_y: Math.random() * 300,
      config: { count: 1, aspect_ratio: '1:1' },
    })
  }, [canvasId, data, createNode])

  const handleUpdateConfig = useCallback(async (nodeId: string, config: Record<string, unknown>) => {
    await updateNode(nodeId, { config })
  }, [updateNode])

  const handleCreateEdge = useCallback(async (sourceId: string, targetId: string) => {
    if (!canvasId) return
    await createEdge(canvasId, sourceId, targetId)
  }, [canvasId, createEdge])

  const handleRunAll = useCallback(async () => {
    if (!data || runAllProgress) return
    try { await runAllNodes((current, total) => setRunAllProgress({ current, total })) }
    finally { setRunAllProgress(null) }
  }, [data, runAllNodes, runAllProgress])

  const selector = (
    <CombinationSelector
      sku={sku}
      selectedId={selectedComboId}
      comboToCanvas={comboToCanvas}
      onSelect={handleSelectCombo}
      onCreateCanvas={handleCreateCanvas}
    />
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar — só aparece quando há uma combinação ou canvas ativo */}
      {hasActiveContent && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-container shrink-0">
          {selector}

          {isLoading && canvasId && (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-on-surface-muted" />
          )}

          {canvasId && data && (
            <>
              <button
                onClick={handleRunAll}
                disabled={!!runAllProgress}
                className={cn(
                  'ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-[0.6875rem] font-medium transition-all duration-150',
                  'bg-brand/15 text-brand border border-brand/20 hover:bg-brand/25 hover:border-brand/40',
                  'disabled:opacity-50 disabled:pointer-events-none',
                )}
              >
                {runAllProgress ? (
                  <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Gerando {runAllProgress.current} de {runAllProgress.total}…</>
                ) : (
                  <><Zap size={13} strokeWidth={1.5} /> Gerar tudo</>
                )}
              </button>

              <button
                onClick={() => setIsFullscreen(f => !f)}
                title={isFullscreen ? 'Sair do fullscreen' : 'Fullscreen'}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150',
                  'border-outline-variant/20 text-on-surface-muted hover:text-on-surface hover:border-outline-variant/40',
                  isFullscreen && 'border-brand/40 text-brand bg-brand/10',
                )}
              >
                {isFullscreen
                  ? <Minimize2 size={14} strokeWidth={1.5} />
                  : <Maximize2 size={14} strokeWidth={1.5} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden min-h-0 relative">

        {/* Empty state inicial — selector centralizado */}
        {!hasActiveContent && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
              <LayoutTemplate size={28} strokeWidth={1.5} className="text-on-surface-muted" />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <p className="text-sm font-semibold text-on-surface">Selecione uma combinação</p>
              <p className="text-[0.6875rem] text-on-surface-variant">
                Escolha uma copy combination para abrir ou criar o canvas de criativos.
              </p>
            </div>
            {selector}
          </div>
        )}

        {/* Storyboard não gerado */}
        {selectedComboId && noStoryboard && (
          <EmptyState
            icon={<AlertCircle size={28} strokeWidth={1.5} className="text-status-paused-text" />}
            title="Storyboard não gerado"
            description="Execute Script Writer e Keyframe Generator para esta combinação antes de criar o canvas."
          />
        )}

        {/* Combo sem canvas — botão criar */}
        {pendingComboId && !noStoryboard && !canvasId && (
          <EmptyState
            icon={<LayoutTemplate size={28} strokeWidth={1.5} className="text-on-surface-muted" />}
            title="Canvas não criado"
            description="Clique abaixo para inicializar o canvas a partir dos keyframes desta combinação."
            action={
              <button
                onClick={handleCreateFromEmptyState}
                disabled={isCreating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  bg-brand text-white hover:opacity-90 disabled:opacity-50 transition-all duration-150"
              >
                {isCreating
                  ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                  : <Plus size={14} strokeWidth={1.5} />}
                {isCreating ? 'Criando…' : 'Criar canvas'}
              </button>
            }
          />
        )}

        {/* Canvas */}
        {canvasId && (
          <div className={cn(
            'transition-all duration-200',
            isFullscreen
              ? 'fixed inset-0 z-50 flex flex-col bg-surface'
              : 'absolute inset-0',
          )}>
            {/* Barra fullscreen */}
            {isFullscreen && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-container shrink-0">
                {selector}
                <button
                  onClick={handleRunAll}
                  disabled={!!runAllProgress}
                  className={cn(
                    'ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-[0.6875rem] font-medium transition-all duration-150',
                    'bg-brand/15 text-brand border border-brand/20 hover:bg-brand/25 hover:border-brand/40',
                    'disabled:opacity-50 disabled:pointer-events-none',
                  )}
                >
                  {runAllProgress
                    ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Gerando {runAllProgress.current} de {runAllProgress.total}…</>
                    : <><Zap size={13} strokeWidth={1.5} /> Gerar tudo</>}
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-brand/40 text-brand bg-brand/10 transition-all duration-150"
                >
                  <Minimize2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-hidden min-h-0 h-full">
              {isLoading && <CanvasPlaceholder />}
              {!isLoading && data && (
                <CanvasBoard
                  key={canvasId}
                  data={data}
                  canvasId={canvasId}
                  onGenerate={generateNode}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdatePrompt={updatePrompt}
                  onToggleOutput={toggleOutput}
                  onDeleteOutput={deleteOutput}
                  onCreateEdge={handleCreateEdge}
                  onDeleteEdge={deleteEdge}
                  onNodeDragStop={saveNodePosition}
                  onAddAdicional={handleAddAdicional}
                  onCreateNode={createNode}
                  onDeleteNode={deleteNode}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({
  icon, title, description, action,
}: {
  icon: React.ReactNode; title: string; description: string; action?: React.ReactNode
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
        {icon}
      </div>
      <div className="text-center space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-[0.6875rem] text-on-surface-variant">{description}</p>
      </div>
      {action}
    </div>
  )
}
