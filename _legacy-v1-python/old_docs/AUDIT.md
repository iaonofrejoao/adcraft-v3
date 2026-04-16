# AUDIT.md — Auditoria Final AdCraft v2

**Objetivo:** confirmar que a implementação atual está fiel ao `PRD_v2.md`, ao `CLAUDE_v2.md` e ao `PLANO_EXECUCAO_v2.md`, sem lacunas, regressões ou atalhos.

**Modo de operação:** você é o auditor. **NÃO corrija nada nesta execução — apenas reporte.** Gere `AUDIT_REPORT.md` na raiz do projeto com os resultados. Para cada item, marque **PASS / FAIL / WARN / N/A** + evidência concreta (caminho:linha, query SQL executada, ou output de comando).

**Leitura obrigatória antes de começar:**
- `PRD_v2.md` (especialmente seções 4, 6, 7, 9, 10)
- `CLAUDE_v2.md` (todas as 19 regras)
- `MIGRATION_GUIDE.md`

---

## Camada 1 — Conformidade estática

### 1.1 Estrutura de pastas
- [ ] `workers/`, `lib/`, `app/`, `components/`, `migrations/v2/` existem
- [ ] Frontend v1 foi removido: nenhum import de `reactflow`, `zustand`, `@reactflow/*` em arquivos ativos
- [ ] `backend/` existe apenas como referência (marcado com `.v2-archived` ou nota no README)
- [ ] `prompts/_archive/v3-future/` contém os 10 arquivos listados no MIGRATION_GUIDE

### 1.2 Banco de dados
Execute queries SQL contra o Supabase:
- [ ] `create extension vector` aplicada
- [ ] Todas as 12 tabelas novas existem: `pipelines`, `tasks`, `approvals`, `copy_components`, `copy_combinations`, `product_knowledge`, `niche_learnings`, `embeddings`, `conversations`, `messages`, `prompt_caches`, `llm_calls`
- [ ] `products.sku` existe, é `char(4)`, tem índice UNIQUE, tem trigger de geração
- [ ] `copy_combinations` tem trigger que bloqueia INSERT se componentes não aprovados
- [ ] `embeddings` tem índice HNSW `using hnsw (embedding vector_cosine_ops)`
- [ ] RLS ativado em toda tabela com `user_id`
- [ ] Coluna `embedding` em `embeddings` é `vector(768)` (não 1536)

### 1.3 Capability Registry (regra 14)
- [ ] Arquivo `workers/lib/agent-registry.ts` existe
- [ ] Contém os 6 agentes da v2 (avatar_research, market_research, angle_generator, copy_hook_generator, anvisa_compliance, video_maker) — nem mais, nem menos
- [ ] Cada entry tem: `requires`, `produces`, `cacheable`, `freshness_days`, `model`, `max_input_tokens`
- [ ] `copy_hook_generator` tem `modes: ['full','hooks_only','bodies_only','ctas_only']`
- [ ] Nenhum agente arquivado (scaler, media_buyer_*, etc) está no registry

### 1.4 Planner dinâmico (regra 14)
- [ ] `lib/jarvis/planner.ts` existe e implementa `planPipeline(goal, product_id, force_refresh?)`
- [ ] `lib/jarvis/dag-builder.ts` existe com cycle detection
- [ ] Grep por sequência hardcoded:
  ```bash
  grep -rn "task_1.*task_2\|avatar.*market.*angle" workers/ lib/ app/
  ```
  não deve retornar nenhum DAG hardcoded
- [ ] Renderer Mermaid existe e marca `reused` em verde, `new` em azul

### 1.5 Cliente LLM único (regra 18)
- [ ] `lib/llm/gemini-client.ts` existe
- [ ] `grep -rn "@google/genai\|GoogleGenerativeAI" --include="*.ts"` retorna APENAS imports dentro de `lib/llm/` — nenhum outro arquivo chama Gemini direto
- [ ] `callAgent()` lê modelo do registry, não hardcoda
- [ ] `callAgent()` faz prompt caching via tabela `prompt_caches`
- [ ] `callAgent()` loga em `llm_calls` com tokens + custo
- [ ] `callAgent()` verifica circuit breaker antes de chamar (regra 19)

### 1.6 Knowledge Layer (regra 15)
- [ ] `lib/knowledge/product-knowledge.ts` existe
- [ ] `writeArtifact()` usa transação Postgres (não escritas sequenciais)
- [ ] Escrita em `pipeline.state` e `product_knowledge` são atômicas
- [ ] `enqueueEmbedding()` é chamado na mesma transação
- [ ] Frescor por tipo respeitado: avatar 60d, market 30d, angles 30d

### 1.7 Tagging (regra 16)
- [ ] `lib/tagging.ts` existe
- [ ] Padrão: `SKU_v{N}_H{n}`, `SKU_v{N}_B{n}`, `SKU_v{N}_C{n}`, `SKU_v{N}_H{n}_B{n}_C{n}`, `SKU_v{N}_H{n}_B{n}_C{n}_V{n}`
- [ ] Colunas `tag` em `copy_components`, `copy_combinations`, `assets` são `UNIQUE NOT NULL`
- [ ] Teste unitário que verifica formato por regex existe

### 1.8 copy_hook_generator
- [ ] Prompt `prompts/copy_hook_generator.md` matches o entregue (output 3+3+3, 4 modos, registros emocionais)
- [ ] Handler TypeScript aceita parâmetro `mode` e respeita os 4 valores
- [ ] Modo parcial recebe componentes aprovados no contexto (coerência)
- [ ] Output é JSON estruturado com `slot`, `register`/`structure`/`intensity`, `rationale`, `angle_id`

### 1.9 Aprovação por componente (regras 9, 10, 11)
- [ ] Tela `/products/[sku]/copies` existe com 3 colunas
- [ ] Botões Aprovar/Rejeitar por card
- [ ] Botão "Gerar combinações" só ativo quando ≥1 aprovado em cada coluna
- [ ] Endpoint `POST /api/copy-components/[id]/approve` existe
- [ ] Endpoint `POST /api/products/[sku]/materialize-combinations` existe
- [ ] `video_maker` só roda em combinações com `selected_for_video=true`

### 1.10 Niche Intelligence
- [ ] `lib/knowledge/niche-learnings.ts` existe
- [ ] `learning-injector.ts` faz query híbrida (filter + pgvector `<=>`)
- [ ] Worker de embedding em batch existe e é lazy (só embeda `confidence >= 0.5`)
- [ ] Classificação automática de nicho acontece no **cadastro** de produto, NÃO como task de pipeline
- [ ] Cron diário do `niche_curator` configurado

### 1.11 Cost optimization (regras 17, 18, 19)
- [ ] Model routing: Jarvis/compliance/curator/video_maker usam Flash; avatar/market/angle/copy usam Pro
- [ ] `pipelines.budget_usd` e `cost_so_far_usd` existem
- [ ] Circuit breaker lança erro e pausa pipeline quando estoura
- [ ] Defaults por goal respeitados (avatar $0.30, market $0.30, angles $1.00, copy $2.00, creative_full $8.00)
- [ ] Hard limit de 5 vídeos por execução de `video_maker` sem confirmação extra

### 1.12 Reference resolution
- [ ] `lib/jarvis/reference-resolver.ts` existe
- [ ] Parser de `@` busca produtos por SKU exato e nome fuzzy
- [ ] Parser de `/` mapeia ações pra goals
- [ ] Componente `MentionPicker.tsx` existe
- [ ] Ambiguidade retorna `{ ambiguous: true, candidates: [...] }`

### 1.13 Prompts
- [ ] 5 prompts v1 íntegros: `persona_builder`, `market_researcher`, `angle_strategist`, `compliance_checker`, `product_analyzer`
- [ ] Prompt Jarvis existe em `prompts/jarvis.md`
- [ ] Prompt `niche_curator` existe
- [ ] `copy_hook_generator` substituiu `copy_writer`

---

## Camada 2 — Validação comportamental

Essas verificações exigem execução real. Se o servidor estiver parado, levante (workers + Next.js) antes de rodar.

### 2.1 Fluxo completo `copy_only`
1. Criar produto novo via API `POST /api/products` com URL de uma landing page real
2. Confirmar que SKU foi gerado (4 letras)
3. Confirmar que nicho foi classificado automaticamente (query em `products.niche_id`)
4. Pedir via chat: `"faz copy pra @{SKU}"`
5. Confirmar que Jarvis retornou plano Mermaid com 4 nós azuis (avatar, market, angle, copy)
6. Aprovar plano
7. Esperar execução. Confirmar em `llm_calls` que chamadas foram feitas com modelos corretos
8. Ir pra `/products/{SKU}/copies` e confirmar 9 componentes visíveis
9. Aprovar 2 hooks, 2 bodies, 2 CTAs. Rejeitar o resto.
10. Clicar "Gerar combinações"
11. Confirmar que `copy_combinations` tem 8 linhas (2×2×2) com tags corretas
12. Tentar inserir manualmente combinação com componente rejeitado — trigger SQL deve bloquear

### 2.2 Teste de reaproveitamento
1. Pedir via chat: `"faz outra copy pra @{SKU}"` (mesmo produto)
2. Confirmar que Mermaid mostra avatar/market/angle em **VERDE** (reused)
3. Confirmar em `llm_calls` que só `copy_hook_generator` foi chamado

### 2.3 Teste de `force_refresh`
1. Pedir: `"refaz o avatar de @{SKU}"`
2. Confirmar em `product_knowledge` que registro antigo está `superseded`
3. Confirmar que `product_version` incrementou

### 2.4 Teste do circuit breaker
1. Criar pipeline com budget artificialmente baixo ($0.10)
2. Tentar rodar `copy_only`
3. Confirmar que pausou com approval `budget_exceeded`
4. Confirmar que Jarvis notificou

### 2.5 Teste do `niche_curator`
1. Rejeitar 3+ hooks do mesmo padrão em produtos do mesmo nicho
2. Rodar `niche_curator` manualmente
3. Confirmar que um learning foi criado em `niche_learnings` com `confidence >= 0.3`
4. Confirmar que embedding foi gerado (após lazy threshold atingido)

### 2.6 Teste de cache Gemini
1. Rodar `avatar_research` em 2 produtos do mesmo nicho na mesma hora
2. Confirmar em `llm_calls` que segunda chamada tem `cached_input_tokens > 0`

### 2.7 Teste de menção `@`
1. No chat, digitar `@` — confirmar dropdown aparece
2. Selecionar produto — confirmar chip renderiza
3. Enviar mensagem — confirmar backend recebe referência resolvida

### 2.8 Modo parcial do `copy_hook_generator`
1. Rejeitar todos os hooks aprovando bodies e CTAs
2. Pedir "gera mais 3 hooks pra @{SKU}"
3. Confirmar em `llm_calls` que chamada foi feita em modo `hooks_only`
4. Confirmar que custo da chamada é ~1/3 do modo `full`
5. Confirmar que bodies e CTAs não foram regerados

---

## Camada 3 — Análise crítica

Aja como revisor cético experiente. Para CADA ponto abaixo, procure ativamente por problemas. É melhor reportar falso positivo do que deixar bug passar.

### 3.1 Race conditions
- Dois workers podem pegar a mesma task? (verificar `FOR UPDATE SKIP LOCKED`)
- Dois users aprovando mesmo componente simultaneamente?
- Merge JSONB em `pipeline.state` é atômico ou pode sobrescrever?
- Materialização de combinações roda 2x simultâneas? Deduplicação por tag?

### 3.2 Desvios silenciosos do PRD
- Existe algum lugar onde o código "funciona" mas diverge do espírito da spec?
- Há hardcode de modelo, budget, ou dependência de agente em algum lugar?
- Algum goal foi implementado diferente do catálogo (5 goals fechados)?
- Algum agente gera output em formato diferente do declarado no prompt?

### 3.3 Custo vazando
- Existe alguma chamada LLM fora do `gemini-client.ts`?
- Existe geração de embedding eager (não lazy) em algum lugar?
- Existe algum loop que pode gerar N chamadas quando deveria gerar 1?
- O prompt caching realmente está reduzindo tokens ou só registrando entries em `prompt_caches`?
- `llm_calls` está populada com `cost_usd` real ou zerado?

### 3.4 Segurança de dados
- Credenciais em código-fonte? (`grep -rn "AIza\|sk-\|supabase.*anon.*key"` — exceto `.env.example`)
- RLS realmente bloqueia acesso cross-user? (mesmo sendo single-user, teste)
- SQL injection em queries dinâmicas (especialmente reference resolver)?
- URLs do usuário em webhooks/chamadas externas são validadas?

### 3.5 Testes
- Existem testes pro planner (5 goals × 3 estados de cache)?
- Existem testes pro tagging (formato, uniqueness, versionamento)?
- Existem testes pro circuit breaker?
- Existem testes pro trigger de `copy_combinations`?
- Cobertura real — não só "arquivo existe" — rodar `pnpm test` e anexar output

### 3.6 UX quebrado que "passa no lint"
- Tela de copies renderiza com 0 componentes sem mensagem?
- Plano Mermaid com 1 nó só (`avatar_only`) renderiza corretamente?
- Chat mantém histórico ao recarregar?
- SSE reconecta após queda de rede?
- Aprovar último componente libera botão "Gerar combinações" sem refresh manual?

### 3.7 Débito técnico introduzido
- Arquivos não usados que deveriam ter sido removidos
- Imports mortos (`grep -rn "// unused\|// TODO remove"`)
- `console.log` esquecidos em produção
- TODOs e FIXMEs pendentes com prazo
- Dependências instaladas mas não usadas (`depcheck`)

---

## Formato obrigatório do `AUDIT_REPORT.md`

```markdown
# AUDIT REPORT — AdCraft v2
Data: YYYY-MM-DD
Auditor: Claude Code

## Resumo executivo
- Itens verificados: X
- PASS: X
- FAIL: X (crítico: X, alto: X, médio: X, baixo: X)
- WARN: X
- N/A: X

## Camada 1 — Conformidade estática

### 1.1 Estrutura de pastas
- [PASS] workers/ existe — evidência: `ls workers/` retornou task-runner.ts, lib/, agents/
- [FAIL] frontend ainda importa reactflow — evidência: components/old/Canvas.tsx:3
...

### 1.2 Banco de dados
...

## Camada 2 — Validação comportamental
...

## Camada 3 — Análise crítica
...

## Top 10 ações prioritárias
1. [CRÍTICO] {descrição} — {arquivo:linha} — {sugestão sucinta}
2. [CRÍTICO] ...
3. [ALTO] ...
...
```

**Severidade:**
- **CRÍTICO:** sistema não funciona, vaza dinheiro, ou expõe dados
- **ALTO:** feature importante quebrada ou divergência grave do PRD
- **MÉDIO:** funciona mas mal, débito técnico visível
- **BAIXO:** cosmético, cleanup

---

## Regras finais pro auditor

1. **Não corrija nada.** Apenas reporte.
2. **Evidência concreta obrigatória.** Não aceite "parece ok" — cite caminho:linha, query executada, ou output de comando.
3. **Na dúvida, marque WARN, não PASS.** Falso positivo é pior que falso negativo.
4. **Se não conseguir executar algo (ex: banco fora do ar), marque N/A com motivo.** Não invente resultado.
5. **Seja sucinto.** Cada item em 1-3 linhas. Detalhes vão na seção de ações prioritárias.
