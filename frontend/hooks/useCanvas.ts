'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeType = 'copy' | 'storyboard' | 'personagem' | 'cenario' | 'produto' | 'adicional' | 'frame' | 'video'

export interface StoryboardScene {
  scene_number:   number
  section:        string
  scene_type:     string
  character_id:   string
  character_name: string
  narration:      string
  frame_prompt:   string
  video_prompt:   string
  frame_node_id?: string
  video_node_id?: string
}
export type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

export interface CanvasOutput {
  id:            string
  output_type:   'image' | 'video'
  drive_file_id: string | null
  drive_url:     string | null
  is_active:     boolean
  created_at:    string
}

export interface CanvasNode {
  id:                string
  type:              NodeType
  label:             string | null
  position_x:        number
  position_y:        number
  prompt:            string | null
  config:            { count?: number; aspect_ratio?: string; scene_index?: number; character_id?: string; scenes?: StoryboardScene[] }
  generation_status: GenerationStatus
  error_message:     string | null
  canvas_node_outputs: CanvasOutput[]
}

export interface CanvasEdge {
  id:             string
  source_node_id: string
  target_node_id: string
}

export interface CanvasData {
  canvas: { id: string; copy_combination_id: string }
  nodes:  CanvasNode[]
  edges:  CanvasEdge[]
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 3_000

export function useCanvas(canvasId: string | null) {
  const [data,      setData]      = useState<CanvasData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCanvas = useCallback(async () => {
    if (!canvasId) return
    try {
      const res = await fetch(`/api/canvas/${canvasId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json() as CanvasData
      setData(json)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [canvasId])

  // Cleanup: só ao desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (!canvasId) { setIsLoading(false); return }
    setIsLoading(true)
    fetchCanvas().finally(() => setIsLoading(false))
  }, [canvasId, fetchCanvas])

  // ── Mutações ─────────────────────────────────────────────────────────────────

  const updateNode = useCallback(async (
    nodeId: string,
    patch: { prompt?: string; config?: Record<string, unknown> },
  ) => {
    await fetch(`/api/canvas/nodes/${nodeId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    })
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n),
    } : prev)
  }, [])

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    await fetch(`/api/canvas/nodes/${nodeId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ position_x: x, position_y: y }),
    })
  }, [])

  const createNode = useCallback(async (payload: {
    canvas_id:   string
    type:        NodeType
    label?:      string
    position_x?: number
    position_y?: number
    prompt?:     string
    config?:     Record<string, unknown>
  }) => {
    const res = await fetch('/api/canvas/nodes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const { node } = await res.json() as { node: CanvasNode }
    node.canvas_node_outputs = []
    setData(prev => prev ? { ...prev, nodes: [...prev.nodes, node] } : prev)
    return node
  }, [])

  const deleteNode = useCallback(async (nodeId: string) => {
    await fetch(`/api/canvas/nodes/${nodeId}`, { method: 'DELETE' })
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
    } : prev)
  }, [])

  const updatePrompt = useCallback(async (nodeId: string, prompt: string) => {
    await fetch(`/api/canvas/nodes/${nodeId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    })
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, prompt } : n),
    } : prev)
  }, [])

  const createEdge = useCallback(async (canvasId: string, sourceNodeId: string, targetNodeId: string) => {
    const res = await fetch('/api/canvas/edges', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ canvas_id: canvasId, source_node_id: sourceNodeId, target_node_id: targetNodeId }),
    })
    if (!res.ok) {
      const { error } = await res.json() as { error: string }
      setError(error ?? 'Erro ao criar conexão')
      return null
    }
    const { edge } = await res.json() as { edge: CanvasEdge }
    setData(prev => prev ? { ...prev, edges: [...prev.edges, edge] } : prev)
    return edge
  }, [])

  const deleteEdge = useCallback(async (edgeId: string) => {
    await fetch(`/api/canvas/edges/${edgeId}`, { method: 'DELETE' })
    setData(prev => prev ? { ...prev, edges: prev.edges.filter(e => e.id !== edgeId) } : prev)
  }, [])

  const generateNode = useCallback(async (nodeId: string) => {
    // Marca otimisticamente como gerando
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, generation_status: 'generating' as GenerationStatus } : n),
    } : prev)

    // Aguarda o POST — o 202 só é enviado APÓS o DB confirmar 'generating'
    await fetch(`/api/canvas/nodes/${nodeId}/generate`, { method: 'POST' })

    // Polling imperativo: não depende de useEffect nem de estado React.
    // Para imediatamente quando o nó sai de 'generating'.
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    const poll = async () => {
      if (!canvasId) return
      try {
        const res  = await fetch(`/api/canvas/${canvasId}`, { cache: 'no-store' })
        const json = await res.json() as CanvasData
        setData(json)
        const stillGenerating = json.nodes.some(n => n.generation_status === 'generating')
        if (!stillGenerating) {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch { /* ignora erros de rede transitórios */ }
    }

    pollRef.current = setInterval(poll, POLL_INTERVAL)
  }, [canvasId, fetchCanvas])

  const toggleOutput = useCallback(async (outputId: string, nodeId: string, isActive: boolean) => {
    await fetch(`/api/canvas/outputs/${outputId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: isActive }),
    })
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id !== nodeId ? n : {
        ...n,
        canvas_node_outputs: n.canvas_node_outputs.map(o =>
          o.id === outputId ? { ...o, is_active: isActive } : o,
        ),
      }),
    } : prev)
  }, [])

  const deleteOutput = useCallback(async (outputId: string, nodeId: string) => {
    await fetch(`/api/canvas/outputs/${outputId}`, { method: 'DELETE' })
    setData(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id !== nodeId ? n : {
        ...n,
        canvas_node_outputs: n.canvas_node_outputs.filter(o => o.id !== outputId),
      }),
    } : prev)
  }, [])

  // Aguarda um nó terminar de gerar (polling direto na API)
  const waitForNode = useCallback(async (nodeId: string, canvasId: string) => {
    return new Promise<void>(resolve => {
      const interval = setInterval(async () => {
        try {
          const res  = await fetch(`/api/canvas/${canvasId}`, { cache: 'no-store' })
          const json = await res.json() as CanvasData
          const n    = json.nodes.find(x => x.id === nodeId)
          if (n?.generation_status === 'done' || n?.generation_status === 'error') {
            clearInterval(interval)
            setData(json)
            resolve()
          }
        } catch {
          clearInterval(interval)
          resolve()
        }
      }, POLL_INTERVAL)
    })
  }, [])

  // Roda todos os nós em ordem topológica (Kahn's algorithm), pulando os já gerados
  const runAllNodes = useCallback(async (
    onProgress?: (current: number, total: number) => void,
  ) => {
    if (!data) return

    const inDegree = new Map<string, number>()
    const adj      = new Map<string, string[]>()
    data.nodes.forEach(n => { inDegree.set(n.id, 0); adj.set(n.id, []) })
    data.edges.forEach(e => {
      adj.get(e.source_node_id)?.push(e.target_node_id)
      inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) ?? 0) + 1)
    })

    const queue = data.nodes
      .filter(n => (inDegree.get(n.id) ?? 0) === 0)
      .map(n => n.id)
    const order: string[] = []
    while (queue.length) {
      const id = queue.shift()!
      order.push(id)
      for (const next of (adj.get(id) ?? [])) {
        const deg = (inDegree.get(next) ?? 1) - 1
        inDegree.set(next, deg)
        if (deg === 0) queue.push(next)
      }
    }

    const toGenerate = order.filter(id => {
      const n = data.nodes.find(x => x.id === id)
      if (!n || n.type === 'copy' || n.type === 'storyboard') return false
      return (n.canvas_node_outputs?.length ?? 0) === 0 && n.generation_status !== 'generating'
    })

    for (let i = 0; i < toGenerate.length; i++) {
      onProgress?.(i + 1, toGenerate.length)
      await generateNode(toGenerate[i])
      await waitForNode(toGenerate[i], data.canvas.id)
    }
    onProgress?.(toGenerate.length, toGenerate.length)
  }, [data, generateNode, waitForNode])

  return {
    data,
    isLoading,
    error,
    refetch: fetchCanvas,
    updateNode,
    updatePrompt,
    saveNodePosition,
    createNode,
    deleteNode,
    createEdge,
    deleteEdge,
    generateNode,
    runAllNodes,
    toggleOutput,
    deleteOutput,
  }
}
