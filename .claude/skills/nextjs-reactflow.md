---
name: nextjs-reactflow
description: >
  Build Next.js 14 App Router applications with React Flow visual workflow editors,
  including custom nodes, edge types, side panels, real-time state updates, and
  canvas interactions. Use this skill for any task involving Next.js 14, App Router,
  Server Components, React Flow canvas, visual pipeline builders, node-based editors,
  or flow diagram interfaces. Triggers on: Next.js, App Router, React Flow, visual workflow,
  node editor, flow canvas, custom nodes, pipeline builder, or any request to build
  a drag-and-drop flow interface.
---

# Next.js 14 App Router + React Flow

Skill para construir aplicações Next.js 14 com editores de fluxo visual usando React Flow.
Cobre estrutura de projeto, padrões do App Router, nós customizados, painéis laterais e integração com backend.

---

## Estrutura do Projeto Next.js 14

```
frontend/
├── app/                          # App Router (Next.js 14)
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Página inicial (projetos)
│   ├── globals.css               # Estilos globais
│   ├── providers.tsx             # Context providers globais
│   │
│   ├── projetos/
│   │   ├── page.tsx              # Lista de projetos
│   │   └── [id]/
│   │       ├── page.tsx          # Projeto individual
│   │       └── execucoes/
│   │           └── [execId]/
│   │               └── page.tsx  # Fluxo da execução
│   │
│   ├── biblioteca/
│   │   └── page.tsx
│   ├── campanhas/
│   │   └── page.tsx
│   ├── nichos/
│   │   └── page.tsx
│   ├── ferramentas/
│   │   └── page.tsx
│   ├── templates/
│   │   └── page.tsx
│   └── assistente/
│       └── page.tsx
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── NotificationBell.tsx
│   │
│   ├── flow/                     # React Flow components
│   │   ├── FlowCanvas.tsx        # Componente principal do canvas
│   │   ├── nodes/
│   │   │   ├── AgentNode.tsx     # Nó padrão de agente
│   │   │   ├── ParallelNode.tsx  # Nó com múltiplas saídas
│   │   │   └── ApprovalNode.tsx  # Nó aguardando aprovação
│   │   ├── edges/
│   │   │   └── AnimatedEdge.tsx  # Edge com animação de fluxo
│   │   ├── panels/
│   │   │   ├── NodeConfigPanel.tsx   # Painel lateral de configuração
│   │   │   ├── ApprovalPanel.tsx     # Painel de aprovação/feedback
│   │   │   └── CostPanel.tsx         # Painel de custo em tempo real
│   │   └── controls/
│   │       ├── ExecuteButton.tsx
│   │       └── FlowToolbar.tsx
│   │
│   ├── ui/                       # Componentes reutilizáveis
│   │   ├── Badge.tsx
│   │   ├── Toggle.tsx
│   │   ├── CostDisplay.tsx
│   │   └── StatusIndicator.tsx
│   │
│   └── modals/
│       ├── NewProjectModal.tsx
│       └── LaunchReviewModal.tsx
│
├── hooks/
│   ├── useExecution.ts           # Estado da execução em andamento
│   ├── useNodeStatus.ts          # Status em tempo real dos nós
│   ├── useWebSocket.ts           # Conexão WebSocket com reconexão
│   └── useCostTracker.ts         # Custo acumulado por nó
│
├── lib/
│   ├── api.ts                    # Cliente HTTP para o backend
│   ├── supabase.ts               # Cliente Supabase
│   └── utils.ts
│
├── stores/
│   ├── executionStore.ts         # Zustand store para estado de execução
│   └── flowStore.ts              # Zustand store para o canvas
│
├── types/
│   ├── execution.ts
│   ├── node.ts
│   └── api.ts
│
└── constants/
    ├── nodeTypes.ts              # Registro de tipos de nó
    └── templates.ts              # Templates de fluxo predefinidos
```

---

## Regras do App Router (Next.js 14)

### Server vs Client Components

```tsx
// CORRETO — Server Component (padrão, sem 'use client')
// app/projetos/page.tsx
import { createServerClient } from '@/lib/supabase-server'

export default async function ProjetosPage() {
  const supabase = createServerClient()
  const { data: projetos } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return <ProjetosClient projetos={projetos} />
}

// CORRETO — Client Component (interatividade)
// components/flow/FlowCanvas.tsx
'use client'
import { ReactFlow } from '@xyflow/react'
```

**Regra**: Toda interatividade (onClick, useState, useEffect, WebSocket) exige `'use client'`. Busca de dados em Server Components sempre que possível.

### Layouts aninhados

```tsx
// app/projetos/[id]/layout.tsx
export default function ProjetoLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div className="flex flex-col h-full">
      <ProjetoTopbar projetoId={params.id} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
```

---

## React Flow — Nó Customizado de Agente

```tsx
// components/flow/nodes/AgentNode.tsx
'use client'
import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { AgentNodeData } from '@/types/node'

type NodeStatus = 'idle' | 'running' | 'waiting_approval' | 'approved' | 'failed' | 'disabled'

const statusConfig: Record<NodeStatus, { bg: string; border: string; label: string }> = {
  idle:             { bg: 'bg-gray-50',   border: 'border-gray-200', label: 'aguardando' },
  running:          { bg: 'bg-purple-50', border: 'border-purple-300', label: 'executando' },
  waiting_approval: { bg: 'bg-blue-50',   border: 'border-blue-300', label: 'aguardando aprovação' },
  approved:         { bg: 'bg-green-50',  border: 'border-green-300', label: 'aprovado' },
  failed:           { bg: 'bg-red-50',    border: 'border-red-300', label: 'falha' },
  disabled:         { bg: 'bg-gray-100',  border: 'border-gray-200', label: 'desativado' },
}

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const config = statusConfig[data.status]

  return (
    <div
      className={`
        relative min-w-[120px] rounded-lg border px-3 py-2 cursor-pointer
        transition-all duration-200 select-none
        ${config.bg} ${config.border}
        ${selected ? 'ring-2 ring-purple-500 ring-offset-1' : ''}
        ${data.status === 'disabled' ? 'opacity-60' : ''}
      `}
      title={data.tooltipMessage}
    >
      {/* Handle de entrada */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-gray-400 border-none"
      />

      {/* Conteúdo do nó */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-800 text-center">
          {data.label}
        </span>
        <span className="text-[10px] text-gray-500 text-center">
          {config.label}
        </span>

        {/* Custo quando disponível */}
        {data.costUsd !== undefined && (
          <span className="text-[10px] text-gray-400 text-center">
            ${data.costUsd.toFixed(4)}
          </span>
        )}

        {/* Indicador de fila de API */}
        {data.queueStatus && (
          <span className="text-[10px] text-amber-600 text-center">
            {data.queueStatus}
          </span>
        )}
      </div>

      {/* Handle de saída */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-gray-400 border-none"
      />

      {/* Indicador de running (pulso) */}
      {data.status === 'running' && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
      )}
    </div>
  )
})

AgentNode.displayName = 'AgentNode'
```

---

## React Flow — Canvas Principal

```tsx
// components/flow/FlowCanvas.tsx
'use client'
import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AgentNode } from './nodes/AgentNode'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { NodeConfigPanel } from './panels/NodeConfigPanel'
import { useNodeStatus } from '@/hooks/useNodeStatus'
import { useFlowStore } from '@/stores/flowStore'

// Registro de tipos — DEVE estar fora do componente para evitar re-renders
const nodeTypes = {
  agent: AgentNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
}

interface FlowCanvasProps {
  executionId: string
  templateNodes: any[]
  templateEdges: any[]
}

export function FlowCanvas({ executionId, templateNodes, templateEdges }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(templateNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(templateEdges)
  const { selectedNodeId, setSelectedNodeId } = useFlowStore()

  // Recebe atualizações de status em tempo real
  const { nodeStatuses } = useNodeStatus(executionId)

  // Atualiza status dos nós quando o WebSocket trouxer novidades
  useEffect(() => {
    if (!nodeStatuses) return
    setNodes(nds =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          status: nodeStatuses[node.id]?.status ?? node.data.status,
          costUsd: nodeStatuses[node.id]?.costUsd ?? node.data.costUsd,
          queueStatus: nodeStatuses[node.id]?.queueStatus ?? null,
          tooltipMessage: nodeStatuses[node.id]?.tooltipMessage ?? null,
        }
      }))
    )
  }, [nodeStatuses, setNodes])

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'animated' }, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id)
  }, [setSelectedNodeId])

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={null}  // Desativa deleção com teclado
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#e5e7eb"
          />
          <Controls showInteractive={false} />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </div>

      {/* Painel lateral de configuração */}
      {selectedNodeId && (
        <NodeConfigPanel
          nodeId={selectedNodeId}
          executionId={executionId}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}
```

---

## Painel Lateral de Configuração de Nó

```tsx
// components/flow/panels/NodeConfigPanel.tsx
'use client'
import { useState } from 'react'
import { X } from 'lucide-react'

interface NodeConfigPanelProps {
  nodeId: string
  executionId: string
  onClose: () => void
}

export function NodeConfigPanel({ nodeId, executionId, onClose }: NodeConfigPanelProps) {
  const [approvalEnabled, setApprovalEnabled] = useState(true)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514')
  const [quantity, setQuantity] = useState(1)

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Configuração do nó</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* Toggle de aprovação humana */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-700">Aprovação humana</span>
          <button
            onClick={() => setApprovalEnabled(!approvalEnabled)}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              approvalEnabled ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
              approvalEnabled ? 'left-5' : 'left-1'
            }`} />
          </button>
        </div>

        {/* Seleção de modelo */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Modelo de IA</label>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5"
          >
            <option value="claude-opus-4-6">Claude Opus 4.6</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          </select>
        </div>

        {/* Quantidade de variações (para nós de geração) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Variações a gerar</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >−</button>
            <span className="text-sm font-medium w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >+</button>
          </div>
        </div>

        {/* Toggle de ativação do nó */}
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <span className="text-sm text-gray-700">Nó ativo</span>
          <button className="w-10 h-6 rounded-full bg-purple-600 relative">
            <span className="absolute top-1 left-5 w-4 h-4 rounded-full bg-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Zustand Store para o Flow

```tsx
// stores/flowStore.ts
import { create } from 'zustand'

interface FlowStore {
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  totalCostUsd: number
  addNodeCost: (nodeId: string, costUsd: number) => void
}

export const useFlowStore = create<FlowStore>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  totalCostUsd: 0,
  addNodeCost: (_, costUsd) => set(state => ({
    totalCostUsd: state.totalCostUsd + costUsd
  })),
}))
```

---

## Dependências (package.json)

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@xyflow/react": "^12.0.0",
    "zustand": "^4.5.0",
    "@supabase/supabase-js": "^2.43.0",
    "lucide-react": "^0.383.0",
    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.12.0"
  }
}
```

---

## Referências

- `references/node-types.md` — Tipos de nó disponíveis e suas propriedades
- `references/templates.md` — Estrutura dos templates de fluxo predefinidos
