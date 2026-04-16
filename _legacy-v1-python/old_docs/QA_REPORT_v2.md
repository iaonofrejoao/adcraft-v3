# QA Report v2 — 2026-04-12 13:12:00

> Segunda rodada de QA após correções aplicadas. Comparação com `QA_REPORT.md` (rodada 1, 2026-04-12 11:26:00) ao longo do documento.

## Resumo executivo

- Total de testes: 35
- PASS: 24 (68.6%)
- FAIL: 8
- SKIP: 3
- Taxa de execução (PASS / executados): 24/32 = **75.0%** (+3.6 pp vs rodada anterior 71.4%)
- Tempo total: ~46 minutos (incluindo E2E com polling)
- Ambiente: Next.js 14 (localhost:3000) + Worker Node.js (ativo, confirmado por task completion) + Supabase remoto

---

## Por categoria

| Grupo | Descrição | Passaram | Δ vs Rodada 1 |
|-------|-----------|----------|---------------|
| 1 | API read-only | 6/6 | = |
| 2 | API com criação | 6/6 | = |
| 3 | Integridade SQL | 5/7 executados | ↑ (era 4/7, +1) |
| 4 | Fluxo E2E | 1/4 executados | ↑ (era 0/5, +1) |
| 5 | Destrutivos/edge cases | 6/9 executados | ↑ (era 4/7, +2) |

---

## FAILs que foram RESOLVIDOS desde Rodada 1

| # Anterior | Teste | O que foi feito |
|------------|-------|-----------------|
| FAIL #3 | T19 — embeddings source_table='products' | Agora tem registros em `embeddings` com `source_table='products'` após cadastro → **RESOLVIDO** |
| FAIL #4 | T20 — tasks.confirmed_oversized | Coluna existe e retorna `false` por default → **RESOLVIDO** |
| FAIL #5 | T22 — avatar_research "Unknown tool: search" | Pipeline avatar_only completou em ~20s sem erros; task status `completed`, artifact `avatar/fresh` gerado → **RESOLVIDO** |

---

## FAILs detalhados

---

### [FAIL #1] SKU format: dígitos hexadecimais em vez de letras

- **Grupo**: 3 — Teste 13
- **O que foi feito**: Criação de produtos via `POST /api/products` e verificação do campo `sku`.
- **Esperado**: `sku` match `/^[A-Z]{4}$/`
- **Obtido**: SKUs em hex 4-char: `002F`, `2FC4`, `3129`, `0D78`, etc.
- **Evidência**: `node -e "const skus=['002F','2FC4','3129']; const alpha=/^[A-Z]{4}$/; skus.forEach(s=>console.log(s+': alpha='+alpha.test(s)))"` → `alpha=false` para todos
- **Severidade**: COSMÉTICO
- **Status vs Rodada 1**: **PERSISTENTE** (sem mudança)
- **Hipótese de causa**: Trigger SQL usa `gen_random_uuid()` truncado em hex. O PRD diz "4 letras" mas o trigger gera 4 chars hex.

---

### [FAIL #2] niche_id permanece NULL após cadastro de produto

- **Grupo**: 3 — Teste 14 e Grupo 4 — Teste 21
- **O que foi feito**: Criação de produto via API, aguardo de 10s, verificação de `niche_id`.
- **Esperado**: `niche_id` preenchido em <10s
- **Obtido**: `niche_id: null` em todos os produtos QA e produtos reais pré-existentes
- **Evidência**: `SELECT niche_id FROM products WHERE name LIKE 'QA_%'` → `[{"sku":"002F","niche_id":null},{"sku":"2FC4","niche_id":null},{"sku":"3129","niche_id":null}]`
- **Severidade**: MÉDIO
- **Status vs Rodada 1**: **PERSISTENTE** (sem mudança)
- **Hipótese de causa**: Tabela `niches` tem dados (seed foi aplicado), mas RPC `find_nearest_niche` não encontra match acima do threshold para os produtos de teste. Verificar se os produtos de teste têm URLs com conteúdo indexável.

---

### [FAIL #3] Avatar reuse não funciona — planner sempre cria "Avatar NEW"

- **Grupo**: 4 — Teste 23
- **O que foi feito**:
  1. Executou pipeline `avatar_only` para produto `002F` (completou com sucesso — Test 22)
  2. Aguardou 3s, criou pipeline `copy_only` para o mesmo produto `002F`
  3. Verificou plano retornado pelo Jarvis
- **Esperado**: Plano marca avatar como `reused` (ex: `N0["Avatar REUSED"]` no Mermaid)
- **Obtido**: Plano mostra `N0["Avatar NEW"]` com `status:"pending"` — cria task `avatar_research` do zero mesmo com artifact `avatar/fresh` existente no banco para o mesmo produto
- **Evidência**:
  ```json
  {"goal":"copy_only","tasks":[
    {"agent":"avatar_research","status":"pending","produces":["avatar"],...},
    ...
  ],"mermaid":"graph LR\n  N0[\"Avatar NEW\"]\n  ..."}
  ```
  O `product_knowledge` tinha `artifact_type='avatar', status='fresh'` com `created_at` minutos antes.
- **Severidade**: ALTO
- **Status vs Rodada 1**: **NOVO FAIL** (na rodada 1 o teste era SKIP por depender do T22 que falhava)
- **Hipótese de causa**: O planner (`lib/jarvis/planner.ts`) não consulta `product_knowledge` antes de criar tasks, ou a lógica de verificação de cache não está comparando `product_id` corretamente. Buscar por `checkCache` ou `hasFreshArtifact` no planner.

---

### [FAIL #4] force_refresh não detectado + products.product_version inexistente

- **Grupo**: 4 — Teste 25
- **O que foi feito**:
  1. Chat: `"@002F faz pesquisa de avatar novamente, force_refresh=true"`
  2. Verificou pipeline criado: campo `force_refresh` = `false`
  3. Tentou `SELECT product_version FROM products WHERE id = '...'`
- **Esperado**: Pipeline com `force_refresh=true`; após conclusão, `products.product_version` incrementado e artifact antigo marcado `superseded`
- **Obtido**:
  - `force_refresh=false` no pipeline criado — Jarvis não extrai o flag da mensagem
  - `{"code":"42703","message":"column products.product_version does not exist"}` — coluna não existe
- **Severidade**: ALTO
- **Status vs Rodada 1**: **NOVO FAIL** (era SKIP)
- **Hipótese de causa**:
  - Intent classifier não extrai `force_refresh=true` de mensagens em linguagem natural
  - A coluna `product_version` existe em `pipelines` (como visto: `"product_version":3`) mas não em `products`

---

### [FAIL #5] Unicode/emoji corrompido ao gravar produto

- **Grupo**: 5 — Teste 30
- **O que foi feito**: `POST /api/products {"name": "QA_テスト_🚀_Produto", ...}`
- **Esperado**: Nome armazenado fielmente
- **Obtido**: `"QA_???_??_Produto"` — corrupção confirmada na resposta da API e no banco
- **Evidência**: `[{"name":"QA_???_??_Produto"}]`
- **Severidade**: MÉDIO
- **Status vs Rodada 1**: **PERSISTENTE** (sem mudança)
- **Hipótese de causa**: Problema de encoding na conexão com o banco (driver não usando UTF-8). O Supabase usa UTF-8 por padrão — verificar camada de middleware ou configuração de charset na DATABASE_URL.

---

### [FAIL #6] Sem CHECK constraint em `pipelines.budget_usd` para valores inválidos

- **Grupo**: 5 — Teste 34
- **O que foi feito**: `POST /rest/v1/pipelines` com `budget_usd=0` e depois `budget_usd=-1`
- **Esperado**: Rejeição com constraint violation
- **Obtido**: HTTP 201 para ambos — `budget_usd=0` e `budget_usd=-1` são aceitos sem erro
- **Severidade**: BAIXO
- **Status vs Rodada 1**: **PERSISTENTE** (sem mudança)
- **Hipótese de causa**: Não há `CHECK (budget_usd > 0)` na tabela `pipelines`. O circuit breaker no worker impede execução com budget=0, mas o banco aceita inserção de valores inválidos.

---

### [FAIL #7] FK ausente: tasks aceitas com pipeline_id inexistente

- **Grupo**: 5 — Teste 35
- **O que foi feito**: `POST /rest/v1/tasks {"pipeline_id": "cccccccc-dead-4000-c000-000000000000", ...}` (pipeline não existe)
- **Esperado**: HTTP 4xx com violação de FK
- **Obtido**: HTTP 201 — task órfã criada com sucesso
- **Severidade**: BAIXO
- **Status vs Rodada 1**: **PERSISTENTE** (sem mudança)
- **Hipótese de causa**: Coluna `tasks.pipeline_id` não tem FK constraint para `pipelines.id`, ou FK criado com DEFERRABLE.

---

### [FAIL #8] Pipeline tasks iniciam antes de aprovação (plan_preview)

- **Grupo**: Anomalia sistêmica — observada durante T22 e T23
- **O que foi feito**: Chat criou pipeline (status `plan_preview`). Tasks foram criadas e entraram em `running` antes da aprovação via PATCH.
- **Esperado**: Tasks só devem executar após pipeline estar em `pending`
- **Obtido**: Worker processa tasks de pipelines em `plan_preview`. O PATCH para `pending` retornou 200 mas o pipeline já tinha tasks rodando.
- **Severidade**: MÉDIO
- **Status vs Rodada 1**: **NOVO FAIL** (não havia sido detectado antes pois T22 era SKIP)
- **Hipótese de causa**: O worker não filtra pipelines por status antes de pegar tasks. Query de polling busca tasks `pending` sem verificar `pipelines.status`. O seed de tasks pelo chat acontece antes da aprovação humana.

---

## SKIPs detalhados

| Teste | Razão |
|-------|-------|
| T15 — Duplicate SKU via SQL direto | NOT NULL constraint em `affiliate_link` rejeita antes do UNIQUE check. Trigger sobrescreve `sku` em INSERT normal. Comportamento idêntico à Rodada 1. |
| T24 — Materialização de combinações | Pipeline `copy_only` falhou por Gemini 503 (high demand). `copy_components` vazia — impossível testar sem pipeline completo. |
| T27 — Race condition em approval | `copy_components` vazia (nenhum pipeline completou copy). Impossível testar. |

---

## Anomalias (não são FAILs, mas desvios de spec)

1. **`POST /api/products` retorna 201**, não 200 (semanticamente correto — sem impacto)

2. **`llm_calls.error` não existe**: `SELECT error FROM llm_calls` → `42703`. Logging de erros em `llm_calls` não suportado pelo schema.

3. **`copy_components.status` não existe**: A tabela usa `approved_at IS NULL` como proxy. Código que acessa `.status` diretamente falhará.

4. **`tasks.updated_at` não existe**: `SELECT updated_at FROM tasks` → `42703`.

5. **`products.product_version` não existe**: Coluna referenciada no Teste 25; existe em `pipelines` mas não em `products`.

6. **Platform defaulta para 'hotmart'**: URLs não reconhecidas (ex: `example.com`) resultam em `platform='hotmart'`, não `null`.

7. **Task residual de Rodada 1 ainda `running`**: Task `12b7cde3` (avatar_research, criada em 11:18) permanece `running` com erro Gemini 503. Worker não resolveu o estado. Pode consumir slot de concorrência indefinidamente.

8. **Aprovação de pipeline via chat não funciona**: Enviar `{"message":"sim","pipeline_id":"..."}` ao chat faz o Jarvis ignorar a intenção de aprovação e responder com "mencione um produto". A aprovação funciona via `PATCH /api/pipelines/:id {"status":"pending"}`.

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

PASS sobre executados: **75.0%** — melhora em relação à Rodada 1 (71.4%). O bug BLOQUEANTE da rodada anterior (FAIL #5 — Unknown tool: search) foi corrigido com sucesso. O pipeline `avatar_only` agora completa end-to-end em ~20s.

### Prioridade 1 — ALTO (resolver antes de qualquer demo)

- **[FAIL #3]** Avatar reuse: planner cria "Avatar NEW" mesmo com artifact `fresh` no banco.
  → Buscar `checkCache`, `hasFreshArtifact` ou equivalent em `lib/jarvis/planner.ts`. O planner deve consultar `product_knowledge` por `artifact_type + product_id + status='fresh'` antes de criar cada task.

- **[FAIL #8]** Tasks executam antes da aprovação do pipeline (plan_preview → tasks running).
  → Worker deve filtrar `pipeline_id IN (SELECT id FROM pipelines WHERE status='pending')` na query de polling, não apenas `tasks.status='pending'`.

### Prioridade 2 — MÉDIO (corrigir em próxima sessão)

- **[FAIL #2]** `niche_id` sempre null → verificar threshold de similarity no RPC `find_nearest_niche` e se os vetores de embedding dos produtos de teste têm coverage no catálogo de niches.

- **[FAIL #5]** Unicode corrompido → verificar encoding da conexão DATABASE_URL; adicionar `?charset=utf8` ou usar o Supabase client REST nativo que respeita UTF-8.

- **[FAIL #4]** force_refresh não detectado pelo Jarvis:
  - Intent classifier deve extrair `force_refresh: true` de frases como "force_refresh=true" ou "forçar atualização"
  - Verificar se `products.product_version` deveria existir; está no PRD mas ausente no schema

### Prioridade 3 — BAIXO (antes da release)

- **[FAIL #6]** Sem CHECK constraint em `budget_usd` → `ALTER TABLE pipelines ADD CONSTRAINT budget_positive CHECK (budget_usd > 0)`
- **[FAIL #7]** FK ausente em `tasks.pipeline_id` → adicionar `REFERENCES pipelines(id) ON DELETE CASCADE`
- **Anomalia #7** — Task residual `running`: adicionar timeout no worker para tasks presas > 10min

### Prioridade 4 — COSMÉTICO

- **[FAIL #1]** SKU format hex vs `/^[A-Z]{4}$/` — ajustar trigger ou atualizar spec do PRD
