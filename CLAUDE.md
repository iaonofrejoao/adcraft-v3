# CLAUDE.md — AdCraft v2

## Visão geral
AdCraft é uma plataforma de marketing com IA para criação de
criativos e gestão de campanhas. Stack: Next.js 14 App Router,
Tailwind, TypeScript, Shadcn/ui, Supabase, Drizzle, workers Node.js.

## Contexto de desenvolvimento
- **Diretório:** `C:\dev\AdCraft v2`
- **GitHub:** https://github.com/iaonofrejoao/adcraft-v2 (privado)
- **Ritual de commit:** `git push` obrigatório após todo commit

## Skills obrigatórios
Antes de criar ou editar qualquer componente de UI, leia:
- .claude/skills/frontend-adcraft.md   → design system Kinetic Console
- .claude/skills/stitch-to-adcraft.md  → conversão de layouts Stitch

## Estrutura do projeto
- frontend/          → Next.js 14 App Router
- workers/           → agentes Node.js (tsx --watch, hot reload ativo)
- db/                → schema Drizzle + migrations
- stitch/[tela]/     → exports do Google Stitch (html, DESIGN.md, png)
- .claude/skills/    → skills do Claude Code

## Regras de frontend

### CSS e estilo
- NUNCA usar style={{}} inline — sempre classes Tailwind
- NUNCA usar cores hex hardcoded em componentes
- SEMPRE referenciar tokens via classes mapeadas no tailwind.config.ts
- Separar seções por shift de background (Tonal Carving), nunca border-b

### Componentes
- Shadcn/ui em components/ui/ → não modificar os arquivos gerados
- Componentes customizados em components/[feature]/NomeComponente.tsx
- Named exports + interface TypeScript explícita em todo componente
- cn() de @/lib/utils para classNames condicionais
- Ícones: Lucide React, strokeWidth=1.5, tamanho 16/18/20px

### Separação de responsabilidades
- Lógica de dados (fetch, Supabase, SSE) → sempre em hooks em hooks/
- Componentes de página → apenas composição de componentes e hooks
- Nunca fazer fetch diretamente dentro de um componente de UI
- Constantes de configuração → lib/constants.ts
- Goals canônicos → lib/jarvis/goals.ts (fonte única, nunca duplicar)
- Histórico de conversa do Jarvis → lib/jarvis/loadConversationHistory.ts

### Proibições absolutas
- NUNCA hardcodar user_id — usar contexto de auth
- NUNCA hardcodar listas (plataformas, goals, status) em componentes
- NUNCA misturar subscription Supabase Realtime dentro de componente
  de layout (Sidebar, NotificationBell) — usar contexto ou hook global

## Infraestrutura do worker
- **Hot reload:** `tsx --watch` — worker recarrega automaticamente em dev
- **Version logging:** loga version/commit hash no startup
- **Reaper de tasks:** tasks em `running` por > 10min → marcadas `failed` automaticamente
- **SSE com retry:** 3 tentativas automáticas em caso de falha de rede
- **Jarvis multi-turn:** últimas 20 mensagens carregadas como histórico Gemini
- **JARVIS_MODEL:** centralizado em `frontend/lib/agent-registry.ts` — nunca hardcodar em outro lugar

## Arquivos canônicos de referência
| Arquivo | Responsabilidade |
|---|---|
| `frontend/lib/agent-registry.ts` | AGENT_REGISTRY, JARVIS_MODEL, GoalName, budgets |
| `frontend/lib/jarvis/goals.ts` | 5 goals + comandos `/` canônicos |
| `frontend/lib/jarvis/loadConversationHistory.ts` | Contexto multi-turn do Jarvis |
| `frontend/components/MermaidBlock.tsx` | Renderizador Mermaid (lazy, SSR-safe) |
| `frontend/app/globals.css` | CSS vars (design tokens) |
| `frontend/tailwind.config.ts` | Mapeamento CSS vars → classes Tailwind |

## Estado do roadmap de refatoração

### Fase 1 — Fundação
1. ⬜ Criar lib/constants.ts com constantes hoje hardcoded
2. ✅ DONE — StatusBadge migrado para CSS vars de status do globals.css
3. ✅ DONE — MetricCard migrado para classes Tailwind semânticas

### Fase 2 — Extração de hooks
4. ✅ DONE — useConversations extraído (com paginação infinita + ScrollArea)
5. ⬜ useNotifications de NotificationBell.tsx → hooks/useNotifications.ts
6. ✅ DONE — useTasks extraído de demandas/page.tsx
7. ✅ DONE — useProducts extraído de products/page.tsx
8. ✅ DONE — useCopyBoard extraído de CopyComponentBoard.tsx

### Fase 3 — Migração de estilos
9.  ✅ DONE — Sidebar.tsx (14 hex → tokens, overflow nativo → ScrollArea Shadcn)
10. ✅ DONE — app/page.tsx (chat) — style={{}} → classes Tailwind
11. ✅ DONE — MessageList.tsx — react-markdown + MermaidBlock (lazy, SSR-safe)
12. ✅ DONE — PlanPreviewCard.tsx — tokens semânticos + StatusBadge
13. ⬜ products/page.tsx — style={{}} → classes Tailwind
14. ⬜ products/[sku]/page.tsx — style={{}} → classes Tailwind

### Fase 4 — Novas telas via Stitch
15. ⬜ Cada tela nova criada no Stitch → exportar → converter com skill

## Como trabalhar em cada fase
Sempre executar uma tarefa por vez.
Sempre rodar pnpm dev após cada alteração e confirmar build limpo.
Nunca refatorar estilo e lógica no mesmo commit.
