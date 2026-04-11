# AdCraft v2 — Plano de Execução

Execute na ordem. Cada fase tem pré-requisitos da anterior.

## Fase 0 — Cleanup e migração do v1
Siga o `MIGRATION_GUIDE.md` ponto a ponto. Não pule etapas. Ao final: verificações grep devem passar limpas.

## Fase 1 — Banco v2
1.1 Setup Drizzle ORM (`drizzle.config.ts`, schema dir `lib/schema/`)
1.2 Migration `v2/000_enable_pgvector.sql` — `create extension vector`
1.3 Migrations Drizzle das 11 tabelas novas (PRD seção 6) + colunas em `products`/`niches`
1.4 Trigger SQL de geração de SKU (4 letras [A-Z] random com retry até unique)
1.5 Trigger SQL em `copy_combinations` que valida componentes aprovados antes de INSERT
1.6 Função SQL de polling com `FOR UPDATE SKIP LOCKED`
1.7 RLS em todas as tabelas com `user_id`

## Fase 2 — Infra Workers + LLM Client
2.1 Setup TypeScript do worker (`workers/`, `tsconfig.json`, `package.json`)
2.2 `lib/db.ts` (Supabase client + Drizzle)
2.3 `lib/llm/gemini-client.ts` — **prioridade máxima**, segue skill `gemini-cost-optimization`
2.4 `lib/llm/prompt-cache.ts`
2.5 `lib/embeddings/gemini-embeddings.ts` + worker de embedding em batch
2.6 `lib/r2.ts` — cliente Cloudflare R2

## Fase 2.5 — Planner do Jarvis (CRÍTICO — antes dos agentes)
2.5.1 `workers/lib/agent-registry.ts` — capability map dos 6 agentes (PRD seção 4.1)
2.5.2 `lib/jarvis/planner.ts` — implementa skill `jarvis-planner`
2.5.3 `lib/jarvis/dag-builder.ts` — topological sort + cycle detection
2.5.4 Renderer Mermaid (`lib/jarvis/mermaid-renderer.ts`)
2.5.5 Testes do planner: 5 goals × 3 estados de cache (cold/parcial/full)

## Fase 2.6 — Knowledge Layer
2.6.1 `lib/knowledge/product-knowledge.ts` — write/read atômicos
2.6.2 `lib/knowledge/freshness.ts` — política de frescor por tipo
2.6.3 `lib/jarvis/reference-resolver.ts` — parser de `@` e `/`
2.6.4 Sub-rotina de cadastro de produto: `app/api/products POST` com classificação automática de nicho via embedding

## Fase 2.7 — Niche Intelligence
2.7.1 `lib/knowledge/niche-learnings.ts` — read/write/reinforce
2.7.2 `lib/knowledge/learning-injector.ts` — função de query híbrida (skill `pgvector-search`)
2.7.3 Worker de batch de embeddings (lazy generation)
2.7.4 Cron diário do `niche_curator`

## Fase 3 — Agentes (TypeScript)
3.1 `workers/task-runner.ts` — polling loop principal
3.2 `workers/lib/context-builder.ts` — extrai apenas `requires`, injeta learnings, respeita `max_input_tokens`
3.3 `workers/lib/seed-next-task.ts`
3.4 Agente `avatar_research` (porta `prompts/persona_builder.md`)
3.5 Agente `market_research` (porta `prompts/market_researcher.md`)
3.6 Agente `angle_generator` (porta `prompts/angle_strategist.md`)
3.7 Agente `copy_hook_generator` com 4 modos (`prompts/copy_hook_generator.md`)
3.8 Agente `anvisa_compliance` (porta `prompts/compliance_checker.md`)
3.9 Agente `niche_curator` (`prompts/niche_curator.md`)

## Fase 4 — VEO 3 + video_maker
4.1 Cliente VEO 3 (`lib/veo3-client.ts`)
4.2 Wrapper FFmpeg (`lib/ffmpeg/`) — porta os utilitários de `backend/app/tools/render_video_ffmpeg.py`
4.3 Agente `video_maker` — recebe combinação selecionada, gera vídeo, sobe R2, registra em `assets` com tag

## Fase 5 — API Next.js
5.1 `app/api/products` (POST com classificação de nicho)
5.2 `app/api/chat/route.ts` — SSE endpoint do Jarvis
5.3 `app/api/pipelines/[id]` (GET, status)
5.4 `app/api/copy-components/[id]/{approve,reject}`
5.5 `app/api/products/[sku]/materialize-combinations` (POST)
5.6 `app/api/conversations` (CRUD)

## Fase 6 — Frontend
6.1 Layout base (sidebar de conversas + nav principal)
6.2 `/` — Chat Jarvis (`MessageList`, `MessageInput` com `@` e `/`, `MentionPicker`)
6.3 `PlanPreviewCard` com renderização Mermaid (lazy load `mermaid.js`)
6.4 `ApprovalCreativeCard`
6.5 `/products` + `/products/[sku]`
6.6 `/products/[sku]/copies` — **tela crítica**, 3 colunas, aprovação por componente
6.7 `/creatives`
6.8 `/demandas` (kanban com Supabase Realtime)

## Fase 7 — Testes e validação
7.1 Smoke test E2E: cadastrar produto → goal `copy_only` → aprovar componentes → ver combinações
7.2 Smoke test E2E: goal `creative_full` com seleção de 1 combinação
7.3 Validar circuit breaker (forçar budget baixo, ver pause)
7.4 Validar reaproveitamento (rodar 2 goals seguidos no mesmo produto, ver Mermaid com verde)
7.5 Validar curadoria de nicho (rejeitar 3 hooks com mesmo padrão, rodar curator, ver learning criado)
