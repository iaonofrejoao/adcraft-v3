'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesDelete,
  type OnNodesChange,
  type OnSelectionChangeParams,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PlusCircle } from 'lucide-react'
import { StoryboardNode } from './nodes/StoryboardNode'
import { CopyNode }       from './nodes/CopyNode'
import { ImageNode }      from './nodes/ImageNode'
import { VideoNode }      from './nodes/VideoNode'
import { NodeInspector }  from './NodeInspector'
import { CanvasContextMenu } from './CanvasContextMenu'
import type { CanvasData, CanvasNode, NodeType } from '@/hooks/useCanvas'

interface CanvasBoardProps {
  data:            CanvasData
  canvasId:        string
  onGenerate:      (nodeId: string) => void
  onUpdateConfig:  (nodeId: string, config: Record<string, unknown>) => void
  onUpdatePrompt:  (nodeId: string, prompt: string) => void
  onToggleOutput:  (outputId: string, nodeId: string, active: boolean) => void
  onDeleteOutput:  (outputId: string, nodeId: string) => void
  onCreateEdge:    (sourceId: string, targetId: string) => void
  onDeleteEdge:    (edgeId: string) => void
  onNodeDragStop:  (nodeId: string, x: number, y: number) => void
  onAddAdicional:  () => void
  onCreateNode:    (payload: {
    canvas_id:   string
    type:        NodeType
    label?:      string
    position_x?: number
    position_y?: number
    config?:     Record<string, unknown>
  }) => void
  onDeleteNode:    (nodeId: string) => void
}

const nodeTypes = {
  storyboard: StoryboardNode,
  copy:       CopyNode,
  personagem: ImageNode,
  cenario:    ImageNode,
  produto:    ImageNode,
  adicional:  ImageNode,
  frame:      ImageNode,
  video:      VideoNode,
}

const HANDLE_COLORS: Record<string, string> = {
  personagem: '#22C55E',
  cenario:    '#22C55E',
  produto:    '#22C55E',
  adicional:  '#22C55E',
  frame:      '#22C55E',
  video:      '#8B5CF6',
}

const IMAGE_NODE_TYPES = new Set(['personagem', 'cenario', 'produto', 'adicional', 'frame'])

// ── Layout vertical ────────────────────────────────────────────────────────────
// Cada tipo de nó ocupa uma linha horizontal (eixo Y); cenas se expandem no eixo X.
const SCENE_GAP_X  = 360  // px entre cenas na mesma linha
const ROW_GAP_Y    = 380  // px entre linhas de tipos

function computeVerticalLayout(nodes: CanvasNode[]): Record<string, { x: number; y: number }> {
  const frames  = nodes.filter(n => n.type === 'frame')
  const chars   = nodes.filter(n => n.type === 'personagem')
  const totalW  = Math.max(frames.length - 1, 0) * SCENE_GAP_X
  const centerX = totalW / 2

  const pos: Record<string, { x: number; y: number }> = {}

  for (const n of nodes) {
    switch (n.type) {
      case 'storyboard':
        // Storyboard ocupa ~320px de largura — centralizar no eixo X
        pos[n.id] = { x: centerX - 160, y: 0 }
        break
      case 'personagem': {
        const idx    = chars.findIndex(c => c.id === n.id)
        const spread = (chars.length - 1) * 320
        pos[n.id] = { x: centerX - spread / 2 + idx * 320, y: ROW_GAP_Y }
        break
      }
      case 'frame': {
        const si = ((n.config.scene_index as number | undefined) ?? 1) - 1
        pos[n.id] = { x: si * SCENE_GAP_X, y: 2 * ROW_GAP_Y }
        break
      }
      case 'video': {
        const si = ((n.config.scene_index as number | undefined) ?? 1) - 1
        pos[n.id] = { x: si * SCENE_GAP_X, y: 3 * ROW_GAP_Y }
        break
      }
      default:
        pos[n.id] = { x: n.position_x, y: n.position_y }
    }
  }

  return pos
}
// ──────────────────────────────────────────────────────────────────────────────

function getEdgeStyle(sourceType: string | undefined): React.CSSProperties {
  if (sourceType === 'copy')  return { stroke: '#F59E0B', strokeOpacity: 0.7, strokeWidth: 1.5 }
  if (sourceType === 'video') return { stroke: '#8B5CF6', strokeOpacity: 0.7, strokeWidth: 1.5 }
  return { stroke: '#22C55E', strokeOpacity: 0.6, strokeWidth: 1.5 }
}

function getConnectionType(
  nodeId: string,
  edges: CanvasData['edges'],
  nodes: CanvasNode[],
): 'animate-frame' | 'reference' | 'none' {
  const incoming = edges.filter(e => e.target_node_id === nodeId)
  if (incoming.length === 0) return 'none'
  const srcTypes = incoming.map(e => nodes.find(n => n.id === e.source_node_id)?.type)
  return srcTypes.includes('frame') ? 'animate-frame' : 'reference'
}

function FitViewOnLoad({ count }: { count: number }) {
  const { fitView } = useReactFlow()
  const fitted = useRef(false)

  useEffect(() => {
    if (count > 0 && !fitted.current) {
      fitted.current = true
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 400 }))
    }
  }, [count, fitView])

  return null
}

function CanvasBoardInner({
  data,
  canvasId,
  onGenerate,
  onUpdateConfig,
  onUpdatePrompt,
  onToggleOutput,
  onDeleteOutput,
  onCreateEdge,
  onDeleteEdge,
  onNodeDragStop,
  onAddAdicional,
  onCreateNode,
  onDeleteNode,
}: CanvasBoardProps) {
  const { screenToFlowPosition } = useReactFlow()

  // positionsRef: posições movidas pelo usuário nesta sessão (sobrepõe o layout)
  const positionsRef     = useRef<Record<string, { x: number; y: number }>>({})
  // layoutSavedRef: evita salvar o layout vertical ao DB mais de uma vez por canvas
  const layoutSavedRef   = useRef<string | null>(null)

  const [inspectedNode, setInspectedNode] = useState<CanvasNode | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Sync: reconstrói nós com layout vertical; preserva posições movidas na sessão
  useEffect(() => {
    const layout  = computeVerticalLayout(data.nodes)

    const rfNodes: Node[] = data.nodes.map(n => {
      // Prioridade: posição movida na sessão > layout vertical calculado > posição no DB
      const pos  = positionsRef.current[n.id] ?? layout[n.id] ?? { x: n.position_x, y: n.position_y }
      const hc   = HANDLE_COLORS[n.type] ?? '#22C55E'
      const base = { node: n, onGenerate, onUpdateConfig, onToggleOutput, onDeleteOutput, onDeleteNode, handleColor: hc }
      const nodeData =
        n.type === 'storyboard'
          ? { node: n, onUpdateConfig, onUpdatePrompt }
          : n.type === 'video'
          ? { ...base, connectionType: getConnectionType(n.id, data.edges, data.nodes) }
          : base

      return { id: n.id, type: n.type, position: pos, data: nodeData, selected: false } as Node
    })

    const rfEdges: Edge[] = data.edges.map(e => {
      const srcType = data.nodes.find(n => n.id === e.source_node_id)?.type
      return {
        id:       e.id,
        source:   e.source_node_id,
        target:   e.target_node_id,
        animated: data.nodes.find(n => n.id === e.target_node_id)?.generation_status === 'generating',
        style:    getEdgeStyle(srcType),
      } as Edge
    })

    setNodes(rfNodes)
    setEdges(rfEdges)

    // Persiste o layout vertical no DB na primeira carga do canvas (uma vez por sessão)
    if (layoutSavedRef.current !== canvasId && data.nodes.length > 0) {
      layoutSavedRef.current = canvasId
      for (const n of data.nodes) {
        const p = layout[n.id]
        if (p) onNodeDragStop(n.id, p.x, p.y)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onGenerate, onUpdateConfig, onUpdatePrompt, onToggleOutput, onDeleteOutput])

  useEffect(() => {
    if (!inspectedNode) return
    const fresh = data.nodes.find(n => n.id === inspectedNode.id)
    if (fresh) setInspectedNode(fresh)
  }, [data.nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodesChange: OnNodesChange = useCallback(changes => {
    changes.forEach(c => {
      if (c.type === 'position' && c.position) positionsRef.current[c.id] = c.position
    })
    onNodesChange(changes)
  }, [onNodesChange])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeDragStop = useCallback((_e: any, node: Node) => {
    positionsRef.current[node.id] = node.position
    onNodeDragStop(node.id, node.position.x, node.position.y)
  }, [onNodeDragStop])

  const handleConnect: OnConnect = useCallback(conn => {
    if (conn.source && conn.target) onCreateEdge(conn.source, conn.target)
  }, [onCreateEdge])

  const handleEdgesDelete: OnEdgesDelete = useCallback(dels => {
    dels.forEach(e => onDeleteEdge(e.id))
  }, [onDeleteEdge])

  const handleSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    if (sel.length === 1) {
      const canvasNode = data.nodes.find(n => n.id === sel[0].id)
      if (!canvasNode || canvasNode.type === 'storyboard') { setInspectedNode(null); return }
      setInspectedNode(canvasNode)
    } else {
      setInspectedNode(null)
    }
  }, [data.nodes])

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault()
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const target  = e.currentTarget as HTMLElement | null
    const rect    = target?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : e.clientX
    const y = rect ? e.clientY - rect.top  : e.clientY
    setCtxMenu({ x, y, flowX: flowPos.x, flowY: flowPos.y })
  }, [screenToFlowPosition])

  const handleAddNodeFromMenu = useCallback((type: NodeType, flowX: number, flowY: number) => {
    const DEFAULT_CONFIG: Record<string, Record<string, unknown>> = {
      personagem: { count: 1, aspect_ratio: '9:16' },
      cenario:    { count: 1, aspect_ratio: '16:9' },
      produto:    { count: 1, aspect_ratio: '1:1'  },
      frame:      { count: 1, aspect_ratio: '9:16' },
      adicional:  { count: 1, aspect_ratio: '1:1'  },
      video:      { aspect_ratio: '9:16' },
    }
    const LABELS: Record<string, string> = {
      personagem: 'Personagem', cenario: 'Cenário', produto: 'Produto',
      frame: 'Frame', adicional: 'Adicional', video: 'Vídeo',
    }
    onCreateNode({
      canvas_id: canvasId, type,
      label:     LABELS[type] ?? type,
      position_x: flowX, position_y: flowY,
      config:    DEFAULT_CONFIG[type] ?? {},
    })
    setCtxMenu(null)
  }, [canvasId, onCreateNode])

  const isValidConnection = useCallback((conn: { source: string | null; target: string | null }) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return false
    const srcType = data.nodes.find(n => n.id === conn.source)?.type
    const tgtType = data.nodes.find(n => n.id === conn.target)?.type
    if (!srcType || !tgtType) return false
    if (srcType === 'storyboard' || tgtType === 'storyboard') return false
    if (IMAGE_NODE_TYPES.has(srcType)) return IMAGE_NODE_TYPES.has(tgtType) || tgtType === 'video'
    return false
  }, [data.nodes])

  return (
    <div className="relative w-full h-full bg-surface">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onEdgesDelete={handleEdgesDelete}
        onSelectionChange={handleSelectionChange}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={() => setCtxMenu(null)}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        isValidConnection={isValidConnection}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-outline-variant)" />
        <Controls showInteractive={false} className="!bg-surface-container !border-outline-variant/20 !rounded-lg" />
        <MiniMap
          nodeColor={() => 'var(--color-surface-high)'}
          maskColor="rgba(0,0,0,0.4)"
          className="!bg-surface-container !border !border-outline-variant/20 !rounded-lg"
        />
        <FitViewOnLoad count={nodes.length} />
      </ReactFlow>

      {ctxMenu && (
        <CanvasContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          flowX={ctxMenu.flowX} flowY={ctxMenu.flowY}
          onAddNode={handleAddNodeFromMenu}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <NodeInspector
        node={inspectedNode}
        onClose={() => setInspectedNode(null)}
        onUpdateConfig={onUpdateConfig}
        onUpdatePrompt={onUpdatePrompt}
        onDeleteNode={onDeleteNode}
        onGenerate={onGenerate}
      />

      <button
        onClick={onAddAdicional}
        className="absolute bottom-5 left-5 z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-[0.6875rem] font-medium
          bg-surface-container border border-outline-variant/20 text-on-surface-variant
          hover:border-brand/40 hover:text-on-surface hover:bg-surface-high transition-all duration-150 shadow-lg"
      >
        <PlusCircle size={14} strokeWidth={1.5} />
        Imagem Adicional
      </button>
    </div>
  )
}

export function CanvasBoard(props: CanvasBoardProps) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner {...props} />
    </ReactFlowProvider>
  )
}
