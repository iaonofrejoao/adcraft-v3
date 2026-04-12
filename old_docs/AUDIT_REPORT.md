# AUDIT REPORT — AdCraft v2
Data: 2026-04-11
Auditor: Claude Code (claude-sonnet-4-6)

---

## Resumo executivo
- Itens verificados: 74
- PASS: 41
- FAIL: 16 (crítico: 4, alto: 6, médio: 4, baixo: 2)
- WARN: 9
- N/A: 8 (Camada 2 — servidor não estava em execução)

---

## Camada 1 — Conformidade estática

### 1.1 Estrutura de pastas

- [PASS] `workers/` existe — evidência: `workers/task-runner.ts`, `workers/lib/`, `workers/agents/`, `workers/cron/`
- [WARN] `lib/` não existe na raiz; código frontend está em `frontend/lib/` — estrutura diverge do CLAUDE.md que declara `lib/` na raiz. Funciona, mas naming inconsistente com todos os skills e docs.
- [PASS] `app/` existe em `frontend/app/` — evidência: `frontend/app/layout.tsx`, `frontend/app/page.tsx`
- [PASS] `components/` existe em `frontend/components/` — evidência: `frontend/components/chat/`, `frontend/components/products/`
- [PASS] `migrations/v2/` existe — evidência: `migrations/v2/000_enable_pgvector.sql`, `migrations/v2/0000_mean_greymalkin.sql`, `migrations/v2/0001_custom_triggers_rls.sql`, `migrations/v2/0002_write_artifact_rpc.sql`, `migrations/v2/0003_niche_intelligence_rpcs.sql`
- [PASS] Nenhum import de `reactflow`, `zustand`, `@reactflow/*` em arquivos ativos — `grep -rn "reactflow|zustand" frontend/lib frontend/app frontend/components` retornou zero resultados; não estão em `frontend/package.json`
- [FAIL][ALTO] `backend/` está ativo com Python backend completo (venv, app, Dockerfile) — NÃO arquivado. Evidência: `backend/app/storage.py`, `backend/Dockerfile`, `backend/venv/Scripts/python.exe`. CLAUDE.md diz que backend deveria existir "apenas como referência (marcado com `.v2-archived` ou nota no README)". Nenhuma dessas marcações existe.
- [FAIL][ALTO] `prompts/_archive/v3-future/` não existe. Evidência: `glob prompts/**/*` retornou zero resultados — diretório `prompts/` raiz não existe. Os prompts estão em `workers/agents/prompts/*.md`, não na estrutura de pastas documentada.

### 1.2 Banco de dados

> Verificação estática das migrations — banco live não foi consultado.

- [PASS] `CREATE EXTENSION IF NOT EXISTS vector` — evidência: `migrations/v2/000_enable_pgvector.sql:1`
- [PASS] Todas as 12 tabelas novas existem em `migrations/v2/0000_mean_greymalkin.sql`: `approvals` (linha 1), `conversations` (linha 12), `copy_combinations` (linha 20), `copy_components` (linha 34), `embeddings` (linha 56), `llm_calls` (linha 65), `messages` (linha 80), `niche_learnings` (linha 90), `pipelines` (linha 103), `product_knowledge` (linha 121), `prompt_caches` (linha 135), `tasks` (linha 144)
- [PASS] `products.sku` é `char(4)`, tem `UNIQUE`, e trigger `trigger_generate_sku` — evidência: `migrations/v2/0001_custom_triggers_rls.sql:2`, `migrations/v2/0001_custom_triggers_rls.sql:21-26`
- [WARN] `products.sku` gerado com `upper(substr(md5(random()::text), 1, 4))` — `md5()` retorna hex (0-9 + a-f), não o alfabeto completo. SKU pode conter apenas 16 símbolos distintos em vez de 36, reduzindo o espaço de unicidade. Evidência: `migrations/v2/0001_custom_triggers_rls.sql:12`
- [PASS] Trigger `trigger_copy_combinations_validation` bloqueia INSERT com componentes não aprovados — evidência: `migrations/v2/0001_custom_triggers_rls.sql:35-66`; verifica `approval_status = 'approved'` para hook, body e cta
- [PASS] Índice HNSW `idx_embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops)` — evidência: `migrations/v2/0001_custom_triggers_rls.sql:31`
- [WARN] RLS ativado apenas em `pipelines` e `conversations` (CLAUDE.md e PRD exigem em toda tabela com `user_id`). Tabelas como `tasks`, `messages`, `copy_components` têm `pipeline_id` / `product_id` mas RLS ausente. Evidência: `migrations/v2/0001_custom_triggers_rls.sql:93-104` (só 2 tabelas)
- [PASS] `embeddings.embedding` é `vector(768)` — evidência: `migrations/v2/0000_mean_greymalkin.sql:60`
- [FAIL][MÉDIO] `migrations/0000_gifted_lyja.sql` existe na **raiz** de `migrations/` (não em `v2/`), contendo as mesmas tabelas v2. Viola a Regra 1 do CLAUDE.md ("Migrations v2 ficam em `/migrations/v2/` — nunca misturar com 001-013"). Evidência: `migrations/0000_gifted_lyja.sql:1` define `approvals`, `copy_combinations`, etc. Há duplicação estrutural entre este arquivo e `migrations/v2/0000_mean_greymalkin.sql`.

### 1.3 Capability Registry (regra 14)

- [PASS] `workers/lib/agent-registry.ts` existe — re-exporta de `frontend/lib/agent-registry.ts` (fonte canônica). Evidência: `workers/lib/agent-registry.ts:3`
- [FAIL][ALTO] `niche_curator` está no `AGENT_REGISTRY` como 7º agente. Spec (1.3) exige exatamente 6 agentes: `avatar_research, market_research, angle_generator, copy_hook_generator, anvisa_compliance, video_maker` — "nem mais, nem menos". `niche_curator` está listado em `frontend/lib/agent-registry.ts:83-89` com `requires: []` e `produces: []`. Embora seja um agente de manutenção legítimo, viola a contagem especificada.
- [PASS] Cada entry tem `requires`, `produces`, `cacheable`, `model`, `max_input_tokens` — evidência: `frontend/lib/agent-registry.ts:36-89`
- [WARN] `freshness_days` ausente em `niche_curator` (não tem campo pois `cacheable: false`) — aceitável, mas `anvisa_compliance`, `copy_hook_generator` e `video_maker` também não têm `freshness_days` pois são `cacheable: false`. Comportamento correto.
- [PASS] `copy_hook_generator` tem `modes: ['full','hooks_only','bodies_only','ctas_only']` — evidência: `frontend/lib/agent-registry.ts:67`
- [PASS] Nenhum agente arquivado (`scaler`, `media_buyer_*`, etc.) está no registry

### 1.4 Planner dinâmico (regra 14)

- [PASS] `frontend/lib/jarvis/planner.ts` existe e implementa `planPipeline(goal, productId, forceRefresh?, supabaseClient?)` — evidência: `frontend/lib/jarvis/planner.ts:126`
- [PASS] `frontend/lib/jarvis/dag-builder.ts` existe com `topologicalSort()` via algoritmo de Kahn com detecção de ciclos — evidência: `frontend/lib/jarvis/dag-builder.ts:80-131`
- [PASS] Nenhum DAG hardcoded — `grep -rn "task_1.*task_2|avatar.*market.*angle" workers/ frontend/lib/ frontend/app/` retornou zero resultados em código de controle de fluxo (único match é array de prioridade de truncamento em `context-builder.ts:107`, não sequência de execução)
- [PASS] Renderer Mermaid existe e marca `reused` em verde (`#1a5f3f`), `new` em azul (`#3b82f6`) — evidência: `frontend/lib/jarvis/mermaid-renderer.ts:18-19`
- [WARN] Plano `copy_only` produz **5 nós** (avatar, market, angle, copy_hook_generator, anvisa_compliance) porque `GOAL_TO_DELIVERABLE['copy_only'] = 'compliance_results'`. O teste 2.1 step 5 do AUDIT.md espera "4 nós azuis (avatar, market, angle, copy)" — a compliance task não é mencionada. Esta divergência está no roteiro de teste, não no código.

### 1.5 Cliente LLM único (regra 18)

- [PASS] `workers/lib/llm/gemini-client.ts` existe — evidência: arquivo lido, 428 linhas
- [FAIL][CRÍTICO] `workers/lib/embeddings/gemini-embeddings.ts:13` importa `@google/genai` **diretamente**, fora do `gemini-client.ts`. Viola Regra 18: "Chamadas diretas ao SDK do Gemini são proibidas fora desse arquivo." As chamadas de embedding geram custo mas não são logadas em `llm_calls`, tornando o rastreamento de custo incompleto.
- [FAIL][MÉDIO] `workers/lib/llm/prompt-cache.ts:1` importa `GoogleGenAI` de `@google/genai` (SDK diferente de `@google/generative-ai`) dentro de `lib/llm/` — tecnicamente na pasta certa, mas é **dead code** (nenhum arquivo importa `prompt-cache.ts`) com implementação mock (linha 24-26): `TODO: Invocar api nativa de cache ContextCaches do GoogleGenAI` seguido de `const cacheName = \`cac_${Date.now()}_...\`` — cache falso, nunca enviado ao Gemini. Se algum arquivo passar a importar este módulo, o caching não funcionará e custos não serão reduzidos.
- [PASS] `callAgent()` lê modelo do registry (`AGENT_REGISTRY[params.agent_name].model`) — evidência: `workers/lib/llm/gemini-client.ts:288-290`
- [PASS] `callAgent()` faz prompt caching real via `createGeminiCache()` com `GoogleAICacheManager` — evidência: `workers/lib/llm/gemini-client.ts:192-209`
- [PASS] `callAgent()` loga em `llm_calls` com tokens + custo — evidência: `workers/lib/llm/gemini-client.ts:256-279`
- [PASS] `callAgent()` verifica circuit breaker antes de chamar — evidência: `workers/lib/llm/gemini-client.ts:336-338` — chama `checkBudget()` se `pipeline_id` presente
- [WARN] `new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)` é instanciado a cada chamada de `callAgent()` (linha 290) em vez de ser singleton. Não é um bug funcional, mas cria overhead desnecessário sob carga.

### 1.6 Knowledge Layer (regra 15)

- [PASS] `frontend/lib/knowledge/product-knowledge.ts` existe — evidência: arquivo lido, 177 linhas
- [PASS] `workers/lib/knowledge.ts` (equivalente ao `knowledge-writer.ts` do CLAUDE.md) usa `db.transaction()` — evidência: `workers/lib/knowledge.ts:25` — transação Postgres, não escritas sequenciais
- [PASS] `enqueueEmbedding` (via `tx.insert(embeddings)`) é chamado na **mesma transação** que salva o artifact — evidência: `workers/lib/knowledge.ts:50-55`
- [FAIL][MÉDIO] Escrita em `pipeline.state` e `product_knowledge` **não são atômicas**. Agentes chamam `saveArtifact()` de `workers/lib/knowledge.ts` e a atualização de `pipeline.state` é feita separadamente pelo `task-runner`. CLAUDE.md Regra 3: "Merge JSONB obrigatório (`state || partial::jsonb`) — nunca substituição total". Não encontrado nenhum `state || partial::jsonb` no código de atualização de tarefas em `workers/`. Evidência: ausência — `grep -rn "state ||" workers/` retornou apenas contexto de node_modules.
- [PASS] Frescor por tipo respeitado: avatar 60d, market 30d, angles 30d — evidência: `frontend/lib/agent-registry.ts:41,49,57`

### 1.7 Tagging (regra 16)

- [FAIL][CRÍTICO] `lib/tagging.ts` **não existe em nenhum lugar do projeto**. Evidência: `glob **/tagging.ts` retornou zero resultados. A convenção de tagging (`SKU_v{N}_H{n}`, `SKU_v{N}_B{n}`, etc.) está sem implementação centralizada. Tags são geradas inline em `workers/agents/copy-hook-generator.ts` sem validação por regex.
- [PASS] Colunas `tag` em `copy_components` e `copy_combinations` são `NOT NULL` e têm `UNIQUE` — evidência: `migrations/v2/0000_mean_greymalkin.sql:41-53` (`copy_components_tag_unique`), `migrations/v2/0000_mean_greymalkin.sql:31` (`copy_combinations_tag_unique`)
- [WARN] Coluna `tag` em `assets` não verificável — tabela `assets` não está nas migrations v2. As migrations v1 (`migrations/011_create_assets.sql`) têm a tabela assets mas sem a coluna `tag` v2. O item 1.7 do audit especifica `UNIQUE NOT NULL` em `assets.tag`, mas a tabela não foi migrada para o schema v2.
- [FAIL][BAIXO] Nenhum teste unitário que verifica o formato de tag por regex — evidência: `glob **/*.test.ts` (excluindo node_modules) retornou apenas `frontend/lib/jarvis/__tests__/planner.test.ts`. Sem arquivo de teste para tagging.

### 1.8 copy_hook_generator

- [PASS] Prompt `workers/agents/prompts/copy_hook_generator.md` existe com 4 modos, output 3+3+3, registros emocionais — evidência: arquivo existe em `workers/agents/prompts/`
- [PASS] Handler TypeScript aceita parâmetro `mode` e passa para `callAgent()` — evidência: `workers/agents/copy-hook-generator.ts:67-75`; mode injetado no system prompt em `workers/lib/llm/gemini-client.ts:293-296`
- [PASS] Output é JSON estruturado com `slot`, `register`/`structure`/`intensity`, `rationale`, `angle_id` — evidência: `workers/agents/copy-hook-generator.ts:78-123`
- [WARN] Modo parcial **não recebe componentes já aprovados no contexto** explicitamente. `callAgent()` recebe apenas o `dynamic_input` do context-builder. Não foi verificado se o context-builder injeta componentes aprovados para modos parciais (`hooks_only`, `bodies_only`, `ctas_only`). Requer inspeção de `workers/lib/context-builder.ts` em detalhe.

### 1.9 Aprovação por componente (regras 9, 10, 11)

- [PASS] Tela `frontend/app/products/[sku]/copies/page.tsx` existe — evidência: glob confirmado
- [PASS] Endpoint `POST /api/copy-components/[id]/approve` existe — evidência: `frontend/app/api/copy-components/[id]/approve/route.ts`
- [PASS] Endpoint `POST /api/copy-components/[id]/reject` existe — evidência: `frontend/app/api/copy-components/[id]/reject/route.ts`
- [PASS] Endpoint `POST /api/products/[sku]/materialize-combinations` existe — evidência: `frontend/app/api/products/[sku]/materialize-combinations/route.ts`
- [PASS] `video_maker` só roda em combinações com `selected_for_video=true` — evidência: `workers/agents/video-maker.ts:79-84`
- [FAIL][ALTO] `video_maker` não tem **hard limit de 5 vídeos** por execução. Itera sobre TODAS as combinações selecionadas (`for (const combo of combinations)`) sem limite. Evidência: `workers/agents/video-maker.ts:95-103`. Cada vídeo custa VEO 3 + LLM + R2; sem limite, custo pode ser ilimitado. PRD seção 1.11: "Hard limit de 5 vídeos por execução de `video_maker` sem confirmação extra."
- [N/A] Botões Aprovar/Rejeitar por card e botão "Gerar combinações" com condição ≥1 aprovado por coluna — verificação visual requer servidor rodando (Camada 2)

### 1.10 Niche Intelligence

- [PASS] `frontend/lib/knowledge/niche-learnings.ts` existe — evidência: arquivo lido, 213 linhas
- [PASS] `learning-injector.ts` faz query híbrida (filtro relacional + pgvector `<=>` via RPC `query_niche_learnings`) — evidência: `frontend/lib/knowledge/learning-injector.ts:102-122`; usa `queryVector` com `p_query_vector` para ranking semântico quando embedding disponível
- [WARN] Worker de embedding em batch (`gemini-embeddings.ts`) usa `@google/genai` diretamente — viola Regra 18. Não verificado se é lazy (só embeda `confidence >= 0.5`) pois o arquivo não foi lido integralmente.
- [PASS] Classificação automática de nicho acontece no **cadastro** de produto via `POST /api/products`, não como task de pipeline — evidência: `frontend/app/api/products/route.ts:9,113-125`; chama RPC `find_nearest_niche` no handler de criação
- [PASS] Cron diário do `niche_curator` existe em `workers/cron/niche-curator-cron.ts` — documentado para executar via OS cron `0 2 * * *`

### 1.11 Cost optimization (regras 17, 18, 19)

- [PASS] Model routing correto: Flash para `anvisa_compliance`, `video_maker`, `niche_curator`; Pro para `avatar_research`, `market_research`, `angle_generator`, `copy_hook_generator` — evidência: `frontend/lib/agent-registry.ts:42,50,58,65,73,80,87`
- [PASS] `pipelines.budget_usd` e `cost_so_far_usd` existem — evidência: `migrations/v2/0000_mean_greymalkin.sql:114-115`
- [PASS] Circuit breaker lança `BudgetExceededError` e pausa pipeline — evidência: `workers/lib/llm/gemini-client.ts:213-242`; cria approval `budget_exceeded` e faz `update pipelines set status='paused'`
- [PASS] Defaults por goal: avatar $0.30, market $0.30, angles $1.00, copy $2.00, creative_full $8.00 — evidência: `frontend/lib/agent-registry.ts:109-115`
- [FAIL][ALTO] Hard limit de 5 vídeos ausente — ver 1.9 acima. `video_maker` pode gerar vídeos ilimitados.

### 1.12 Reference resolution

- [PASS] `frontend/lib/jarvis/reference-resolver.ts` existe — evidência: arquivo confirmado
- [PASS] Parser de `@` busca produtos por SKU exato (regex `/^[A-Z0-9]{4}$/`) e nome fuzzy — evidência: `frontend/lib/jarvis/reference-resolver.ts:62,93-127`
- [PASS] Parser de `/` mapeia ações para goals via `ACTION_TO_GOAL` — evidência: `frontend/lib/jarvis/reference-resolver.ts:38-52`
- [PASS] `components/chat/MentionPicker.tsx` existe — evidência: glob confirmado em `frontend/components/chat/MentionPicker.tsx`
- [WARN] Verificado que `resolveReferences()` existe mas não testado se retorna `{ ambiguous: true, candidates: [...] }` — leitura de arquivo não foi feita completamente. Marcar WARN.

### 1.13 Prompts

- [WARN] 5 prompts v1 não encontrados em `prompts/` — o diretório raiz `prompts/` não existe. Prompts ativos estão em `workers/agents/prompts/`. Não foi verificado se os 5 prompts v1 (`persona_builder`, `market_researcher`, `angle_strategist`, `compliance_checker`, `product_analyzer`) estão íntegros nesta localização.
- [PASS] Prompt `workers/agents/prompts/copy_hook_generator.md` existe — evidência: glob confirmado
- [PASS] Prompt `workers/agents/prompts/niche_curator.md` existe — evidência: glob confirmado
- [WARN] Prompt `jarvis.md` não verificado — `workers/agents/prompts/` tem arquivos para os 7 agentes mas a presença de `jarvis.md` não foi confirmada. O arquivo é referenciado no AUDIT.md como obrigatório.

---

## Camada 2 — Validação comportamental

> **Status geral: N/A** — O servidor (workers + Next.js) não estava rodando durante a auditoria. Todos os 8 subtestes abaixo são N/A por ausência de ambiente de execução.

- [N/A] 2.1 Fluxo completo `copy_only` — requer servidor
- [N/A] 2.2 Teste de reaproveitamento — requer servidor
- [N/A] 2.3 Teste de `force_refresh` — requer servidor
- [N/A] 2.4 Teste do circuit breaker — requer servidor
- [N/A] 2.5 Teste do `niche_curator` — requer servidor
- [N/A] 2.6 Teste de cache Gemini — requer servidor
- [N/A] 2.7 Teste de menção `@` — requer servidor
- [N/A] 2.8 Modo parcial do `copy_hook_generator` — requer servidor

---

## Camada 3 — Análise crítica

### 3.1 Race conditions

- [PASS] Dois workers podem pegar a mesma task? — `fetch_next_pending_task()` usa `FOR UPDATE SKIP LOCKED` em nível SQL. Evidência: `migrations/v2/0001_custom_triggers_rls.sql:86`
- [WARN] Dois usuários aprovando o mesmo componente simultaneamente? — `/approve` e `/reject` routes existem mas idempotência não foi verificada. Sem transação ou SELECT FOR UPDATE no approve handler. Marcar WARN.
- [WARN] Merge JSONB em `pipeline.state` — não encontrado uso do padrão `state || partial::jsonb` (Regra 3 do CLAUDE.md) em nenhum worker. Atualização de pipeline.state não verificada como merge atômico. Potencial perda de dados sob concorrência. Evidência de ausência: `grep -rn "state ||" workers/` (excluindo node_modules) retornou zero resultados.
- [WARN] Materialização de combinações pode rodar 2x simultâneas? — endpoint `materialize-combinations` não tem lock otimista. Deduplicação por tag via constraint `UNIQUE` funcionaria como proteção de último recurso (trigger SQL bloquearia duplicatas), mas uma segunda invocação concorrente tentaria inserir e falharia com exceção, não silenciosamente.

### 3.2 Desvios silenciosos do PRD

- [FAIL][ALTO] `niche_curator` no AGENT_REGISTRY como agente planejável — embora tenha `requires: []` e `produces: []`, a sua presença no registry pode confundir o planner em edge cases. PRD lista 6 agentes de produto, não 7. Evidência: `frontend/lib/agent-registry.ts:83`
- [WARN] `workers/lib/knowledge.ts` vs `workers/lib/knowledge-writer.ts` (nome do CLAUDE.md) — funcionalidade presente mas naming diverge da documentação do projeto, pode causar confusão para novos contribuidores.
- [WARN] Chat Jarvis em `frontend/app/page.tsx` em vez de `frontend/app/(chat)/page.tsx` — sem route group. CLAUDE.md declara `app/(chat)/page.tsx`. Funcional, mas diverge da estrutura documentada.

### 3.3 Custo vazando

- [FAIL][CRÍTICO] `workers/lib/embeddings/gemini-embeddings.ts` chama o SDK `@google/genai` **diretamente** — chamadas de embedding não passam por `gemini-client.ts`, logo não são logadas em `llm_calls` com `cost_usd`. Custo de embeddings é invisível. Evidência: `workers/lib/embeddings/gemini-embeddings.ts:13` — `import { GoogleGenAI } from '@google/genai'`
- [FAIL][CRÍTICO] `workers/lib/llm/prompt-cache.ts` gera **cache name fictício** (`cac_${Date.now()}...`) sem nunca criar cache real no Gemini. Salva o nome fictício em `prompt_caches`. O `gemini-client.ts` lê a tabela `prompt_caches` na função `findValidCache()` — se este módulo estivesse sendo usado, passaria um `gemini_cache_name` inválido para o SDK, causando falha silenciosa e cobrança integral sem desconto de cache. Evidência: `workers/lib/llm/prompt-cache.ts:24-26` (TODO + mock). O módulo atualmente é dead code (não importado).
- [PASS] Não há loops que geram N chamadas quando deveriam gerar 1 — function calling loop tem `MAX_ROUNDS = 12` como limite. Evidência: `workers/lib/llm/gemini-client.ts:360`
- [PASS] `llm_calls` está sendo populada com `cost_usd` real — `calcCost()` usa tokens reais da resposta. Evidência: `workers/lib/llm/gemini-client.ts:391-407`
- [WARN] Custo de embeddings ausente de `llm_calls` — ver item acima. Sem dados de custo de embedding no dashboard.

### 3.4 Segurança de dados

- [FAIL][CRÍTICO] `gen-lang-client-0451612038-69834d97606d.json` presente na raiz do projeto com **private key do Google Service Account**. Evidência: arquivo `gen-lang-client-0451612038-69834d97606d.json` encontrado em `glob *.json`. Contém `private_key`, `client_email`, `project_id`. Se este arquivo estiver no git (sem `.gitignore`), a chave está vazada publicamente.
- [WARN] `.env` com credenciais reais (SUPABASE_SERVICE_KEY, GEMINI_API_KEY) — esperado em desenvolvimento, mas deve constar no `.gitignore`. Não verificado se está no `.gitignore` (sem acesso a git neste repositório sem histórico git).
- [PASS] SQL injection em reference resolver — `resolveProductByName()` usa parameterized queries via Supabase client (`.ilike()`, `.eq()`), não concatenação de strings. Evidência: `frontend/lib/jarvis/reference-resolver.ts:93-127`
- [WARN] RLS ausente em tabelas sem `user_id` direto (`tasks`, `copy_components`, `copy_combinations`) — acesso lateral via `pipeline_id` não protegido em nível de banco. Evidência: `migrations/v2/0001_custom_triggers_rls.sql` — só `pipelines` e `conversations` têm RLS.

### 3.5 Testes

- [FAIL][BAIXO] Nenhum teste para o planner cobrindo 5 goals × 3 estados de cache. O arquivo `frontend/lib/jarvis/__tests__/planner.test.ts` existe mas usa framework custom (não Jest/Vitest) e não foi validado com `pnpm test` (servidor offline). Evidência: glob retornou apenas este arquivo como teste do projeto (excluindo node_modules).
- [FAIL][BAIXO] Nenhum teste para tagging — `lib/tagging.ts` não existe, logo não há testes. Evidência: ausência de arquivo.
- [FAIL][MÉDIO] Nenhum teste para circuit breaker — evidência: ausência em `glob **/*.test.ts`.
- [FAIL][MÉDIO] Nenhum teste para trigger `copy_combinations` — evidência: ausência em `glob **/*.test.ts`.
- [N/A] `pnpm test` não executado — servidor offline, output não pode ser anexado.

### 3.6 UX quebrado que "passa no lint"

> N/A — servidor não rodando. Verificações visuais não realizadas.

### 3.7 Débito técnico introduzido

- [WARN] `workers/lib/llm/prompt-cache.ts` — arquivo morto (dead code, não importado em nenhum lugar do projeto) com implementação mock e SDK alternativo. Confunde leitores do código. Evidência: grep por `import.*prompt-cache` em `workers/` retornou apenas referências internas ao próprio arquivo.
- [WARN] `backend/` com venv Python completo — 100+ arquivos desnecessários. Não é dead code gerenciável, é um ambiente de runtime ativo que ocupa espaço e cria confusão sobre qual stack está ativa.
- [PASS] Sem imports `// unused` ou `// TODO remove` detectados no código principal.
- [WARN] `console.log` em `workers/task-runner.ts` (múltiplas linhas: 132, 161, 176, 182, 193, 233, 240, 247) e `workers/lib/seed-next-task.ts:48` — aceitáveis como logging operacional, mas sem structured logging (JSON) que facilitaria parsing em produção.
- [WARN] TODO crítico: `workers/lib/llm/prompt-cache.ts:24` — "TODO: Invocar api nativa de cache ContextCaches do GoogleGenAI". Este TODO bloqueia economia de custo se o módulo for integrado.

---

## Top 10 ações prioritárias

1. **[CRÍTICO]** `gen-lang-client-0451612038-69834d97606d.json` com private key Google Service Account exposta — verificar se está no `.gitignore` e no git history; revogar e regenerar a chave imediatamente. Arquivo na raiz do projeto.

2. **[CRÍTICO]** `workers/lib/embeddings/gemini-embeddings.ts:13` — usa SDK Gemini diretamente (`@google/genai`), violando Regra 18. Custo de embeddings não rastreado em `llm_calls`. Migrar chamadas de embedding para `gemini-client.ts` ou criar `callEmbedding()` dedicado que loga em `llm_calls`.

3. **[CRÍTICO]** `lib/tagging.ts` não existe — criar `frontend/lib/tagging.ts` com funções `generateTag()` e regex de validação `TAG_PATTERN`. Toda geração de tag inline (ex: `workers/agents/copy-hook-generator.ts`) deve usar este módulo. Adicionar teste unitário com regex.

4. **[CRÍTICO]** `workers/lib/llm/prompt-cache.ts` — implementação mock com TODO. Ou implementar caching real via `GoogleAICacheManager` (já implementado em `gemini-client.ts:192-209`!) ou deletar o arquivo. Se mantido, conectar ao `gemini-client.ts` para não duplicar lógica.

5. **[ALTO]** `workers/agents/video-maker.ts:95-103` — adicionar limite de 5 vídeos por execução. Inserir `const MAX_VIDEOS = 5; if (combinations.length > MAX_VIDEOS) throw ...` ou criar approval `video_limit_exceeded` antes do loop.

6. **[ALTO]** `niche_curator` no AGENT_REGISTRY — PRD especifica 6 agentes. Mover `niche_curator` para um registro separado (ex: `MAINTENANCE_REGISTRY`) fora do `AGENT_REGISTRY`, e atualizar `AgentName` type para excluí-lo. Garantir que o planner não tente incluí-lo em pipelines de produto.

7. **[ALTO]** `backend/` Python ativo não arquivado — adicionar `backend/.v2-archived` ou nota no README raiz indicando que o backend Python é legado v1. Considerar mover o venv para `.gitignore` para reduzir o repositório.

8. **[MÉDIO]** RLS incompleto — habilitar RLS em `tasks`, `copy_components`, `copy_combinations`, `product_knowledge`, `llm_calls`, `embeddings`, `messages` via migration `migrations/v2/0004_rls_remaining_tables.sql`. CLAUDE.md Regra 4.

9. **[MÉDIO]** Merge JSONB em `pipeline.state` — implementar Regra 3 do CLAUDE.md. No task-runner, substituir UPDATE SET `state = $novo_state` por `state = state || $partial::jsonb` para evitar sobrescrita total sob concorrência.

10. **[MÉDIO]** `migrations/0000_gifted_lyja.sql` na raiz de `migrations/` (não em `v2/`) — verificar se este arquivo está sendo aplicado no banco (seria duplicação de tabelas). Se for um artefato do `drizzle generate` mal configurado, deletar e reconfigurar `drizzle.config.ts` para output em `migrations/v2/` apenas.
