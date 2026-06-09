# TAREFAS — AdCraft v3

Registro de pendências, atividades realizadas e estado de desenvolvimento da plataforma.
Atualizar a cada sessão de trabalho.

---

## Legenda
- `⬜ PENDENTE` — não iniciado
- `🔄 EM ANDAMENTO` — em progresso
- `✅ CONCLUÍDO` — finalizado

---

## Pendências ativas

### Geração de Vídeo
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| V-01 | Melhorias no processo de geração de vídeo | ⬜ PENDENTE | Fluxo atual: setup-persona → generate-scenes → compose-final. Scripts implementados, faltam API keys (Replicate, HeyGen, Kling, ElevenLabs) e pasta `assets/music/`. Ver diagnóstico completo em `scripts/video/`. |

### Frontend
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| F-01 | `products/page.tsx` — substituir `style={{}}` por Tailwind | ⬜ PENDENTE | Roadmap item #13 |
| F-02 | `products/[sku]/page.tsx` — substituir `style={{}}` por Tailwind | ⬜ PENDENTE | Roadmap item #14 |
| F-03 | `lib/constants.ts` — extrair constantes hoje hardcoded | ⬜ PENDENTE | Roadmap item #1 |
| F-04 | `useNotifications` — extrair de `NotificationBell.tsx` | ⬜ PENDENTE | Roadmap item #5 |
| F-05 | FilterBar reutilizável — aplicar em /products, /demandas, /campanhas, /insights | ⬜ PENDENTE | Roadmap item #15 |
| F-06 | Empty states com CTA em todas as listagens | ⬜ PENDENTE | Roadmap item #16 |
| F-07 | Skeleton loaders padronizados | ⬜ PENDENTE | Roadmap item #17 |
| F-08 | Logs WebSocket em tempo real na tela Demandas | ⬜ PENDENTE | Tela Demandas a 80% |
| F-09 | Diff de copy e score de viabilidade na tela Produto | ⬜ PENDENTE | Tela Produto a 70% |

### Arquitetura
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| A-01 | Decidir e migrar estrutura de projeto: monorepo pnpm workspaces + Turborepo vs 2 repos | ⬜ PENDENTE | Ver análise na conversa de 2026-06-01. Recomendação: monorepo com `packages/db` compartilhado entre `apps/web` e `apps/workers`. Swagger fica em espera até ter endpoints proprietários para terceiros. |

### Qualidade e Testes
| # | Tarefa | Status | Observações |
|---|--------|--------|-------------|
| Q-01 | Testes E2E com Playwright | ⬜ PENDENTE | Polish + testes a 0% |
| Q-02 | Keyboard shortcuts | ⬜ PENDENTE | |

---

## Atividades realizadas

### 2026-06-01
- Diagnóstico completo do estado da plataforma para o MVP
- Identificadas as 4 dependências externas para geração de vídeo funcionar: `REPLICATE_API_TOKEN`, `HEYGEN_API_KEY`, `KLING_API_KEY`, `ELEVENLABS_API_KEY`
- Pendência V-01 registrada: melhorias no processo de geração de vídeo

### 2026-05-30 (aprox.)
- `feat(video): video workflow v1` — commit base do workflow de vídeo
- `feat(video): Sprint 1 — fundação UGC e coleta TikTok`
- `feat(video): Sprint 2 — setup visual/vocal da persona`
- `feat(video): finaliza plano de geração — corrige 3 lacunas funcionais`
- Skills criados: `persona-visual-generator.md`, `scene-generator.md`, `video-compositor.md`
- Scripts implementados: `setup-persona.ts` (~431 linhas), `generate-scenes.ts` (~658 linhas), `compose-final.ts` (~652 linhas), `process-video-queue.ts`, `scrape-ugc.ts`
- Migration `v2/0013_video_generation_tables.sql` — tabelas `persona_assets`, `tiktok_videos`, `final_videos`

### 2026-05-24 (aprox.)
- Pipeline Ultron 100% implementado — 18 agent skills + DAG + DB bridge scripts
- Tela Demandas: 80% (lista + detalhe com timeline)
- Tela Produto: 70% (6 sub-abas funcionais)
- Memória cumulativa: 90% (extrator + aggregator + busca vetorial)

### Anteriores
- `fix(products)`: scroll + thumbnail 200px fixo
- `refactor(products)`: cards quadrados 1:1 com 4 por fileira
- `feat(products)`: scraping automático de logo via og:image
- `feat(products)`: exibir logo/foto do produto nos cards da listagem
- `feat(video-tab)`: split Storyboard/Criativos por video_url + player com storyboard colapsável
- Sidebar.tsx: hex → tokens, overflow → ScrollArea Shadcn ✅
- StatusBadge migrado para CSS vars de status ✅
- MetricCard migrado para classes Tailwind semânticas ✅
- useConversations extraído (paginação infinita + ScrollArea) ✅
- useTasks extraído de demandas/page.tsx ✅
- useProducts extraído de products/page.tsx ✅
- useCopyBoard extraído de CopyComponentBoard.tsx ✅
- MessageList.tsx — react-markdown + MermaidBlock ✅
- PlanPreviewCard.tsx — tokens semânticos + StatusBadge ✅
