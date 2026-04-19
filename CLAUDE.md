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
- `.claude/skills/dev/frontend-adcraft.md`   → design system Kinetic Console
- `.claude/skills/dev/stitch-to-adcraft.md`  → conversão de layouts Stitch
- `.claude/skills/dev/ux-ui-adcraft.md`      → auditoria UX, polish, checklist de estados

Antes de executar ou modificar qualquer agente de pipeline, leia:
- `.claude/skills/agents/_pipeline.md`       → orquestração, scripts, checkpoint

## Orquestração Claude Code (Ultron)

### Como disparar um pipeline
```
"Roda pipeline completo para o produto X (product_id: UUID)"
"Roda pipeline pesquisa para o produto X (product_id: UUID)"
"Retoma pipeline pipeline_id: UUID"
```

### Fluxo de execução
1. `npx tsx scripts/pipeline/create.ts --product-id <uuid> [--type full|pesquisa|criativo|lancamento]`
2. Ler `.claude/pipelines/full-pipeline.yaml` para ordem e dependências
3. Buscar learnings vetoriais do nicho: `npx tsx scripts/search/vector.ts --query "<produto+nicho>" --niche-id <uuid> --limit 5`
4. Spawnar cada agente em sequência (Agent tool) com o skill correspondente + bloco de mercado-alvo
5. Cada agente grava no banco via `scripts/artifact/save.ts`
6. Ao final: `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>`

### As 3 fases do pipeline

**Fase 1 — Pesquisa (Agentes 1–6):** entender o produto e o mercado antes de criar qualquer material.
```
VSL Analysis → [Market Research ∥ Avatar Research] → Benchmark Intelligence → Angle Generator → Campaign Strategy
```
Os agentes de pesquisa rodam parcialmente em paralelo. O Angle Generator sintetiza tudo para formular o posicionamento diferenciado.

**Fase 2 — Criativo (Agentes 7–12):** produzir o pacote completo de materiais.
```
[Script Writer ∥ Copywriting ∥ Character Generator] → Keyframe Generator → Video Maker → Creative Director
```
O Creative Director é o único filtro de qualidade criativa — aprova ou bloqueia o pacote antes de avançar.

**Fase 3 — Lançamento (Agentes 13–18):** preparar e estruturar a campanha.
```
[Compliance Check ∥ UTM Builder] → [Facebook Ads ∥ Google Ads] → Performance Analysis → Scaling Strategy
```
Facebook Ads e Google Ads usam **exclusivamente** `compliance_results.approved_combinations` como fonte de copy.

### Loops de revisão

**Loop 1 — Creative Director bloqueia:** re-invoca o agente indicado (máximo 2× por pipeline). Se ainda bloqueado após 2 tentativas, escalar para o usuário.

**Loop 2 — Compliance bloqueia top_combination:** Facebook/Google caem para próxima combinação aprovada. Se `approved_combinations` vazio, pipeline pausa aguardando instrução do usuário.

**Loop 3 — Todos criativos são losers (hook_rate < 15% por 14 dias):** Scaling Strategy sinaliza; criar pipeline criativo filho com `--type criativo --parent-pipeline <id>`, reutilizando pesquisa do pipeline pai.

### Multi-mercado — regra obrigatória

Antes de spawnar **qualquer** subagente, injetar no prompt:
```
## Mercado-alvo do produto
- target_country: <valor de products.target_country>
- target_language: <valor de products.target_language>
- Todos os materiais devem ser gerados em <target_language>,
  adaptados para o contexto cultural, regulatório e econômico de <target_country>.
```
Obter os valores com: `SELECT target_country, target_language FROM products WHERE id = 'PRODUCT_UUID';`

### Scripts disponíveis
| Script | Uso |
|--------|-----|
| `scripts/pipeline/create.ts` | Cria pipeline + tasks no banco |
| `scripts/pipeline/status.ts` | Consulta estado atual do pipeline |
| `scripts/pipeline/complete-task.ts` | Marca task como concluída |
| `scripts/artifact/save.ts` | Salva artefato em product_knowledge |
| `scripts/artifact/get.ts` | Lê artefato de um pipeline |
| `scripts/copy/save-components.ts` | Salva hooks/bodies/CTAs em copy_components |
| `scripts/copy/update-compliance.ts` | Atualiza status de compliance por tag |
| `scripts/learning/extract.ts` | Extrai learnings pós-pipeline |
| `scripts/search/vector.ts` | Busca semântica nos learnings do nicho |

### Skills dos agentes
Cada agente tem seu skill em `.claude/skills/agents/<agente>.md` com:
- Papel e contexto necessário
- Metodologia e fontes de pesquisa
- Formato exato do output (schema do banco)
- Script de salvamento

### Workers — status atual
| Processo | Status | Como executar |
|----------|--------|--------------|
| `task-runner.ts` | ❌ DESCOMISSIONADO | Não executar |
| `workers/agents/*.ts` | ❌ DESCOMISSIONADOS | Substituídos pelos skills |
| `gemini-client.ts` | ❌ NÃO INVOCAR | Não mais usado |
| `lib/embeddings/gemini-embeddings.ts` | ✅ ATIVO | `npx tsx workers/lib/embeddings/gemini-embeddings.ts` |
| `agents/learning-extractor.ts` | ✅ ATIVO | Via `scripts/learning/extract.ts` |
| `cron/learning-aggregator-cron.ts` | ✅ ATIVO | Cron job externo |

## Estrutura do projeto
- `frontend/`                → Next.js 14 App Router (visualização read-only)
- `workers/`                 → DEPRECATED (ver workers/README-DEPRECATED.md). Manter embeddings + learning-extractor.
- `workers/cron/`            → jobs periódicos (learning-aggregator-cron.ts) — ainda ativo
- `db/`                      → migrations SQL Supabase (V2 em migrations/v2/)
- `stitch/[tela]/`           → exports do Google Stitch (html, DESIGN.md, png)
- `.claude/skills/dev/`      → skills de desenvolvimento (frontend, DB, deploy, etc.)
- `.claude/skills/agents/`   → skills de execução dos 18 agentes
- `.claude/pipelines/`       → definição do pipeline (DAG, dependências, ordem)
- `scripts/`                 → DB bridge scripts para orquestração Claude Code

## Estado das Fases V2 (última atualização: 2026-04-18)

| Fase | Status | Resumo |
|------|--------|--------|
| A — Migração Claude | ↩️ revertido | Provider padrão revertido para Gemini; Claude mantido como opção |
| B — Jarvis tool use | ⏸️ pausado | Arquivos preservados. Jarvis desativado — motor migrado para Claude Code |
| C — Tela Demandas | ✅ 80% | Lista + detalhe com timeline. Pendente: logs WebSocket em tempo real |
| D — Tela Produto | ✅ 70% | 6 sub-abas funcionais. Pendente: diff de copy, score de viabilidade |
| E — Memória cumulativa | ✅ 90% | Extrator + aggregator + busca vetorial via scripts/search/vector.ts |
| F — Polish + testes | ⬜ 0% | FilterBar, keyboard shortcuts, Playwright E2E, docs — não iniciado |
| G — Ultron (Claude Code) | ✅ 100% | 18 agent skills + pipeline DAG + DB bridge scripts implementados |

## Arquivos canônicos de referência

| Arquivo | Responsabilidade |
|---------|-----------------|
| `frontend/lib/schema/index.ts` | Schema Drizzle ORM (todas as tabelas) — fonte de verdade |
| `frontend/lib/agent-registry.ts` | AGENT_REGISTRY, GoalName, budgets (7 agentes originais) |
| `.claude/pipelines/full-pipeline.yaml` | DAG dos 18 agentes, dependências, ordem de execução |
| `.claude/skills/agents/_pipeline.md` | Guia de orquestração — ler antes de executar qualquer pipeline |
| `frontend/app/globals.css` | CSS vars (design tokens Kinetic Console) |
| `frontend/tailwind.config.ts` | Mapeamento CSS vars → classes Tailwind |
| `workers/agents/learning-extractor.ts` | Extrator de learnings pós-pipeline (Fase E) — ainda ativo |
| `workers/cron/learning-aggregator-cron.ts` | Aggregator diário de patterns (Fase E) — ainda ativo |
| `workers/lib/embeddings/gemini-embeddings.ts` | Batch worker de embeddings — ainda ativo |
| `workers/lib/knowledge.ts` | saveArtifact, saveCopyComponents — reutilizado pelos scripts |
| `workers/lib/tagging.ts` | Sistema canônico de tags (SKU_v1_H1) — reutilizado pelos scripts |

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
- Lógica de dados (fetch, Supabase) → sempre em hooks em `hooks/`
- Componentes de página → apenas composição de componentes e hooks
- Nunca fazer fetch diretamente dentro de um componente de UI
- Frontend é read-only: não disparar LLM calls do frontend

### Proibições absolutas
- NUNCA hardcodar `user_id` — usar contexto de auth
- NUNCA hardcodar listas (plataformas, goals, status) em componentes
- NUNCA misturar subscription Supabase Realtime dentro de componente de layout
- NUNCA chamar APIs de LLM (Gemini, Anthropic) a partir do frontend

## Roadmap de refatoração de código (pendências)

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
10. ✅ DONE — app/page.tsx (chat) — desativado, redirect para /demandas
11. ✅ DONE — MessageList.tsx — react-markdown + MermaidBlock
12. ✅ DONE — PlanPreviewCard.tsx — tokens semânticos + StatusBadge
13. ⬜ products/page.tsx — style={{}} → Tailwind
14. ⬜ products/[sku]/page.tsx — style={{}} → Tailwind

### Fase 4 — Novas telas
15. ⬜ FilterBar reutilizável — aplicar em /products, /demandas, /campanhas, /insights
16. ⬜ Empty states com CTA em todas as listagens
17. ⬜ Skeleton loaders padronizados

## Como trabalhar
- Uma tarefa por vez — marcar DONE antes de iniciar a próxima
- Sempre rodar `pnpm dev` após cada alteração e confirmar build limpo
- Nunca refatorar estilo e lógica no mesmo commit
