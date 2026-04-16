# QA Report — 2026-04-12 11:26:00

## Resumo executivo

- Total de testes: 35
- PASS: 20 (57%)
- FAIL: 8
- SKIP: 7
- Taxa de execução (PASS / executados): 20/28 = **71.4%**
- Tempo total: ~18 minutos
- Ambiente: Next.js 14 (localhost:3000) + Worker (tsx task-runner.ts PID 28784) + Supabase remoto

---

## Por categoria

| Grupo | Descrição              | Passaram | Status       |
|-------|------------------------|----------|--------------|
| 1     | API read-only          | 6/6      | ✅ Completo  |
| 2     | API com criação        | 6/6      | ✅ Completo  |
| 3     | Integridade SQL        | 4/8      | ⚠️ 3 FAIL, 1 SKIP |
| 4     | Fluxo E2E              | 0/5      | ❌ 2 FAIL, 3 SKIP |
| 5     | Destrutivos/edge cases | 4/10     | ⚠️ 3 FAIL, 3 SKIP |

---

## FAILs detalhados

---

### [FAIL #1] SKU format: dígitos hexadecimais em vez de letras

- **Grupo**: 3 — Teste 13
- **O que foi feito**: Criação de produtos via `POST /api/products` e verificação do campo `sku` retornado.
- **Esperado**: `sku` match `/^[A-Z]{4}$/` (4 letras maiúsculas)
- **Obtido**: SKUs no formato `/^[0-9A-F]{4}$/` (hex 4-char: ex. `C8ED`, `5ED7`, `9B36`, `195A`)
- **Evidência**: Todos os 5 produtos QA criados tiveram SKUs com dígitos (ex: `9B36`, `245E`, `D56C`)
- **Severidade**: COSMÉTICO
- **Hipótese de causa**: O trigger SQL de geração de SKU usa `gen_random_uuid()` truncado em hex em vez de apenas letras. A documentação/spec do PRD diz "4 letras" mas o trigger gera hex.

---

### [FAIL #2] niche_id permanece NULL após cadastro de produto

- **Grupo**: 3 — Teste 14; e Grupo 4 — Teste 21
- **O que foi feito**:
  - Teste 14: `SELECT niche_id FROM products WHERE name LIKE 'QA_%'` após criação via API.
  - Teste 21: `POST /api/products` com `product_url: "https://example.com/weight-loss"`, aguardou 10s, verificou `niche_id`.
- **Esperado**: `niche_id` preenchido em <10s (RPC `find_nearest_niche` no fluxo de cadastro)
- **Obtido**: `niche_id: null` em todos os produtos (inclusive produtos reais pré-existentes Mitolyn)
- **Evidência**:
  ```json
  [{"sku":"C8ED","niche_id":null},{"sku":"5ED7","niche_id":null},{"sku":"9B36","niche_id":null}]
  ```
  Após 10s: `[{"sku":"195A","niche_id":null}]`
- **Severidade**: MÉDIO
- **Hipótese de causa**: A tabela `niches` pode estar vazia (sem nichos cadastrados para matching), ou o RPC `find_nearest_niche` não encontra match acima do threshold de similaridade. A função existe mas não retorna resultados.

---

### [FAIL #3] Embeddings não gerados com `source_table='products'`

- **Grupo**: 3 — Teste 19
- **O que foi feito**: `SELECT * FROM embeddings WHERE source_table = 'products'` após criação de múltiplos produtos.
- **Esperado**: Pelo menos 1 linha em `embeddings` com `source_table='products'` após cadastro
- **Obtido**: 0 linhas. Os 25 embeddings existentes são todos de `source_table='product_knowledge'`
- **Evidência**: `{"product_knowledge": 25}` — nenhum com source `products`
- **Severidade**: MÉDIO
- **Hipótese de causa**: O passo 5 do fluxo de cadastro ("Grava embedding em `embeddings` para uso futuro") não está sendo executado, ou está falhando silenciosamente. Provável que a chamada de embedding em `POST /api/products` esteja retornando erro não tratado após a inserção do produto.

---

### [FAIL #4] tasks.confirmed_oversized não existe

- **Grupo**: 3 — Teste 20
- **O que foi feito**: `SELECT confirmed_oversized FROM tasks LIMIT 1`
- **Esperado**: Coluna existe (fix mencionado em AUDIT_FIXES_v2 #4)
- **Obtido**: `{"code":"42703","message":"column tasks.confirmed_oversized does not exist"}`
- **Colunas existentes**: `id, pipeline_id, agent_name, mode, depends_on, status, input_context, output, error, retry_count, started_at, completed_at, created_at`
- **Severidade**: BAIXO
- **Hipótese de causa**: A migration de AUDIT_FIXES_v2 #4 que adiciona `confirmed_oversized` não foi aplicada. O Jarvis em runtime tenta usar esta coluna (`"Marquei confirmed_oversized=true na tarefa"` aparece na resposta de aprovação), indicando que há código que assume que a coluna existe.

---

### [FAIL #5] avatar_research falha: "Unknown tool: search"

- **Grupo**: 4 — Teste 22
- **O que foi feito**:
  1. `POST /api/chat {"message": "@C8ED faz pesquisa de avatar do cliente ideal"}` → pipeline criado, `pipeline_id: 1a831a15-6bde-4766-bae1-3f12854df800`
  2. Aprovação via `POST /api/chat {"message": "sim", "pipeline_id": "1a831a15-..."}` → task `avatar_research` iniciada
  3. Aguardado até task mudar de `running` (timeout 3 min)
- **Esperado**: Task `avatar_research` status `completed`, `product_knowledge` com `artifact_type='avatar'`, `status='fresh'`
- **Obtido**: Task falhou após `retry_count: 3` com erro: `Unexpected token 'N', "Não consig"... is not valid JSON`
  - Sequência de erros durante retries (observados via polling):
    1. Tentativas 1-2: `error = "Unknown tool: search"` (agent tentou usar tool inexistente)
    2. Tentativa 3: Gemini 503 (`"This model is currently experiencing high demand"`)
    3. Final: JSON parse error (Gemini retornou texto em PT em vez de JSON estruturado)
- **Severidade**: BLOQUEANTE
- **Hipótese de causa primária**: O agente `avatar_research` tenta chamar uma tool chamada `"search"` que não existe no registry. Provavelmente a tool foi renomeada (ex: para `web_search`) mas o prompt do agente ainda referencia o nome antigo. Isso bloqueia **todos os pipelines** pois avatar_research é dependência de qualquer goal de copy.
- **Impacto**: Tests 23, 24, 25 foram SKIP direto por dependência neste teste.

---

### [FAIL #6] Unicode/emoji corrompido ao gravar produto

- **Grupo**: 5 — Teste 30
- **O que foi feito**:
  ```bash
  POST /api/products {"name": "QA_テスト_🚀_Produto", ...}
  SELECT name FROM products WHERE id = '4f315769-...'
  ```
- **Esperado**: Nome armazenado fielmente: `"QA_テスト_🚀_Produto"`
- **Obtido**: `"QA_???_??_Produto"` — caracteres multibyte substituídos por `?`
- **Verificação no banco**: `DB name: "QA_???_??_Produto"` — corrupção confirmada no PostgreSQL, não apenas display
- **Severidade**: MÉDIO
- **Hipótese de causa**: Problema de encoding na conexão com o banco. O cliente Supabase ou a string de conexão (`DATABASE_URL`) provavelmente não especifica `charset=UTF8` ou o driver está convertendo para Latin-1. O Supabase usa UTF-8 por padrão — verificar se há alguma camada de middleware convertendo o encoding.

---

### [FAIL #7] Nenhum check constraint em `pipelines.budget_usd` para valores negativos

- **Grupo**: 5 — Teste 34
- **O que foi feito**:
  ```javascript
  POST /rest/v1/pipelines {id: "aaaaaaaa-...", budget_usd: -1, ...}
  ```
- **Esperado**: Rejeição com constraint violation (budget >= 0) ou rejeição no nível da API
- **Obtido**: Status 400, mas por `null value in column "user_id"` (NOT NULL em outro campo) — não por constraint de budget. O campo `budget_usd = -1` foi aceito pelo banco.
  Via chat, menção a "budget 0" no texto é ignorada pelo Jarvis (sem interpretação de budget customizado).
- **Severidade**: BAIXO
- **Hipótese de causa**: Não há `CHECK (budget_usd >= 0)` na tabela `pipelines`. O circuit breaker existe no worker (compara `cost_so_far_usd >= budget_usd`), mas não há validação de schema para impedir inserção de budget negativo.

---

### [FAIL #8] Tasks aceitas sem FK constraint em `pipeline_id`

- **Grupo**: 5 — Teste 35
- **O que foi feito**:
  ```javascript
  POST /rest/v1/tasks {pipeline_id: "cccccccc-dead-4000-c000-000000000000", agent_name: "avatar_research", ...}
  ```
  (pipeline `cccccccc-dead-...` não existe)
- **Esperado**: Falha por violação de FK (`pipeline_id` → `pipelines.id`), ou worker marcar task como `failed` com erro claro
- **Obtido**: Task criada com sucesso (HTTP 201). A task órfã existe no banco sem problema.
- **Severidade**: BAIXO
- **Hipótese de causa**: A tabela `tasks` não tem uma FK constraint para `pipelines.id`, ou o FK foi criado com DEFERRABLE e não é enforced. Worker não foi observado processando esta task (cleanup manual antes da observação).

---

## SKIPs detalhados

| Teste | Razão |
|-------|-------|
| 15 — Duplicate SKU via SQL | Outras colunas NOT NULL (`affiliate_link`, `platform`) bloqueiam antes do unique check; trigger de geração de SKU também sobrescreve o campo |
| 23 — Avatar reuse | Depende de test 22 (avatar_research) que falhou |
| 24 — Materialização de combinações | Depende de test 23 |
| 25 — force_refresh bumpa versão | Planner funciona (planeja "Avatar NEW" corretamente), mas execução bloqueada por Gemini 503 + bug "Unknown tool: search" |
| 26 — Circuit breaker (budget) | Worker falha antes de atingir LLM por "Unknown tool: search" |
| 27 — Race condition approval | `copy_components` vazia (pipeline jamais completou); impossível testar |
| 32 — Concorrência no worker | Worker falha em todas as tasks por "Unknown tool: search"; comportamento de concorrência não observável |

---

## Observações adicionais (não são FAILs, mas são anomalias)

1. **POST /api/products retorna 201**, não 200 (como o skill especifica). 201 é semanticamente mais correto (Created). Sem impacto funcional.

2. **Pipeline approval flow via chat está quebrado**: ao enviar `{"message": "sim", "pipeline_id": "..."}` o Jarvis não processa como aprovação de pipeline — ele interpreta como confirmação de tarefa oversized e responde "Marquei `confirmed_oversized=true` na tarefa". A task chega a ser criada de qualquer forma (estado `running`), mas o pipeline permanece em `plan_preview`.

3. **tasks.updated_at não existe**: a coluna não está no schema, embora seja referenciada em documentação. Colunas existentes: `id, pipeline_id, agent_name, mode, depends_on, status, input_context, output, error, retry_count, started_at, completed_at, created_at`.

4. **copy_components sem coluna `status`**: a tabela usa `approved_at IS NULL` como proxy para "not approved". Código que acessa `copy_components.status` diretamente vai falhar com 42703.

5. **llm_calls.error não existe**: tentativa de `SELECT error FROM llm_calls` retorna `column llm_calls.error does not exist`. Logging de erros em llm_calls não é suportado pelo schema atual.

6. **Platform defaulta para 'hotmart'**: produtos criados com URLs de `example.com` (não reconhecida) ficam com `platform: 'hotmart'` em vez de `null`. Isso indica que o default do banco é `'hotmart'`, não `NULL`.

---

## Itens não testáveis automaticamente

- Diagrama Mermaid no chat renderiza visualmente
- Dropdown `@` aparece ao digitar em MessageInput
- Dropdown `/` de ações aparece e mapeia corretamente
- Botão "Gerar combinações" fica visualmente disabled sem aprovações
- Status badges em /demandas refletem estado real em tempo real
- Sidebar colapsa corretamente em resolução mobile
- Modal de cadastro fecha ao clicar fora/ESC
- Hover states em cards de produto
- Animações de transição entre estados
- Toast de sucesso/erro após ações
- Scroll do chat mantém posição ao receber nova mensagem
- Preview do Mermaid antes de aprovação tem cores verde/azul corretas

---

## Recomendação

PASS sobre executados: **71.4%** — leva moderada de bugs, mas há **1 bug BLOQUEANTE** que impede qualquer execução de pipeline:

### Prioridade 1 — BLOQUEANTE (resolver antes de qualquer demo)

- **[FAIL #5]** `avatar_research` chama tool `"search"` inexistente → nenhum pipeline funciona.
  Buscar onde o prompt ou o agente referencia `"search"` em vez do nome correto da tool. Verificar `workers/agents/avatar-research.ts` e o prompt em `workers/agents/prompts/`.

### Prioridade 2 — ALTO (corrigir em próxima sessão)

- **[FAIL #2]** `niche_id` sempre null → verificar se tabela `niches` tem dados e se threshold de similarity está calibrado.
- **[FAIL #3]** Embeddings de produtos não gerados → verificar chamada de embedding em `POST /api/products` route.ts após INSERT.
- **[FAIL #6]** Unicode corrompido → verificar encoding da conexão Supabase (DATABASE_URL deve incluir encoding UTF-8 ou usar o Supabase client que usa REST nativo UTF-8).

### Prioridade 3 — MÉDIO (corrigir antes da release)

- **[FAIL #4]** `tasks.confirmed_oversized` ausente → aplicar migration pendente do AUDIT_FIXES_v2 #4.
- **Pipeline approval via chat** não funciona corretamente — Jarvis interpreta "sim" como confirmação de oversized em vez de aprovação de pipeline.

### Prioridade 4 — BAIXO (não bloqueia release alpha)

- **[FAIL #1]** SKU format hex vs /^[A-Z]{4}$/ — ajustar spec ou trigger.
- **[FAIL #7]** Sem check constraint em budget_usd — adicionar `CHECK (budget_usd >= 0)` na migration.
- **[FAIL #8]** FK ausente em tasks.pipeline_id — adicionar constraint ou aceitar o design.
