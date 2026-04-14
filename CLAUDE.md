# CLAUDE.md — AdCraft v2

## Visão geral
AdCraft é uma plataforma de marketing com IA para criação de
criativos e gestão de campanhas. Stack: Next.js 14 App Router,
Tailwind, TypeScript, Shadcn/ui, Supabase, Drizzle, workers Node.js.

## Skills obrigatórios
Antes de criar ou editar qualquer componente de UI, leia:
- .claude/skills/frontend-adcraft.md   → design system Kinetic Console
- .claude/skills/stitch-to-adcraft.md  → conversão de layouts Stitch

## Estrutura do projeto
- frontend/          → Next.js 14 App Router
- workers/           → agentes Node.js (não alterar sem instrução)
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

### Proibições absolutas
- NUNCA hardcodar user_id — usar contexto de auth
- NUNCA hardcodar listas (plataformas, goals, status) em componentes
- NUNCA misturar subscription Supabase Realtime dentro de componente
  de layout (Sidebar, NotificationBell) — usar contexto ou hook global

## Ordem de prioridade para refatoração
Seguir esta ordem — não pular etapas:

### Fase 1 — Fundação (não quebra nada)
1. Criar lib/constants.ts com todas as constantes hoje hardcoded
2. Migrar StatusBadge para usar CSS vars de status do globals.css
3. Migrar MetricCard para classes Tailwind semânticas

### Fase 2 — Extração de hooks (não quebra UI)
4. Extrair useConversations de Sidebar.tsx → hooks/useConversations.ts
5. Extrair useNotifications de NotificationBell.tsx → hooks/useNotifications.ts
6. Extrair useTasks de demandas/page.tsx → hooks/useTasks.ts
7. Extrair useProducts de products/page.tsx → hooks/useProducts.ts
8. Extrair useCopyBoard de CopyComponentBoard.tsx → hooks/useCopyBoard.ts

### Fase 3 — Migração de estilos (tela por tela)
9.  Sidebar.tsx — style={{}} → classes Tailwind
10. app/page.tsx (chat) — style={{}} → classes Tailwind
11. MessageList.tsx — balões com style={{}} → classes Tailwind
12. PlanPreviewCard.tsx — cores hardcoded → tokens semânticos
13. products/page.tsx — style={{}} → classes Tailwind
14. products/[sku]/page.tsx — style={{}} → classes Tailwind

### Fase 4 — Novas telas via Stitch
15. Cada tela nova criada no Stitch → exportar → converter com skill

## Como trabalhar em cada fase
Sempre executar uma tarefa por vez.
Sempre rodar pnpm dev após cada alteração e confirmar build limpo.
Nunca refatorar estilo e lógica no mesmo commit.