# TAREFAS — AdCraft v3

## Legenda
- `⬜ PENDENTE` — não iniciado
- `🔄 EM ANDAMENTO` — em progresso
- `✅ CONCLUÍDO` — finalizado

---

## Pendências ativas

### Frontend
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| F-05 | Popular cards do dashboard com dados reais | ⬜ PENDENTE | Definir métricas relevantes para cada card (receita estimada, taxa de aprovação de copy, ROI de criativos) e ajustar `/api/dashboard` |
| F-09 | Memory Graph — melhorias v2 | ⬜ PENDENTE | Ver [`docs/memory-graph-melhorias.md`](docs/memory-graph-melhorias.md). Prioridade alta: highlight de vizinhos, painel lateral ao clicar, nó de produto |
| F-06 | FilterBar reutilizável | ⬜ PENDENTE | Componente genérico de filtro por pills — aplicar em `/products`, `/creatives`, `/insights` e qualquer listagem futura |
| F-07 | Empty states com CTA em todas as listagens | ⬜ PENDENTE | Telas sem dados devem ter ilustração + botão de ação (ex: "Cadastrar produto", "Rodar pipeline") |
| F-08 | Skeleton loaders padronizados | ⬜ PENDENTE | Substituir spinners soltos por skeletons consistentes em todas as listagens e tabs de produto |

### Arquitetura
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| A-01 | Refatoração geral — limpeza e organização | ✅ CONCLUÍDO | 5 itens corrigidos: código morto em `app/page.tsx` (-300 linhas), `KANBAN_COLS` removido, `COUNTRIES` movido para `constants.ts`, rota morta `/demandas/` em `MercadoTab` corrigida, shortcuts mortos (`⌘/`, `g d`) removidos de `useKeyboardShortcuts` |
| A-02 | Embeddings sem Gemini | ⬜ PENDENTE | Anthropic não tem API de embedding. Opções: Voyage AI (`voyage-3-lite`, 50M tokens/mês grátis, nova chave `VOYAGE_API_KEY`) ou fallback para PostgreSQL full-text search (índices GIN já existem). Sem isso, busca semântica nos learnings retorna vazio |

### Investigação
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| I-02 | Pesquisar pipeline de vídeo com IA — barata e com qualidade | ⬜ PENDENTE | Avaliar alternativas ao stack atual (Replicate/HeyGen/Kling/ElevenLabs) |

### Vídeo
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| V-01 | Criar um vídeo completo do início ao fim | ⬜ PENDENTE | Depende de I-02 — escolher a pipeline antes de executar |

---

## Histórico
### 2026-06-15 (continuação)
- A-01 concluído: refatoração de limpeza e organização
  - `app/page.tsx`: 300 linhas de chat morto removidas (export padrão apenas fazia redirect)
  - `lib/constants.ts`: `KANBAN_COLS` removido (demandas deletado); `COUNTRIES` adicionado
  - `ProductDetailHeader.tsx`: `COUNTRIES` migrado para `@/lib/constants`
  - `MercadoTab.tsx`: redirect `/demandas/{id}` corrigido → `/products/{sku}`; catch sem navegação fantasma
  - `useKeyboardShortcuts.ts`: shortcuts mortos `⌘/` (Jarvis) e `g d` (Demandas) removidos; `g h` → Dashboard adicionado

### 2026-06-16 (continuação)
- F-03 concluído: Memory Graph v1 implementado na aba Grafo de `/insights`
  - D3 v7 com force-directed layout, zoom/pan, drag, tooltip
  - `transpilePackages` adicionado ao `next.config.mjs` para ESM do D3
  - Carregamento lazy via `next/dynamic` (ssr: false)
  - F-09 criado no backlog com doc de melhorias em `docs/memory-graph-melhorias.md`

### 2026-06-16
- I-01 concluído: módulo de memória funcionando end-to-end no frontend (`/insights`)
  - RLS corrigido: GRANT SELECT/UPDATE para role `anon` nas tabelas de memória
  - Scroll e centralização corrigidos na aba Learnings
  - 8 learnings + 4 padrões + 3 insights do pipeline BWNP (CitrusBurn v2) populados manualmente
- Extractor e aggregator migrados de Gemini Flash → Claude Haiku (`callTextClaude`)
  - Próximos full discoveries geram learnings automaticamente via Anthropic API
  - Único dependente restante do Gemini: worker de embeddings (vetores 768d) → ver A-02

### 2026-06-15
- Backlog anterior arquivado. Novo ciclo iniciado.
- Modo PM configurado no CLAUDE.md — João fala em formato livre, Claude organiza e mantém TAREFAS.md.
- F-01 concluído: dashboard como página home com KPIs, atividade recente, logo SVG, sidebar atualizada.
- F-02 e F-04 concluídos: páginas `/feed-anuncios` e `/demandas` removidas do app. Backup em `frontend/_backup/`.
