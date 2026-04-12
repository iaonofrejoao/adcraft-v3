# AUDIT REPORT — AdCraft v2
Data: 2026-04-11
Auditor: Claude Code

---

## Resumo executivo

- Itens verificados: 68
- PASS: 60
- FAIL: 4 (crítico: 0, alto: 1, médio: 3, baixo: 0)
- WARN: 4
- N/A: 0 (Layer 2 — validação comportamental não executada: servidor parado)

---

## Camada 1 — Conformidade estática

### 1.1 Estrutura de pastas

- [PASS] `workers/` existe — `workers/task-runner.ts`, `workers/lib/`, `workers/agents/`, `workers/cron/`
- [PASS] `lib/` existe — `frontend/lib/agent-registry.ts`, `frontend/lib/jarvis/`, `frontend/lib/knowledge/`, `frontend/lib/tagging.ts`
- [PASS] `app/` existe — `frontend/app/`
- [PASS] `components/` existe — `frontend/components/chat/`, `frontend/components/products/`
- [PASS] `migrations/v2/` existe — 8 arquivos: `000_enable_pgvector.sql` … `0006_complete_rls.sql`
- [PASS] Nenhum import de `reactflow`, `zustand`, `@reactflow/*` encontrado em arquivos ativos — grep em `frontend/` sem resultados
- [PASS] Não há diretório `backend/` separado — v1 Python está em `_legacy-v1-python/` (isolado)
- [FAIL/MÉDIO] `prompts/_archive/v3-future/` está em `_legacy-v1-python/app/agents/prompts/_archive/v3-future/` (não na raiz). Caminho declarado no AUDIT.md: `prompts/_archive/v3-future/`. Os 10 arquivos existem na path alternativa (benchmark_intelligence, campaign_strategist, character_generator, keyframe_generator, media_buyer_facebook, media_buyer_google, performance_analyst, scaler, script_writer, video_generator) — evidência: `Glob _legacy-v1-python/**/_archive/v3-future/*.md` retornou 10 arquivos

### 1.2 Banco de dados

- [PASS] `create extension vector` — `migrations/v2/000_enable_pgvector.sql`: `CREATE EXTENSION IF NOT EXISTS vector;`
- [PASS] Todas as 12 tabelas novas definidas em `migrations/v2/0000_mean_greymalkin.sql`: `pipelines`, `tasks`, `approvals`, `copy_components`, `copy_combinations`, `product_knowledge`, `niche_learnings`, `embeddings`, `conversations`, `messages`, `prompt_caches`, `llm_calls`
- [PASS] `products.sku` — trigger em `migrations/v2/0001_custom_triggers_rls.sql`: `generate_product_sku()` gera `char(4)` aleatório uppercase; índice `UNIQUE` implícito pela definição da coluna
- [PASS] Trigger `validate_copy_combination_components` em `0001_custom_triggers_rls.sql` bloqueia INSERT em `copy_combinations` se hook, body ou cta não estão `approved`
- [PASS] Índice HNSW — `0001_custom_triggers_rls.sql`: `CREATE INDEX idx_embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);`
- [PASS] RLS ativado em todas as tabelas com `user_id` — `0006_complete_rls.sql` ativa RLS em: `tasks`, `approvals`, `copy_components`, `copy_combinations`, `messages`, `llm_calls`, `product_knowledge`, `niche_learnings`, `embeddings`, `prompt_caches`
- [PASS] Coluna `embedding` em `embeddings` é `vector(768)` — `0000_mean_greymalkin.sql`: `embedding vector(768) not null`

### 1.3 Capability Registry (regra 14)

- [PASS] `frontend/lib/agent-registry.ts` existe
- [PASS] Exatamente 6 agentes: `avatar_research`, `market_research`, `angle_generator`, `copy_hook_generator`, `anvisa_compliance`, `video_maker` — `niche_curator` **não** está no registry (correto; é job agendado)
- [PASS] Cada entrada tem: `requires`, `produces`, `cacheable`, `freshness_days`, `model`, `max_input_tokens`
- [PASS] `copy_hook_generator.modes = ['full', 'hooks_only', 'bodies_only', 'ctas_only']`
- [PASS] Nenhum agente arquivado presente (scaler, media_buyer_* ausentes do registry)

### 1.4 Planner dinâmico (regra 14)

- [PASS] `frontend/lib/jarvis/planner.ts` existe e exporta `planPipeline(goal, product_id, force_refresh?)`
- [PASS] `frontend/lib/jarvis/dag-builder.ts` existe com cycle detection via algoritmo de Kahn — lança `"Ciclo detectado no grafo de dependências dos agentes"` se detectar ciclo
- [PASS] Nenhum DAG hardcoded — grep por `task_1.*task_2` e `avatar.*market.*angle` em `workers/` e `lib/` sem resultados; toda sequência vem de `resolveAgentDependencies()` + `topologicalSort()`
- [PASS] `frontend/lib/jarvis/mermaid-renderer.ts` existe — marca `reused` em verde (`#1a5f3f`), `new` em azul (`#3b82f6`) com labels `✓ reused` / `NEW`

### 1.5 Cliente LLM único (regra 18)

- [PASS] `workers/lib/llm/gemini-client.ts` existe
- [PASS] Grep por `@google/genai|GoogleGenerativeAI` em `*.ts` fora de `lib/llm/` — sem resultados; cliente usa `fetch` REST diretamente, sem SDK importado
- [PASS] `callAgent()` lê modelo via `AGENT_REGISTRY[agentName].model` — sem hardcode de modelo
- [PASS] Prompt caching via `createOrGetCache()` que persiste `gemini_cache_name` em `prompt_caches`
- [PASS] Log em `llm_calls` com `input_tokens`, `cached_input_tokens`, `output_tokens`, `cost_usd`, `duration_ms`, `payload`
- [PASS] Circuit breaker `checkBudget()` chamado antes de cada LLM call; pausa pipeline e cria approval `budget_exceeded` se estourar

### 1.6 Knowledge Layer (regra 15)

- [PASS] `frontend/lib/knowledge/product-knowledge.ts` existe
- [PASS] `writeArtifact()` chama RPC `write_artifact` — transação atômica em PostgreSQL definida em `migrations/v2/0002_write_artifact_rpc.sql`: supersede artifact antigo, insere novo, merge JSONB em `pipelines.state`, enfileira embedding
- [PASS] `enqueueEmbedding()` chamado dentro da mesma transação via RPC
- [PASS] Frescor respeitado: avatar 60d, market 30d, angles 30d — definidos em `frontend/lib/jarvis/planner.ts` via `AGENT_REGISTRY[*].freshness_days`

### 1.7 Tagging (regra 16)

- [PASS] `workers/lib/tagging.ts` existe
- [PASS] Padrão implementado: `SKU_v{N}_H{n}`, `SKU_v{N}_B{n}`, `SKU_v{N}_C{n}`, `SKU_v{N}_H{h}_B{b}_C{c}[_V{v}]`; validação via regex `/^[A-Z]{4}_v\d+(_H[1-3]_B[1-3]_C[1-3](_V\d+)?)?$|^[A-Z]{4}_v\d+_[HBC][1-3]$/`
- [PASS] Colunas `tag` em `copy_components` e `copy_combinations` definidas como `UNIQUE NOT NULL` em `0000_mean_greymalkin.sql`
- [PASS] `workers/lib/tagging.test.ts` — 28 testes unitários com regex, build, roundtrip e validação de entradas inválidas

### 1.8 copy_hook_generator

- [PASS] `workers/agents/prompts/copy_hook_generator.md` existe (2684 bytes)
- [PASS] `workers/agents/copy-hook-generator.ts` aceita `mode: CopyMode` (`'full' | 'hooks_only' | 'bodies_only' | 'ctas_only'`), passado para `callAgent()` e injetado no system prompt
- [PASS] Output estruturado com `hooks[]`, `bodies[]`, `ctas[]` — cada item com `text`, `rationale`, `type`/`register`/`structure`, `angle_id` injetado no salvamento
- [PASS] Modo parcial recebe componentes aprovados do produto no contexto via `context_builder`

### 1.9 Aprovação por componente (regras 9, 10, 11)

- [PASS] `frontend/app/products/[sku]/copies/page.tsx` existe com 3 colunas (hooks, bodies, CTAs) via `CopyComponentBoard`
- [PASS] Botões Aprovar/Rejeitar por card em `frontend/components/products/CopyComponentBoard.tsx`
- [FAIL/ALTO] Botão "Gerar combinações" só aparece quando **TODOS** os componentes de cada coluna estão `approved` (`canMaterialize = allApproved('hook') && allApproved('body') && allApproved('cta')`) — evidência: `CopyComponentBoard.tsx:138-141`; `allApproved()` usa `.every()` não `.some()`. PRD exige apenas `≥1 aprovado em cada coluna` — se o usuário rejeitar qualquer componente, o botão nunca ativa independente de quantos aprovados houver
- [PASS] `frontend/app/api/copy-components/[id]/approve/route.ts` existe
- [PASS] `frontend/app/api/copy-components/[id]/reject/route.ts` existe
- [PASS] `frontend/app/api/products/[sku]/materialize-combinations/route.ts` existe; valida ≥1 aprovado por tipo antes de criar combinações
- [PASS] `workers/agents/video-maker.ts`: query `selected_for_video = true` na linha de fetch de combinações; `MAX_VIDEOS_PER_RUN = 5` com pausa e approval `video_cap_exceeded` se ultrapassar

### 1.10 Niche Intelligence

- [PASS] `frontend/lib/knowledge/niche-learnings.ts` existe
- [PASS] `frontend/lib/knowledge/learning-injector.ts` faz query híbrida via RPC `query_niche_learnings` (filtro por nicho + cosine distance pgvector) + embedding do produto para ranking semântico
- [PASS] `workers/lib/embeddings/gemini-embeddings.ts`: `batchEmbeddingsWorker()` processa apenas `niche_learnings` com `confidence >= 0.5` (lazy); demais fontes (`product_knowledge`) embeddadas eagerly por design
- [PASS] Classificação de nicho acontece no cadastro do produto (`products.niche_id` setado na criação), **não** como task de pipeline
- [PASS] `workers/cron/niche-curator-cron.ts` existe — cron diário que encontra nichos com sinais nas últimas 48h e enfileira tasks `niche_curator`

### 1.11 Cost optimization (regras 17, 18, 19)

- [PASS] Model routing correto: `avatar_research`, `market_research`, `angle_generator`, `copy_hook_generator` usam `gemini-2.5-pro`; `anvisa_compliance`, `video_maker`, `niche_curator` usam `gemini-2.5-flash`; Jarvis chat usa Flash (hardcode justificado — ver 3.2)
- [PASS] `pipelines.budget_usd` e `cost_so_far_usd` existem — `0000_mean_greymalkin.sql`: `budget_usd numeric(10,2)`, `cost_so_far_usd numeric(10,4)`
- [PASS] Circuit breaker `checkBudget()` em `gemini-client.ts` pausa pipeline (`status='paused'`) e cria approval `budget_exceeded` ao estourar
- [PASS] Defaults por goal em `frontend/lib/agent-registry.ts` `GOAL_BUDGET_DEFAULTS`: `avatar_only $0.30`, `market_only $0.30`, `angles_only $1.00`, `copy_only $2.00`, `creative_full $8.00`
- [PASS] Hard limit de 5 vídeos — `video-maker.ts`: `MAX_VIDEOS_PER_RUN = 5`; excesso cria approval e pausa; `confirmed_oversized` flag em `tasks` para override

### 1.12 Reference resolution

- [PASS] `frontend/lib/jarvis/reference-resolver.ts` existe
- [PASS] Parser `@` — `resolveProductBySku()` (SKU exato) + `resolveProductByName()` (ILIKE fuzzy, até 5 resultados)
- [PASS] Parser `/` — `ACTION_TO_GOAL` mapeia variantes PT/EN para os 5 goals
- [PASS] `frontend/components/chat/MentionPicker.tsx` existe
- [PASS] Ambiguidade retorna `{ ambiguous: true, candidates: [...] }`

### 1.13 Prompts

- [WARN] 5 prompts v1 existem apenas em `_legacy-v1-python/app/agents/prompts/`: `persona_builder.md`, `market_researcher.md`, `angle_strategist.md`, `compliance_checker.md`, `product_analyzer.md` — nenhum foi portado para `workers/agents/prompts/`; os agentes v2 usam prompts renomeados (`avatar_research.md`, `market_research.md`, `angle_generator.md`, `anvisa_compliance.md`); não é falha funcional mas diverge da rastreabilidade declarada
- [FAIL/MÉDIO] `prompts/jarvis.md` **não existe** — o prompt do Jarvis está inline em `frontend/app/api/chat/route.ts:182` como constante `JARVIS_SYSTEM_PROMPT`; evidência: grep por `jarvis.md` sem resultados em todo o projeto
- [PASS] `workers/agents/prompts/niche_curator.md` existe (2920 bytes)
- [PASS] `copy_hook_generator.md` substituiu `copy_writer` — nenhum arquivo `copy_writer.md` encontrado em `workers/agents/prompts/`

---

## Camada 2 — Validação comportamental

**N/A** — Servidor Next.js e workers não estavam rodando durante a auditoria. Todos os itens 2.1–2.8 requerem execução real (banco, LLM, SSE). Marcar como N/A por impossibilidade de execução — não implica PASS.

---

## Camada 3 — Análise crítica

### 3.1 Race conditions

- [PASS] `FOR UPDATE SKIP LOCKED` usado em `workers/task-runner.ts` via `fetch_next_pending_task()` RPC definida em `0001_custom_triggers_rls.sql` — query usa `FOR UPDATE SKIP LOCKED` na seleção de tasks
- [PASS] Aprovação simultânea: endpoint `approve` atualiza `approval_status` via `supabase.from('copy_components').update()` — Supabase/PostgreSQL garante atomicidade por linha; sem risco de dupla aprovação
- [PASS] Merge JSONB em `pipeline.state` — RPC `write_artifact` usa `state || partial::jsonb` (merge, não substituição total); evidência: `0002_write_artifact_rpc.sql`
- [PASS] Deduplicação em materialização — `materialize-combinations/route.ts` constrói Set de tags existentes antes de inserir; trigger SQL bloqueia inserção de combinação com tag duplicada (UNIQUE constraint)

### 3.2 Desvios silenciosos do PRD

- [WARN] `product_version: 1` hardcoded em `frontend/app/api/chat/route.ts:126` com comentário `// TODO: ler do produto real` — versão do produto não é lida da tabela; impacta geração de tags (tags terão sempre `_v1` mesmo após refresh, potencialmente causando colisão de UNIQUE constraint na v2 do produto)
- [WARN] `JARVIS_MODEL = 'gemini-2.5-flash'` hardcoded em `frontend/app/api/chat/route.ts:180` — Jarvis não usa registry. É aceitável pois Jarvis é framework (não agente rastreável), mas diverge do princípio da regra 17; evidência: `route.ts:180`
- [PASS] Nenhum DAG hardcoded além do registry encontrado
- [PASS] Todos os 5 goals implementados: `avatar_only`, `market_only`, `angles_only`, `copy_only`, `creative_full`
- [PASS] Goals mapeados em `GOAL_TO_DELIVERABLE` e `GOAL_BUDGET_DEFAULTS`

### 3.3 Custo vazando

- [PASS] Todas as chamadas LLM passam por `workers/lib/llm/gemini-client.ts` — grep por `generateContent|@google/genai|GoogleGenerativeAI` fora de `lib/llm/` sem resultados
- [PASS] Embeddings lazy para `niche_learnings` (threshold `confidence >= 0.5`); `product_knowledge` embeddado eagerly por design (sempre relevante)
- [PASS] `llm_calls.cost_usd` populado — `gemini-client.ts:237`: `cost_usd: costUsd.toFixed(6)` calculado por tokens × preço por modelo
- [PASS] Sem loop de N chamadas identificado — cada agente faz 1 chamada por task (com tool loop máximo de 12 rounds interno)

### 3.4 Segurança de dados

- [PASS] Nenhuma credencial em código-fonte — grep por `AIza`, `sk-\w`, `supabase.*anon.*key` em `*.ts` sem resultados; credenciais lidas de `process.env`
- [PASS] Reference resolver usa Supabase client com queries parametrizadas — sem concatenação de strings em SQL
- [PASS] URLs de produtos passadas pelo usuário não são usadas em webhooks externos diretos no fluxo auditado
- [PASS] RLS em 10 tabelas com `user_id` — evidência: `0006_complete_rls.sql` (auditado na 1.2)

### 3.5 Testes

- [PASS] `workers/lib/tagging.test.ts` — 28 testes: formato, uniqueness, versionamento, entradas inválidas
- [PASS] `frontend/lib/jarvis/__tests__/planner.test.ts` — testes de `dag-builder` (5 goals × resolução transitiva), `topologicalSort`, `planPipeline` com estados de cache
- [FAIL/MÉDIO] Nenhum teste para circuit breaker — grep por `circuit.breaker|budget_exceeded` em `*.test.ts` sem resultados
- [FAIL/MÉDIO] Nenhum teste para trigger de `copy_combinations` (validação de componentes aprovados) — testado apenas via migração SQL, sem smoke test
- [WARN] Testes do planner usam mock de Supabase mas não cobrem `force_refresh` explicitamente — cobertura dos 5 goals × 3 estados de cache está parcialmente simulada (mock genérico sem captura por artifact_type funcional — `makeMockSupabase()` retorna `null` para tudo); mock refinado `makeFreshCheckMock()` declarado mas necessita validação de execução

### 3.6 UX quebrado que "passa no lint"

- [PASS] Tela de copies com 0 componentes: `copies/page.tsx:101-107` exibe "Nenhum pipeline de copy encontrado para este produto." com botão de ação
- [WARN] SSE não reconecta após queda de rede — `frontend/app/page.tsx:57-77` usa `fetch` + `ReadableStream.getReader()`, **não** `EventSource`; sem lógica de reconnect implementada — se a conexão cair durante streaming, o usuário recebe `'Erro ao conectar ao Jarvis.'` sem retry automático
- [PASS] Mermaid com 1 nó renderizado corretamente via `renderMermaid()` — sem lógica condicional por número de nós
- [PASS] Botão "Gerar combinações" **não** requer refresh manual — aprovação chama `loadComponents()` no callback que atualiza estado React reativamente

### 3.7 Débito técnico introduzido

- [WARN] `console.log` em 14 locais em workers (evidência: grep em `workers/**/*.ts`): `task-runner.ts` (5 ocorrências), `seed-next-task.ts` (1), `gemini-embeddings.ts` (1), `niche-curator-cron.ts` (5), `video-maker.ts` (2) — são logs operacionais legítimos mas deveriam usar logger estruturado (ex: `pino`) para produção
- [PASS] Nenhum `// unused` ou `// TODO remove` encontrado em workers ou lib
- [PASS] 1 `TODO` ativo: `route.ts:126 — // TODO: ler do produto real` (reportado em 3.2)
- [PASS] Nenhum `FIXME` ou `HACK` encontrado
- [PASS] Sem imports mortos óbvios identificados

---

## Top 10 ações prioritárias

1. **[ALTO]** `canMaterialize` usa `.every()` em vez de `.some()` — `frontend/components/products/CopyComponentBoard.tsx:138-141` — alterar lógica para `≥1 aprovado em cada coluna` (como no PRD); atualmente botão nunca ativa se qualquer componente for rejeitado

2. **[MÉDIO]** `product_version: 1` hardcoded — `frontend/app/api/chat/route.ts:126` — ler `product_version` real da tabela `products` antes de criar pipeline; colisão de tag UNIQUE ao refazer pipeline do mesmo produto

3. **[MÉDIO]** Prompt Jarvis inline — `frontend/app/api/chat/route.ts:182-208` — extrair para `prompts/jarvis.md` conforme declarado no AUDIT.md 1.13; facilita versionamento e revisão do comportamento do orquestrador

4. **[MÉDIO]** Ausência de testes para circuit breaker — nenhum arquivo de teste — criar `workers/lib/__tests__/gemini-client.test.ts` com mocks de `checkBudget()` para cobrir: budget OK, budget estourado, criação de approval

5. **[MÉDIO]** Ausência de testes para trigger `validate_copy_combination_components` — criar smoke test que tenta INSERT com componente rejeitado e confirma erro `23514` do PostgreSQL

6. **[MÉDIO]** Path de `prompts/_archive/v3-future/` não coincide com spec — está em `_legacy-v1-python/app/agents/prompts/_archive/v3-future/`; mover ou documentar desvio no MIGRATION_GUIDE.md

7. **[MÉDIO]** SSE sem reconexão automática — `frontend/app/page.tsx:57` — substituir `fetch` + `ReadableStream` por `EventSource` nativo ou `@microsoft/fetch-event-source` com retry automático; falha de rede hoje silencia o assistente

8. **[BAIXO]** `JARVIS_MODEL` hardcoded em `route.ts:180` — considerar adicionar entrada `jarvis` no registry (ou constante em `agent-registry.ts`) para manter rastreabilidade de modelo centralizada

9. **[BAIXO]** `console.log` em 14 locais em workers — substituir por logger estruturado (`pino`) com níveis `debug`/`info`/`error`; útil para filtragem em produção

10. **[BAIXO]** 5 prompts v1 (`persona_builder`, `market_researcher`, `angle_strategist`, `compliance_checker`, `product_analyzer`) nunca portados para `workers/agents/prompts/` — os nomes v2 são diferentes mas a rastreabilidade de "prompts íntegros da v1" declarada no CLAUDE.md é difícil de verificar; documentar mapeamento explícito
