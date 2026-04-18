# CLAUDE.md — AdCraft v2

## Visão geral
AdCraft é uma plataforma de marketing com IA para criação de criativos e gestão de campanhas.
Stack: Next.js 14 App Router, Tailwind, TypeScript, Shadcn/ui, Supabase, Drizzle, workers Node.js.

## Contexto de desenvolvimento
- **Diretório:** `C:\dev\AdCraft v2`
- **GitHub:** https://github.com/iaonofrejoao/adcraft-v2 (privado)
- **Ritual de commit:** `git push` obrigatório após todo commit

## Skills obrigatórios
Antes de criar ou editar qualquer componente de UI, leia:
- `.claude/skills/frontend-adcraft.md`   → design system Kinetic Console
- `.claude/skills/stitch-to-adcraft.md`  → conversão de layouts Stitch

## Estrutura do projeto
- `frontend/`          → Next.js 14 App Router
- `workers/`           → agentes Node.js (tsx --watch, hot reload ativo)
- `workers/agents/`    → 7 agentes de IA (Gemini default; Claude disponível como opção)
- `workers/cron/`      → jobs periódicos (learning-aggregator-cron.ts)
- `db/`                → migrations SQL Supabase (V2 em migrations/v2/)
- `stitch/[tela]/`     → exports do Google Stitch (html, DESIGN.md, png)
- `.claude/skills/`    → skills do Claude Code

## Estado das Fases V2 (última atualização: 2026-04-16)

| Fase | Status | Resumo |
|------|--------|--------|
| A — Migração Claude | ↩️ revertido | Provider padrão revertido para Gemini (2.5-pro/flash); Claude mantido como opção |
| B — Jarvis tool use | ✅ 95% | 11 tools, loop 25 rounds, SSE, prompt cache. Faltam: write tools + confirmação modal |
| C — Tela Demandas | ✅ 80% | Lista + detalhe com timeline. Pendente: logs WebSocket em tempo real |
| D — Tela Produto | ✅ 70% | 6 sub-abas funcionais. Pendente: diff de copy, score de viabilidade |
| E — Memória cumulativa | ✅ 90% | Extrator + aggregator + 3 tools Jarvis. Pendente: validação busca vetorial |
| F — Polish + testes | ⬜ 0% | FilterBar, keyboard shortcuts, Playwright E2E, docs — não iniciado |

## Arquivos canônicos de referência

| Arquivo | Responsabilidade |
|---------|-----------------|
| `frontend/lib/agent-registry.ts` | AGENT_REGISTRY, JARVIS_MODEL, GoalName, budgets |
| `frontend/lib/jarvis/goals.ts` | Goals canônicos + comandos `/` (fonte única) |
| `frontend/lib/jarvis/tool-registry.ts` | 11 tools do Jarvis (definições + executores) |
| `frontend/lib/jarvis/claude-agent.ts` | Loop Jarvis via Claude (opção disponível; Gemini é default via chat/route.ts) |
| `frontend/lib/jarvis/jarvis-system-prompt.ts` | System prompt do Jarvis |
| `frontend/lib/jarvis/loadConversationHistory.ts` | Contexto multi-turn (últimas 50 msgs) |
| `frontend/lib/schema/index.ts` | Schema Drizzle ORM (todas as tabelas) |
| `frontend/components/MermaidBlock.tsx` | Renderizador Mermaid (lazy, SSR-safe) |
| `frontend/app/globals.css` | CSS vars (design tokens Kinetic Console) |
| `frontend/tailwind.config.ts` | Mapeamento CSS vars → classes Tailwind |
| `workers/task-runner.ts` | Polling loop principal dos workers |
| `workers/agents/learning-extractor.ts` | Extrator de learnings pós-pipeline (Fase E) |
| `workers/cron/learning-aggregator-cron.ts` | Aggregator diário de patterns (Fase E) |
| `workers/lib/embeddings/gemini-embeddings.ts` | Batch worker de embeddings (processa fila) |

## Infraestrutura do worker

- **Hot reload:** `tsx --watch` — worker recarrega automaticamente em dev
- **Version logging:** loga version/commit hash no startup
- **Reaper de tasks:** tasks em `running` por > 10min → marcadas `failed` automaticamente
- **Poll interval:** 5 segundos, `FOR UPDATE SKIP LOCKED` (evita race condition entre workers)
- **Retry:** max 3 tentativas; BudgetExceededError é não-retriable
- **Jarvis multi-turn:** últimas 50 mensagens carregadas como histórico (formato Gemini)
- **JARVIS_MODEL:** centralizado em `frontend/lib/agent-registry.ts` — nunca hardcodar (default: gemini-2.5-flash)
- **Provider padrão:** Gemini (2.5-pro para agentes críticos, 2.5-flash para secundários); Claude disponível via `claude-provider.ts`
- **Roteamento de modelo:** `gemini-client.ts::callAgent()` roteia para Claude automaticamente se model.startsWith('claude-')
- **Learning extractor:** dispara async pós-pipeline (não bloqueia o task-runner)
- **Aggregator cron:** agendar externamente → `node workers/dist/cron/learning-aggregator-cron.js`
- **Embeddings batch:** `batchEmbeddingsWorker()` em `workers/lib/embeddings/gemini-embeddings.ts`
  — suporta: `product_knowledge`, `niche_learnings`, `niches`, `execution_learnings`

## Regras de frontend

### CSS e estilo
- NUNCA usar `style={{}}` inline — sempre classes Tailwind
- NUNCA usar cores hex hardcoded em componentes
- SEMPRE referenciar tokens via classes mapeadas no `tailwind.config.ts`
- Separar seções por shift de background (Tonal Carving), nunca `border-b`

### Componentes
- Shadcn/ui em `components/ui/` → não modificar os arquivos gerados
- Componentes customizados em `components/[feature]/NomeComponente.tsx`
- Named exports + interface TypeScript explícita em todo componente
- `cn()` de `@/lib/utils` para classNames condicionais
- Ícones: Lucide React, `strokeWidth=1.5`, tamanho 16/18/20px

### Separação de responsabilidades
- Lógica de dados (fetch, Supabase, SSE) → sempre em hooks em `hooks/`
- Componentes de página → apenas composição de componentes e hooks
- Nunca fazer fetch diretamente dentro de um componente de UI
- Constantes de configuração → `lib/constants.ts`
- Goals canônicos → `lib/jarvis/goals.ts` (fonte única, nunca duplicar)

### Proibições absolutas
- NUNCA hardcodar `user_id` — usar contexto de auth
- NUNCA hardcodar listas (plataformas, goals, status) em componentes
- NUNCA misturar subscription Supabase Realtime dentro de componente de layout

## Roadmap de refatoração de código (pendências V1 → V2)

### Fase 1 — Fundação
1. ⬜ Criar `lib/constants.ts` com constantes hoje hardcoded
2. ✅ DONE — StatusBadge migrado para CSS vars de status do globals.css
3. ✅ DONE — MetricCard migrado para classes Tailwind semânticas

### Fase 2 — Extração de hooks
4. ✅ DONE — useConversations extraído (paginação infinita + ScrollArea)
5. ⬜ useNotifications de NotificationBell.tsx → `hooks/useNotifications.ts`
6. ✅ DONE — useTasks extraído de demandas/page.tsx
7. ✅ DONE — useProducts extraído de products/page.tsx
8. ✅ DONE — useCopyBoard extraído de CopyComponentBoard.tsx

### Fase 3 — Migração de estilos
9.  ✅ DONE — Sidebar.tsx (hex → tokens, overflow → ScrollArea Shadcn)
10. ✅ DONE — app/page.tsx (chat) — style={{}} → Tailwind
11. ✅ DONE — MessageList.tsx — react-markdown + MermaidBlock
12. ✅ DONE — PlanPreviewCard.tsx — tokens semânticos + StatusBadge
13. ⬜ products/page.tsx — style={{}} → Tailwind
14. ⬜ products/[sku]/page.tsx — style={{}} → Tailwind

### Fase 4 — Novas telas (Fase F do roadmap V2)
15. ⬜ FilterBar reutilizável — aplicar em /products, /demandas, /campanhas, /insights
16. ⬜ Keyboard shortcuts (? para help, Cmd+K para command palette, Cmd+/ foca Jarvis)
17. ⬜ Empty states com CTA em todas as listagens
18. ⬜ Skeleton loaders padronizados

## Como trabalhar
- Uma tarefa por vez — marcar DONE antes de iniciar a próxima
- Sempre rodar `pnpm dev` após cada alteração e confirmar build limpo
- Nunca refatorar estilo e lógica no mesmo commit
