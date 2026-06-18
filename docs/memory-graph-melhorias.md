# Memory Graph — Melhorias planejadas

Documento de referência para a tarefa **F-09** do backlog.
Gerado em 2026-06-15 após entrega da v1 do grafo (`/insights` → aba Grafo).

---

## Estado atual (v1)

- Force-directed graph com D3 v7
- Nós: hub central → categorias → patterns + learnings + insights
- Interações: zoom/pan, drag de nós, tooltip ao hover
- Carregamento lazy via `next/dynamic` (ssr: false)
- Dados reais do banco via `useInsights` (learnings, patterns, insights)

---

## Melhorias por prioridade

### Prioridade alta — transformam o grafo de decorativo em ferramenta

#### 1. Highlight de vizinhos no hover
Ao fazer hover num nó, escurecer todos os nós e arestas que **não** são diretamente conectados a ele.
Hoje o grafo inteiro fica visível ao mesmo tempo, o que dificulta a leitura em grafos densos.

**Implementação:**
```ts
// no mouseover do nó
const connectedIds = new Set<string>()
connectedIds.add(d.id)
simLinks.forEach(l => {
  if (l.source.id === d.id) connectedIds.add(l.target.id)
  if (l.target.id === d.id) connectedIds.add(l.source.id)
})
nodeEls.attr('opacity', n => connectedIds.has(n.id) ? 1 : 0.08)
linkEls.attr('opacity', l => connectedIds.has(l.source.id) && connectedIds.has(l.target.id) ? 0.8 : 0.04)
// no mouseout: restaurar opacidade original
```

---

#### 2. Painel lateral ao clicar num nó
Clicar num nó fixa-o (pin) e abre um `<aside>` deslizante à direita com:
- Texto completo da observação/pattern/insight
- Metadados: confiança, categoria, data, `product_id`
- JSON da evidence (para learnings) em bloco expandível
- Botões de validar/invalidar sem sair da view

**Implementação sugerida:**
- Estado `selectedNode: GNode | null` em `useState`
- `aside` posicionado absolutamente à direita dentro do container do grafo
- Fechar ao clicar no fundo do SVG ou em `×`

---

#### 3. Nó de produto como intermediário
Cada learning tem `product_id`. Adicionar produtos como nós entre categoria e learning:

```
hub → categoria → produto → learning
```

Isso revela de qual produto cada padrão se originou — essencial para entender se um insight é universal ou específico de um SKU.

**Dados necessários:**
```ts
// buscar nomes dos produtos pelos IDs únicos presentes nos learnings
const productIds = [...new Set(learnings.map(l => l.product_id).filter(Boolean))]
const { data: products } = await supabase.from('products').select('id, name').in('id', productIds)
```

---

### Prioridade média — melhoram usabilidade

#### 4. Filtro por categoria refletindo no grafo
Os pills de categoria já existem na página. Passar `categoryFilter` como prop para `MemoryGraph`
e esconder/mostrar clusters quando um filtro é ativado (animação de fade com `transition`).

#### 5. Busca com highlight
Campo de texto dentro do grafo que:
- Ilumina nós cujo label/description contém o termo
- Escurece o restante (mesmo comportamento do highlight de vizinhos)
- Mostra contador "3 de 47 nós"

#### 6. Botão "centralizar"
Ícone `⌖` (ou `Maximize2` do Lucide) no canto superior direito que faz:
```ts
svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity)
```

#### 7. Nó pulsando para conteúdo recente
Learnings e patterns com `created_at` < 7 dias recebem um anel externo com animação CSS `ping`
(semelhante ao `.animate-ping` do Tailwind) para sinalizar atividade recente na memória.

---

### Prioridade baixa — polish e features avançadas

#### 8. Borda de validação
- Nós validados (`validated_by_user = true`): borda branca sólida
- Nós inválidos (`validated_by_user = false`): borda vermelha pontilhada + opacidade reduzida

#### 9. Arestas entre learnings similares (clustering semântico)
Usar `scripts/search/vector.ts` para encontrar pares de learnings com similaridade coseno > 0.85
e desenhar arestas fracas (traço pontilhado, baixa opacidade) entre eles.

Isso revela **clusters semânticos** invisíveis na estrutura hierárquica atual — learnings de
categorias diferentes que falam do mesmo tema aparecerão agrupados naturalmente.

**Custo:** 1 chamada ao vector store por learning. Fazer uma vez e cachear no estado.

#### 10. Timeline slider
Scrubbar no tempo para visualizar como a memória cresceu:
- Slider de data no rodapé
- Nós com `created_at` > data selecionada ficam invisíveis
- Animação dos nós "entrando" conforme o slider avança

#### 11. Canvas em vez de SVG
Para > 200 nós o SVG fica lento (repaint de cada elemento individualmente).
Migrar para `d3-canvas` ou `WebGL` (via `sigma.js`) resolve o problema de performance.
**Fazer apenas se o grafo crescer além de ~150 nós.**

#### 12. Exportar como PNG
```ts
// serializar SVG → canvas → toDataURL
const svgData = new XMLSerializer().serializeToString(svgRef.current)
// ... drawImage no canvas → link.download = 'memory-graph.png'
```

---

## Arquivos relevantes

| Arquivo | Papel |
|---------|-------|
| `frontend/components/insights/MemoryGraph.tsx` | Componente D3 — toda a lógica do grafo |
| `frontend/app/insights/page.tsx` | Página de memória — monta a aba Grafo |
| `frontend/hooks/useInsights.ts` | Hook de dados — learnings, patterns, insights |
| `frontend/next.config.mjs` | `transpilePackages` com todos os sub-pacotes d3 |
| `docs/memory-graph.html` | Versão standalone do grafo (memórias Claude) |

---

## Ordem de implementação sugerida

1. Highlight de vizinhos (30 min — só D3, sem novos componentes)
2. Painel lateral ao clicar (2h — novo `<aside>` + estado)
3. Nó de produto (1h — 1 query extra no hook ou prop adicional)
4. Filtro por categoria no grafo (30 min — prop passada da página)
5. Busca com highlight (1h — input + lógica de filtro no D3)
6. Botão centralizar + pulsação de recentes (30 min)
7. Itens 8–12 conforme necessidade
