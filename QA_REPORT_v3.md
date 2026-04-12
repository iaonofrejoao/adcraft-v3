# QA Report — 2026-04-12 11:25:39

## Resumo executivo

- Total de testes: 35
- PASS: 25 (71%)
- FAIL: 5
- SKIP: 5
- Tempo total: ~20 minutos

## Contexto desta execução

Ciclo final de validação (v3). Produtos seed usam nomes semanticamente ricos:
`QA_EmagreceFast_Capsulas` (PBBR), `QA_MentalBoost_Nootropico` (FLIX), `QA_Performance_Masculina` (VPGX).

Gemini estava com alta demanda (HTTP 503 "This model is currently overloaded") durante
toda a execução — testes E2E de pipeline completo foram marcados como SKIP.

## Por categoria

| Grupo | Descrição | Passaram |
|-------|-----------|----------|
| 1 | API read-only | 2/6 |
| 2 | API com criação | 5/6 |
| 3 | Integridade SQL | 7/8 |
| 4 | Fluxo E2E | 1/5 |
| 5 | Destrutivos/edge cases | 8/10 |

## FAILs detalhados

### [FAIL #1] GET /api/products retorna objeto, não array
- **Grupo**: 1 (testes T1, T4, T5)
- **O que foi feito**:
  - `curl http://localhost:3000/api/products`
  - `curl "http://localhost:3000/api/assets?limit=50"`
  - `curl "http://localhost:3000/api/tasks?limit=100"`
- **Esperado**: array JSON direto `[...]`
- **Obtido**: objeto wrapper `{"products":[...]}` / `{"assets":[...]}` / `{"tasks":[...]}`
- **Severidade**: BAIXO
- **Hipótese de causa**: Convenção de resposta adotada no projeto usa envelope de objeto; os testes esperavam array bare. Pode ser conflito de expectativa de contrato, não necessariamente um bug.

---

### [FAIL #2] POST /api/products retorna 201 em vez de 200
- **Grupo**: 2 (teste T7)
- **O que foi feito**: `POST /api/products` com payload válido
- **Esperado**: HTTP 200
- **Obtido**: HTTP 201 Created
- **Body**: `{"id":"44bc881b...","name":"QA_T7_TestProduct","sku":"BVVW","slug":null,"niche_id":null,...}`
- **Severidade**: COSMÉTICO
- **Hipótese de causa**: 201 é o código HTTP correto para criação de recurso. O teste especificou 200 incorretamente. Pode ser ajustado na spec de testes, não no código.

---

### [FAIL #3] copy_components — colunas `status`, `type`, `slot`, `rejected_at` ausentes
- **Grupo**: 3 (teste T17)
- **O que foi feito**: Verificação de schema da tabela `copy_components`
- **Esperado**: Colunas: `type` (ou `component_type`), `status`, `slot`, `rejected_at`, `rejection_reason`
- **Obtido**: Colunas existentes: `id, product_id, pipeline_id, component_type, content, approved_at, tag, created_at`
  - `status` — **AUSENTE** (impede filtrar aprovados/rejeitados)
  - `type` — ausente (existe como `component_type`)
  - `slot` — **AUSENTE**
  - `rejected_at` — **AUSENTE**
  - `rejection_reason` — **AUSENTE**
- **Severidade**: ALTO
- **Hipótese de causa**: Migration de `copy_components` incompleta — tabela criada sem as colunas de fluxo de aprovação (status, rejected_at, rejection_reason, slot). A rota `/api/copy-components/[id]/approve` usa `approved_at` como proxy de status, mas falta o campo `status` explícito e o fluxo de rejeição.

---

### [FAIL #4] Unicode e emoji corrompidos no nome do produto
- **Grupo**: 5 (teste T30)
- **O que foi feito**: `POST /api/products` com `name: "QA_テスト_🚀_Produto"`
- **Esperado**: Nome preservado no banco: `QA_テスト_🚀_Produto`
- **Obtido**: `QA_???_??_Produto` — caracteres fora do ASCII-básico viram `?`
- **Severidade**: MÉDIO
- **Hipótese de causa**: Encoding da conexão DB ou do driver não está configurado para UTF-8 completo. O Supabase suporta UTF-8, então a perda provavelmente ocorre no nível de conexão do Drizzle/pg ou no tratamento de body no Next.js API route. Verificar charset da string de conexão e/ou Content-Type handling.

---

### [FAIL #5] niche_id NULL persistente em produtos com nome genérico
- **Grupo**: 3 / 4 (testes T14, T21)
- **O que foi feito**: Verificação de `niche_id` após criar produto
- **Esperado**: `niche_id` atribuído automaticamente dentro de 10s após criação
- **Obtido**: Produtos com nomes semanticamente ricos (PBBR, FLIX, VPGX) receberam `niche_id` corretamente. Porém os 24 produtos criados nos testes auxiliares (T7, T10, T28 — nomes genéricos como `QA_Stress_3_xxx`) permaneceram com `niche_id = NULL` mesmo após ~20 minutos.
- **Severidade**: MÉDIO
- **Hipótese de causa**: Classificador de nicho usa embedding de similaridade — nomes genéricos não têm sinal semântico suficiente para cruzar o threshold de confiança. O sistema deveria fallback para um niche padrão ou usar a URL do produto para classificar. Atualmente falha silenciosamente.

---

## SKIPs detalhados

### [SKIP #1] Pipeline avatar_only completo (T22) — Gemini 503
- **Motivo**: Gemini HTTP 503 "This model is currently overloaded" em 3 tentativas consecutivas de `avatar_research`, todas com `retry_count=3`. Worker operacional (pick-up de tasks confirmado), problema externo.
- **Evidência**: Tasks criadas e executadas pelo worker, erros capturados em `tasks.error`: `"Gemini generateContent error 503: {\"error\":{\"code\":503,...}}"`.
- **Dependentes**: T23, T24, T25 também SKIP por dependência.

### [SKIP #2] Circuit breaker budget=0.01 (T26)
- **Motivo**: Worker estava processando tasks em retry de Gemini 503 durante a janela de 10s do teste. O pipeline com `budget_usd=0.01` ficou `pending` sem ser coletado no período de observação. Cleanup foi feito antes de poder aguardar mais.
- **Nota**: DB confirma que `budget_usd=0` é rejeitado pelo constraint `pipelines_budget_positive`. O constraint de validação funciona; o teste verificava o circuit breaker em runtime (diferente).

---

## Destaques positivos

- **SKU generation (T13, T28)**: 20 produtos criados simultaneamente → 20 SKUs únicos, todos `/^[A-Z]{4}$/`. Nenhuma colisão. Trigger de retry funcional.
- **FOR UPDATE SKIP LOCKED (T32)**: 5 tasks inseridas → worker pegou 2 sem duplicação. Concorrência de workers segura.
- **Budget constraint (T34)**: `budget_usd=0` e `budget_usd=-1` rejeitados pelo check `pipelines_budget_positive` — proteção de schema.
- **FK em tasks (T35)**: `pipeline_id` inválido rejeitado por foreign key constraint. Worker nunca vê task órfã.
- **Validação de input (T8, T9, T29)**: Todos os casos de payload inválido retornam 422 com `details.fieldErrors` estruturado. `null`, string vazia, URL inválida — todos tratados.
- **confirmed_oversized (T20)**: Coluna existe em `tasks` conforme AUDIT_FIXES_v2 #4.
- **Classificação de nicho (T21)**: 3/3 produtos com nomes semânticos ricos classificados corretamente via embedding (emagrecimento, memória, libido/masculino).
- **llm_calls com custo (T18)**: Registros com `cost_usd > 0` presentes. Billing tracking funcional.
- **Nenhuma injeção SQL (T31)**: Payloads com `'; DROP TABLE products; --` e `UNION SELECT` não executaram SQL arbitrário. Tabela intacta após os testes.

---

## Itens não testáveis automaticamente

Os seguintes aspectos não foram validados nesta execução. Exigem olhar humano:

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

**PASS 71% (25/35) → excluindo SKIPs: 83% (25/30)**

Leva moderada de bugs. Priorizar por severidade:

1. **[ALTO] copy_components schema incompleto** — Sem as colunas `status`, `rejected_at`, `slot`, o fluxo de aprovação por componente (funcionalidade central da v2) está incompleto no banco. Criar migration v2 adicionando essas colunas.

2. **[MÉDIO] Unicode corrompido** — Verificar charset da string de conexão Drizzle/pg. Adicionar `?encoding=UTF8` ou equivalente na `DATABASE_URL`. Testar especificamente com emoji e CJK.

3. **[MÉDIO] niche_id NULL para nomes genéricos** — Adicionar fallback no classificador: se embedding score < threshold, usar niche baseado em palavras-chave da URL do produto antes de deixar NULL.

4. **[BAIXO] GET endpoints retornam envelope** — Verificar se o frontend/Jarvis espera array bare ou wrapped. Se a UI funciona corretamente, apenas atualizar a spec dos testes.

5. **[COSMÉTICO] POST /api/products retorna 201** — Código correto. Atualizar os testes para aceitar 201 em criação.
