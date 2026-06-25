# Canvas Criativos v2 — Guia de Implementação

> Criado em 2026-06-25. Repositório de referência: SamurAIGPT/Vibe-Workflow.
> **Sem tocar:** DB schema, API routes, workers, CombinationSelector.

## Estado de progresso

- [x] Doc criado
- [ ] Etapa 1 — NodeInspector
- [ ] Etapa 5 — Handle colors
- [ ] Etapa 2 — ImageNode Carousel + Lightbox
- [ ] Etapa 3 — CopyNode expandido
- [ ] Etapa 4 — Canvas Context Menu
- [ ] Etapa 6 — runAllNodes + Gerar Tudo
- [ ] Etapa 7 — VideoNode melhorado
- [ ] Etapa 8 — Node options menu

---

## Arquitetura de componentes

```
CriativosTab
├── CombinationSelector          (sem tocar)
├── toolbar: botão "Gerar tudo"  (novo — Etapa 6)
└── CanvasBoard
    ├── ReactFlow
    │   ├── CopyNode             (expandido — Etapa 3)
    │   ├── ImageNode            (carousel — Etapa 2)
    │   └── VideoNode            (melhorado — Etapa 7)
    ├── NodeInspector            (novo — Etapa 1)  ← painel direito
    ├── CanvasContextMenu        (novo — Etapa 4)  ← right-click
    └── ImageLightbox            (novo — Etapa 2)  ← modal fullscreen
```

---

## Etapa 1 — NodeInspector

**Arquivo:** `frontend/components/canvas/NodeInspector.tsx`

### O que faz
Painel lateral à direita que abre ao selecionar qualquer nó (via `onSelectionChange` do ReactFlow).
Remove a necessidade de count/ratio dentro do ImageNode bottom bar.

### Interface do componente
```tsx
interface NodeInspectorProps {
  node:           CanvasNode | null     // null = fechado
  onClose:        () => void
  onUpdateConfig: (nodeId: string, config: Record<string, unknown>) => void
  onUpdatePrompt: (nodeId: string, prompt: string) => void
  onDeleteNode:   (nodeId: string) => void
  onGenerate:     (nodeId: string) => void
}
```

### Layout
```
┌─────────────────────────────┐
│ [X]  PERSONAGEM             │  ← header com tipo + close
├─────────────────────────────┤
│ Prompt                       │
│ ┌───────────────────────┐   │
│ │ textarea rows=6       │   │  ← auto-save onBlur
│ └───────────────────────┘   │
│                              │
│ Quantidade    Proporção       │
│ [−] 2 [+]    ● 9:16         │
│              ○ 1:1           │
│              ○ 16:9          │
│              ○ 4:3           │
├─────────────────────────────┤
│ [⚡ Gerar]  [🗑 Deletar nó] │  ← rodapé de ações
└─────────────────────────────┘
```

### Regras
- CopyNode: só exibe label + close; sem configurações
- Nós fixos (personagem, cenario, produto, copy): **sem botão Deletar**
- Nós criados pelo usuário (adicional, frame extra, video extra): **com botão Deletar**
- Posição: `absolute right-0 top-0 h-full w-72 z-20`
- Backdrop: fundo translúcido `bg-surface-container/95 border-l border-white/5`
- Animação: slide-in da direita (`translate-x-0` ↔ `translate-x-full`)

### Integração em CanvasBoard
```tsx
// onSelectionChange do ReactFlow
const handleSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
  const selected = nodes[0]
  if (selected) {
    const canvasNode = data.nodes.find(n => n.id === selected.id)
    setInspectedNode(canvasNode ?? null)
  } else {
    setInspectedNode(null)
  }
}, [data.nodes])
```

### Props adicionais em CanvasBoard
```tsx
onUpdatePrompt: (nodeId: string, prompt: string) => void
onDeleteNode:   (nodeId: string) => void
```

### Novo método em useCanvas
```tsx
const deleteNode = async (nodeId: string) => {
  await fetch(`/api/canvas/nodes/${nodeId}`, { method: 'DELETE' })
  setData(prev => prev ? {
    ...prev,
    nodes: prev.nodes.filter(n => n.id !== nodeId),
    edges: prev.edges.filter(e => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
  } : prev)
}

const updatePrompt = async (nodeId: string, prompt: string) => {
  await fetch(`/api/canvas/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  setData(prev => prev ? {
    ...prev,
    nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, prompt } : n),
  } : prev)
}
```

### Mudanças no ImageNode após Etapa 1
- Remover count stepper e ratio dropdown do bottom bar
- Bottom bar vira: `justify-end` com só o botão "⚡ Gerar"
- Prompt preview: 2 linhas truncadas acima do preview area (se prompt existir)

---

## Etapa 5 — Handle Type Colors

### Sistema de cores
| Tipo de Handle | Cor | Classe Tailwind equivalente |
|----------------|-----|----------------------------|
| CopyNode → source | Âmbar `#F59E0B` | `!bg-[#F59E0B]` |
| ImageNode → source | Verde `#22C55E` | `!bg-[#22C55E]` |
| ImageNode → target | Verde `#22C55E` | `!bg-[#22C55E]` |
| VideoNode → target | Violeta `#8B5CF6` | `!bg-[#8B5CF6]` |

### Edge colors
```tsx
// Em CanvasBoard.tsx
function getEdgeStyle(sourceType: string | undefined): React.CSSProperties {
  if (sourceType === 'copy')  return { stroke: '#F59E0B', strokeOpacity: 0.7, strokeWidth: 1.5 }
  if (sourceType === 'video') return { stroke: '#8B5CF6', strokeOpacity: 0.7, strokeWidth: 1.5 }
  return { stroke: '#22C55E', strokeOpacity: 0.6, strokeWidth: 1.5 }
}
```

### Validação isValidConnection
```tsx
// Regras:
// copy → personagem/cenario/produto/adicional/frame ✓
// imagem → frame ✓  (referência visual)
// imagem → video ✓  (referência)
// frame → video ✓   (animar frame)
// video → qualquer ✗
// copy → video ✗
const isValidConnection = (conn: Connection) => {
  if (conn.source === conn.target) return false
  const srcType = nodes.find(n => n.id === conn.source)?.type
  const tgtType = nodes.find(n => n.id === conn.target)?.type
  if (srcType === 'copy') return IMAGE_TYPES.has(tgtType ?? '')
  if (IMAGE_TYPES.has(srcType ?? '')) return IMAGE_TYPES.has(tgtType ?? '') || tgtType === 'video'
  return false
}
```

---

## Etapa 2 — ImageNode Carousel + ImageLightbox

### ImageNode — novo layout
```
┌─────────────────────────┐
│ ▣ PERSONAGEM      [⋮]  │  ← header
│ prompt preview (2 linhas)│  ← novo, só se tem prompt
├─────────────────────────┤
│                          │
│   [imagem ativa]         │  ← ocupa todo o preview, object-cover
│ ‹                     ›  │  ← botões prev/next sobrepostos ao hover
│           ↓              │
│         ● ○ ○            │  ← dots de paginação
├─────────────────────────┤
│              [⚡ Gerar]  │  ← bottom bar simplificado
└─────────────────────────┘
```

### Lógica dos dots / navegação
```tsx
// Estado local do carousel (não persiste — só UI)
const [carouselIdx, setCarouselIdx] = useState(0)

// Reset quando outputs mudam
useEffect(() => {
  setCarouselIdx(0)
}, [outputs.length])

const currentOutput = outputs[carouselIdx]
```

### ImageLightbox
**Arquivo:** `frontend/components/canvas/ImageLightbox.tsx`

```tsx
interface ImageLightboxProps {
  url:     string
  onClose: () => void
}
```
- `fixed inset-0 z-50 bg-black/85 flex items-center justify-center`
- Imagem com `max-h-[90vh] max-w-[90vw] object-contain rounded-xl`
- Click fora → fecha
- ESC → fecha (useEffect + addEventListener)
- Botão download no canto superior direito

### Botão download
```tsx
const handleDownload = async (url: string, filename: string) => {
  const res  = await fetch(`/api/drive-image?url=${encodeURIComponent(url)}`)
  const blob = await res.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
```

---

## Etapa 3 — CopyNode expandido

### Mudanças
1. Largura: `w-56` → `w-72`
2. Exibir: `line-clamp-6` → `line-clamp-10`
3. Botão "Ver tudo" no rodapé → abre modal
4. Handle source cor âmbar (Etapa 5 sincroniza)

### CopyModal
Modal simples `fixed inset-0 z-50`:
- Título "Copy Completa"
- Texto em `whitespace-pre-wrap` (preserva quebras de linha)
- Scroll interno se longo
- Botão fechar

---

## Etapa 4 — Canvas Context Menu

**Arquivo:** `frontend/components/canvas/CanvasContextMenu.tsx`

### Integração em CanvasBoard
```tsx
const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)

const handlePaneContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
  setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, flowX: flowPos.x, flowY: flowPos.y })
}, [screenToFlowPosition])
```

### Itens do menu
```tsx
const ADD_NODE_ITEMS = [
  { type: 'personagem', label: 'Personagem', icon: User },
  { type: 'cenario',    label: 'Cenário',    icon: Mountain },
  { type: 'produto',    label: 'Produto',    icon: Package },
  { type: 'frame',      label: 'Frame',      icon: Film },
  { type: 'adicional',  label: 'Adicional',  icon: Image },
  { type: 'video',      label: 'Vídeo',      icon: Video },
]
```

### Default configs por tipo ao criar
```tsx
const DEFAULT_CONFIG: Record<string, Record<string, unknown>> = {
  personagem: { count: 1, aspect_ratio: '9:16' },
  cenario:    { count: 1, aspect_ratio: '16:9' },
  produto:    { count: 1, aspect_ratio: '1:1'  },
  frame:      { count: 1, aspect_ratio: '9:16' },
  adicional:  { count: 1, aspect_ratio: '1:1'  },
  video:      { aspect_ratio: '9:16' },
}
```

---

## Etapa 6 — runAllNodes + Gerar Tudo

### Algoritmo (Kahn's topological sort)
```tsx
// Em useCanvas.ts
const runAllNodes = useCallback(async (
  onProgress?: (current: number, total: number) => void
) => {
  if (!data) return

  // 1. Montar grafo de adjacências
  const inDegree = new Map<string, number>()
  const adj      = new Map<string, string[]>()
  data.nodes.forEach(n => { inDegree.set(n.id, 0); adj.set(n.id, []) })
  data.edges.forEach(e => {
    adj.get(e.source_node_id)?.push(e.target_node_id)
    inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) ?? 0) + 1)
  })

  // 2. Kahn's BFS
  const queue  = data.nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0).map(n => n.id)
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

  // 3. Filtrar nós copy (sem geração) e nós já completos
  const toGenerate = order.filter(id => {
    const n = data.nodes.find(x => x.id === id)
    if (!n || n.type === 'copy') return false
    return (n.canvas_node_outputs?.length ?? 0) === 0
  })

  // 4. Gerar em sequência
  for (let i = 0; i < toGenerate.length; i++) {
    onProgress?.(i + 1, toGenerate.length)
    await generateNode(toGenerate[i])
    // Aguardar polling indicar 'done'
    await waitForNode(toGenerate[i])
  }
  onProgress?.(toGenerate.length, toGenerate.length)
}, [data, generateNode])

// Helper: poll até done ou error
const waitForNode = useCallback(async (nodeId: string) => {
  return new Promise<void>(resolve => {
    const interval = setInterval(async () => {
      const res  = await fetch(`/api/canvas/${data?.canvas.id}`)
      const json = await res.json() as CanvasData
      const n    = json.nodes.find(x => x.id === nodeId)
      if (n?.generation_status === 'done' || n?.generation_status === 'error') {
        clearInterval(interval)
        setData(json)
        resolve()
      }
    }, 3000)
  })
}, [data?.canvas.id])
```

### UI em CriativosTab
```tsx
const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null)

const handleRunAll = async () => {
  await runAllNodes((current, total) => setRunAllProgress({ current, total }))
  setRunAllProgress(null)
}
```

Botão na toolbar:
```tsx
<button onClick={handleRunAll} disabled={!!runAllProgress} className="...">
  {runAllProgress
    ? `Gerando ${runAllProgress.current} de ${runAllProgress.total}…`
    : '⚡ Gerar tudo'}
</button>
```

---

## Etapa 7 — VideoNode melhorado

### Mudanças
1. Preview do frame de entrada quando não há vídeo gerado:
   - Buscar output ativo do source node do tipo `frame`
   - Exibir como fundo semitransparente no placeholder
2. Download do vídeo gerado (mesmo padrão do handleDownload de imagem)
3. Badge do frame conectado: "Frame 1" baseado em `config.scene_index`
4. Botão "⚡ Gerar vídeo" movido para NodeInspector (ou mantido no card)

---

## Etapa 8 — Node options menu

### Componente
Menu `⋮` no header de cada node.

```tsx
// Adicionado em todos os nodes
const [menuOpen, setMenuOpen] = useState(false)

// Header
<button onClick={() => setMenuOpen(o => !o)} className="ml-auto w-5 h-5 ...">
  <MoreHorizontal size={11} />
</button>
{menuOpen && (
  <div className="absolute top-7 right-2 z-30 bg-surface-container border border-white/10 rounded-lg shadow-xl overflow-hidden">
    <button onClick={() => data.onGenerate(node.id)} className="...">
      ⚡ Regenerar
    </button>
    {isDeletable && (
      <button onClick={() => data.onDeleteNode(node.id)} className="... text-status-failed-text">
        🗑 Deletar
      </button>
    )}
  </div>
)}
```

### isDeletable
Nós deletáveis: `adicional`, `frame` com `scene_index > (sceneCount)`, `video` extra.
Por simplicidade v2: deletável = todo nó exceto `copy`, `personagem`, `cenario`, `produto`.

---

## Checklist de validação final

- [ ] NodeInspector abre/fecha ao selecionar/deselecionar nó
- [ ] Prompt editado no Inspector → reflete no node ao re-fetch
- [ ] ImageNode carousel navega entre outputs com dots
- [ ] Click na imagem → Lightbox abre fullscreen
- [ ] Lightbox fecha com ESC e click fora
- [ ] Download de imagem funciona
- [ ] CopyNode exibe copy completa no modal
- [ ] Right-click no canvas → context menu aparece na posição certa
- [ ] Adicionar nó via context menu → nó criado com config default
- [ ] Handles têm cores corretas por tipo
- [ ] isValidConnection bloqueia conexões inválidas
- [ ] "Gerar tudo" roda nós em ordem topológica
- [ ] "Gerar tudo" pula nós já gerados
- [ ] Progresso exibido durante run all
- [ ] VideoNode mostra preview do frame conectado no placeholder
- [ ] Menu ⋮ aparece em todos os nós
- [ ] Deletar nó via menu ⋮ remove do canvas e banco

---

## Tokens de design a usar

```
bg-surface-container    #201F20
bg-surface-high         #2A2829
bg-surface-highest      #353436
text-on-surface         #E8E3DD
text-on-surface-variant #9E9489
text-on-surface-muted   #6B6460
border-white/5          rgba(255,255,255,0.05)
border-white/10         rgba(255,255,255,0.10)
text-brand              #F28705
bg-brand                #F28705
```

## Cores de handle (fora do sistema Tailwind — inline style)
```
copy   source: #F59E0B
image  source: #22C55E
image  target: #22C55E
video  target: #8B5CF6
```
