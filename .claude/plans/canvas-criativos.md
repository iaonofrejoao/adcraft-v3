# Plano: Canvas "Criativos" — Visual Node Pipeline

**Status:** Aprovado — aguardando implementação  
**Data:** 2026-06-23  
**Escopo:** Substituir abas "Personagens" e "Vídeo" por aba "Criativos" com canvas visual de nós para geração de imagens e vídeos.

---

## Contexto

O pipeline de agentes (pesquisa → copy → storyboard) continua rodando no automático via Claude.  
O canvas entra **depois** dos keyframes gerados — é a interface para geração de imagens (Nano Banana) e vídeos (Veo 3) por copy combination.

**APIs de geração:**
- Imagens → Nano Banana (Gemini Image Generation)
- Vídeos → Veo 3 via Vertex AI (já integrado)
- Storage → Google Drive (`AdCraft/{sku}/{copy_combination_id}/{tipo}/`)
- Visualização → proxy `/api/drive-image` (já existe)

---

## Estrutura do Canvas

### Layout default por copy combination

```
[Copy]──→[Personagem]──→[Frame Cena 1]──→[Vídeo Cena 1]
         [Cenário   ]──→[Frame Cena 2]──→[Vídeo Cena 2]
         [Produto   ]──→[Frame Cena N]──→[Vídeo Cena N]
```

- 1 nó Copy (texto estático — hook+body+CTA)
- 1 nó Personagem (imagem — prompt do personas_prompt dos keyframes)
- 1 nó Cenário (imagem — prompt de cenário)
- 1 nó Produto (imagem — prompt do produto)
- N nós Frame (1 por cena, com veo3_prompt_en dos keyframes)
- N nós Vídeo (1:1 com os Frame nodes)
- Nó "Imagem Adicional" criado manualmente pelo usuário quando precisar

### Tipos de nó
| Tipo | API | Pasta Drive |
|------|-----|-------------|
| copy | — | — |
| personagem | Nano Banana | personagens/ |
| cenario | Nano Banana | cenarios/ |
| produto | Nano Banana | produto/ |
| adicional | Nano Banana | adicional/ |
| frame | Nano Banana | frames/ |
| video | Veo 3 | videos/ |

### Regras de conexão
- Qualquer nó pode conectar a qualquer nó
- Nó vídeo recebendo input de nó **frame** → trata como primeiro frame a animar (image-to-video)
- Nó vídeo recebendo input de **qualquer outro tipo** → trata como referência visual no prompt

### Comportamento dos outputs
- Geração: manual, nó a nó
- Múltiplas saídas por nó (x1, x2, x3...)
- Outputs: seleção ativo/inativo (apenas outputs ativos passam para o próximo nó)
- Delete individual de outputs indesejados
- Estado "gerando...": polling a cada 3s — para quando nenhum nó estiver `generation_status = 'generating'`

---

## PRÉ-CONDIÇÕES CRÍTICAS (bloqueantes)

> Estes pontos causam quebra garantida se ignorados.

1. **`@xyflow/react` precisa de `ssr: false`** — usar `dynamic(() => import('./CanvasBoard'), { ssr: false })`. NÃO adicionar em `transpilePackages` (não é ESM puro como D3).

2. **Layout do `/criativos/page.tsx` precisa ser refatorado** — ReactFlow exige container com altura explícita. Estrutura atual (`ScrollArea + section max-w-5xl`) resulta em canvas com 0px de altura. Nova estrutura:
   ```
   div flex flex-col h-full overflow-hidden
     ProductDetailHeader (shrink-0)
     div flex-1 overflow-hidden min-h-0
       CriativosTab
   ```

3. **Nano Banana e Veo 3 são scripts CLI** — têm `dotenv.config()` e `parseArgs` no topo. Precisam ser extraídos para libs puras em `workers/lib/canvas/` antes de serem chamados de API routes.

4. **`nano-banana-client.ts` só exporta `generateCharacterBoard`** — função privada `generateOneImage` precisa ser exposta como `generateImage(prompt, options)` genérica.

5. **TABS em `ProductDetailHeader.tsx` linha 116** — `Personagens` e `Vídeo` precisam ser removidos, `Criativos` adicionado apontando para `/products/${sku}/criativos`.

---

## Fase 1 — Banco de dados

**Arquivo:** `migrations/v2/0018_creative_canvas.sql`

```sql
CREATE TABLE creative_canvases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id),
  copy_combination_id uuid NOT NULL REFERENCES copy_combinations(id) UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE canvas_nodes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id         uuid NOT NULL REFERENCES creative_canvases(id) ON DELETE CASCADE,
  type              text NOT NULL,   -- 'copy'|'personagem'|'cenario'|'produto'|'adicional'|'frame'|'video'
  label             text,
  position_x        float NOT NULL DEFAULT 0,
  position_y        float NOT NULL DEFAULT 0,
  prompt            text,
  config            jsonb DEFAULT '{}',  -- { count, aspect_ratio, model, scene_index? }
  generation_status text DEFAULT 'idle', -- 'idle'|'generating'|'done'|'error'
  error_message     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE canvas_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id      uuid NOT NULL REFERENCES creative_canvases(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE canvas_node_outputs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  output_type   text NOT NULL,  -- 'image'|'video'
  drive_file_id text,
  drive_url     text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
```

**Schema Drizzle:** adicionar as 4 tabelas em `frontend/lib/schema/index.ts`.

---

## Fase 2 — Extração de bibliotecas

Criar `workers/lib/canvas/` com módulos puros (sem dotenv, sem parseArgs, sem referências a CLI):

### `workers/lib/canvas/image-gen.ts`
Extraído de `scripts/video/nano-banana-client.ts`:
- `generateImage(prompt: string, options: { count: number; aspectRatio: string }): Promise<Buffer[]>` ← **nova exportação genérica**
- `generateCharacterBoard(prompt, options)` mantida para compatibilidade

### `workers/lib/canvas/video-gen.ts`
Extraído de `scripts/video/veo3-client.ts`:
- `generateVideo(prompt: string, options: { duration: number; aspectRatio: string; firstFrameBuffer?: Buffer }): Promise<Buffer>`

### `workers/lib/canvas/drive-upload.ts`
Extraído de `scripts/video/google-drive.ts`:
- `findOrCreateFolder(name: string, parentId?: string): Promise<string>` ← **nova função — Drive não cria pastas intermediárias automaticamente**
- `uploadFile(buffer: Buffer, filename: string, mimeType: string, folderId: string): Promise<{ fileId: string; driveUrl: string }>`
- `uploadToCanvasFolder(buffer, filename, mimeType, sku, combinationId, nodeType): Promise<{ fileId, driveUrl }>` — wrapper que monta a hierarquia `AdCraft/{sku}/{combinationId}/{tipo}/`

---

## Fase 3 — API Routes

Todas em `frontend/app/api/` com Node.js runtime (não Edge — precisam dos workers/lib):

```
GET  /api/products/[sku]/combinations              ← NOVO: lista copy_combinations do produto
GET  /api/products/[sku]/canvas                    lista canvases (uma por combinação)
POST /api/products/[sku]/canvas                    cria + inicializa canvas (lê keyframes)
GET  /api/canvas/[canvasId]                        canvas completo (nodes + edges + outputs)
PATCH /api/canvas/nodes/[nodeId]                   atualiza prompt | config | posição
POST  /api/canvas/nodes                            cria nó avulso
DELETE /api/canvas/nodes/[nodeId]                  remove nó e outputs (cascata no DB)
POST  /api/canvas/edges                            cria conexão
DELETE /api/canvas/edges/[edgeId]                  remove conexão
POST  /api/canvas/nodes/[nodeId]/generate          dispara geração — tipo derivado de node.type
PATCH /api/canvas/outputs/[outputId]               { is_active: bool }
DELETE /api/canvas/outputs/[outputId]              remove output + arquivo do Drive
```

### Lógica de inicialização (`POST /api/products/[sku]/canvas`)
1. Recebe `copy_combination_id` no body
2. Lê hook+body+CTA da `copy_combinations`
3. Lê artefato `keyframes` de `product_knowledge` onde `copy_combination_id = ?` e `artifact_type = 'keyframes'`
4. **Se keyframes não encontrado → retorna `{ status: 'no_storyboard' }`** — frontend exibe empty state
5. Cria nós com posições pré-calculadas:
   ```
   Copy       x:0    y:0
   Personagem x:360  y:0
   Cenário    x:360  y:220
   Produto    x:360  y:440
   Frame 1    x:720  y:0      (scene_index:1, prompt: keyframes[0].veo3_prompt_en)
   Frame 2    x:720  y:220    (scene_index:2)
   ...
   Vídeo 1    x:1080 y:0
   Vídeo 2    x:1080 y:220
   ...
   ```
6. Cria edges: Copy→Personagem, Copy→Cenário, Copy→Produto, Personagem→Frame N (todos), Cenário→Frame N (todos), Frame N→Vídeo N (1:1)

### Lógica de geração (`POST /api/canvas/nodes/[nodeId]/generate`)
1. Lê `node.type` para decidir API
2. Lê edges `target_node_id = nodeId` → busca outputs ativos dos nós source
3. Para vídeo: se source é tipo `frame` → `firstFrameBuffer` do output ativo; senão → referência no prompt
4. Seta `generation_status = 'generating'`
5. Chama lib de geração, faz upload no Drive
6. Cria `canvas_node_outputs`, seta `generation_status = 'done'`
7. Em erro: seta `generation_status = 'error'` com `error_message`

---

## Fase 4 — Hook de dados

**`frontend/hooks/useCanvas.ts`**

Responsabilidades:
- `GET /api/canvas/[canvasId]` na montagem
- Polling a cada 3s quando qualquer nó tem `generation_status = 'generating'` — para automaticamente quando não há mais nós gerando
- Mutações tipadas: `updateNode`, `createNode`, `deleteNode`, `createEdge`, `deleteEdge`, `generateNode`, `toggleOutput`, `deleteOutput`
- **`saveNodePosition(id, x, y)`** — chamado APENAS em `onNodeDragStop`, nunca em `onNodesChange`

---

## Fase 5 — Frontend

### 5a. Instalar dependência
```bash
# dentro de frontend/
pnpm add @xyflow/react
# NÃO adicionar em transpilePackages no next.config.mjs
```

### 5b. Refatorar `/criativos/page.tsx` (obrigatório antes do canvas)

```tsx
// Estrutura nova — sem ScrollArea, sem max-w, sem padding
export default function CriativosPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      <ProductDetailHeader product={product} sku={sku} />
      <div className="flex-1 overflow-hidden min-h-0">
        <CriativosTab sku={sku} productId={product.id} />
      </div>
    </div>
  )
}
```

### 5c. Componentes

**`frontend/components/canvas/CanvasBoard.tsx`**
- Importado via `dynamic(() => import('./CanvasBoard'), { ssr: false })` — obrigatório
- `nodeTypes` registra CopyNode, ImageNode, VideoNode
- `onNodeDragStop` → `saveNodePosition(id, x, y)` — nunca `onNodesChange` para posições
- Edges com `animated: true` em nós com `generation_status = 'generating'`
- Botão flutuante `+ Imagem Adicional` no canto inferior esquerdo

**`frontend/components/canvas/nodes/CopyNode.tsx`**
- Exibe hook / body / CTA da combinação
- Read-only — sem botão de gerar
- Handle de saída à direita

**`frontend/components/canvas/nodes/ImageNode.tsx`** (personagem / cenário / produto / adicional / frame)
- Preview da imagem gerada ou placeholder com ícone + prompt truncado
- Bottom bar: `− x1 +` | dropdown aspect ratio | dropdown model | botão gerar
- Estado `generating`: spinner + label "Gerando..."
- Outputs em grid: borda brand (ativo) ou surface-highest (inativo) + botão × para deletar
- Handles: entrada esquerda, saída direita
- Label no topo identifica tipo e scene_index se aplicável

**`frontend/components/canvas/nodes/VideoNode.tsx`**
- Preview `<video>` via `/api/drive-image?url=...` (range requests já suportados)
- Badge de tipo de conexão: "Animar frame" ou "Referência"
- Handle de entrada esquerda
- Bottom bar sem aspect ratio (herdado do input)

**`frontend/components/canvas/CombinationSelector.tsx`**
- Dropdown listando `copy_combinations` (hook truncado como label)
- Badge de status por combinação: "N/M cenas prontas" | "Sem storyboard" | "Pendente"
- Botão "Criar canvas" quando combinação não tem canvas

**`frontend/components/produto-tabs/CriativosTab.tsx`** — rewrite completo
- Estados: `loading` | `no_combinations` | `no_storyboard` | `canvas`
- `no_storyboard` empty state: "Storyboard não gerado — execute Script Writer e Keyframe Generator para esta combinação"
- Sem ScrollArea — o CanvasBoard ocupa `h-full`

---

## Fase 6 — Limpeza

### Arquivos a deletar
- `frontend/hooks/useFinalVideos.ts` — órfão após rewrite do CriativosTab
- `frontend/components/produto-tabs/PersonagensTab.tsx` — órfão após redirect
- `frontend/components/produto-tabs/VideoTab.tsx` — órfão após redirect

### Arquivos a substituir por redirect
- `frontend/app/products/[sku]/personagens/page.tsx` → `redirect(\`/products/${sku}/criativos\`)`
- `frontend/app/products/[sku]/video/page.tsx` → `redirect(\`/products/${sku}/criativos\`)`

### `frontend/components/detalhes-produto/ProductDetailHeader.tsx`
Linha 116 — array `TABS`: remover `Personagens` e `Vídeo`, adicionar:
```ts
{ label: 'Criativos', href: (sku: string) => `/products/${sku}/criativos` },
```
Na posição entre `Copy` e `Anúncios FB`.

---

## Ordem de execução

| # | Tarefa | Arquivo(s) |
|---|--------|-----------|
| 1 | Migration SQL | `migrations/v2/0018_creative_canvas.sql` |
| 2 | Schema Drizzle | `frontend/lib/schema/index.ts` |
| 3 | Lib image-gen (extração Nano Banana) | `workers/lib/canvas/image-gen.ts` |
| 4 | Lib video-gen (extração Veo 3) | `workers/lib/canvas/video-gen.ts` |
| 5 | Lib drive-upload (extração Drive + findOrCreateFolder) | `workers/lib/canvas/drive-upload.ts` |
| 6 | API combinations | `frontend/app/api/products/[sku]/combinations/route.ts` |
| 7 | API routes CRUD canvas/nodes/edges | `frontend/app/api/canvas/` |
| 8 | API route de geração | `frontend/app/api/canvas/nodes/[nodeId]/generate/route.ts` |
| 9 | API routes outputs | `frontend/app/api/canvas/outputs/[outputId]/route.ts` |
| 10 | Hook useCanvas | `frontend/hooks/useCanvas.ts` |
| 11 | pnpm add @xyflow/react | `frontend/package.json` |
| 12 | Nós customizados (Copy, Image, Video) | `frontend/components/canvas/nodes/` |
| 13 | CanvasBoard (dynamic ssr:false) | `frontend/components/canvas/CanvasBoard.tsx` |
| 14 | CombinationSelector | `frontend/components/canvas/CombinationSelector.tsx` |
| 15 | Rewrite CriativosTab | `frontend/components/produto-tabs/CriativosTab.tsx` |
| 16 | Refatorar layout /criativos/page.tsx | `frontend/app/products/[sku]/criativos/page.tsx` |
| 17 | Atualizar TABS no header | `frontend/components/detalhes-produto/ProductDetailHeader.tsx` |
| 18 | Redirects personagens + video | pages a substituir |
| 19 | Deletar arquivos órfãos | useFinalVideos, PersonagensTab, VideoTab |
