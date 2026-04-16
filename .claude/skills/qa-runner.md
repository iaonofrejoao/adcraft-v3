# Skill: QA Runner — AdCraft v2

## Propósito

Executar bateria de testes end-to-end programáticos contra o AdCraft v2 rodando localmente, reportando resultados em `QA_REPORT.md` **sem corrigir nenhum bug**. Esta skill é uma ferramenta de diagnóstico — você é o auditor, não o mecânico.

## Regra central

**NÃO corrija nenhum bug durante a execução.** Se um teste falha, registre e continue. Correções são decisão humana em sessão separada.

## Pré-requisitos

Antes de executar qualquer teste, verifique todos os pré-requisitos. Se qualquer um falhar, registre no relatório em "SKIP massivo por pré-requisito" e pare.

### 1. Next.js rodando em localhost:3000

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```
Deve retornar 200. Se não, registre como bloqueio total.

### 2. Worker rodando

```bash
# Não há healthcheck direto — verificar via query no banco
# procurando por última atividade de polling na tabela tasks
# (se o worker está rodando, tasks stuck em 'running' há mais
# de 10 min são suspeitas; se não há tasks, rodar um teste
# trivial que cria uma task e ver se é pega em <15s)
```

### 3. Supabase acessível

```bash
# Usa DATABASE_URL do .env da raiz
# Testa via psql ou via query simples pela API REST do Supabase
```

Teste de conectividade:
```sql
SELECT NOW() AS server_time;
```

### 4. Variáveis de ambiente carregadas

Confirme que existem no `.env` da raiz:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## Convenção de dados de teste

**Princípio de isolamento:** qualquer dado criado pela skill usa prefixo `QA_` no nome e SKU prefixado com letras QAxx (onde xx varia). Isso protege produtos reais.

**Princípio de read-only:** testes que apenas leem dados (GET endpoints, SELECT queries) podem usar produtos reais existentes no banco. Testes que escrevem criam próprios.

**Cleanup obrigatório:** todo teste usa try/finally. No finally, apaga o que criou. Cleanup global ao final deleta qualquer resíduo `QA_`.

## Escopo dos testes

### Grupo 1 — Testes de API (read-only, rápidos)

1. `GET /api/products` retorna 200 com array
2. `GET /api/products/[sku]` com SKU real retorna 200 com produto correto
3. `GET /api/products/[sku]` com SKU inexistente (`ZZZZ`) retorna 404
4. `GET /api/assets?limit=50` retorna 200 com array
5. `GET /api/tasks?limit=100` retorna 200 com array
6. `GET /api/pipelines/[id-inexistente]` retorna 404

### Grupo 2 — Testes de API (com criação, com cleanup)

7. `POST /api/products` com payload válido retorna 201 + sku gerado (4 letras)
8. `POST /api/products` com payload inválido (sem name) retorna 422 com `details.fieldErrors`
9. `POST /api/products` com URL inválida retorna 422 ou 400
10. `POST /api/products` 2x com mesmo nome — SKU diferente em cada (trigger de unique)
11. `POST /api/chat` com `{"message": "oi"}` retorna SSE stream com pelo menos 1 evento `message`
12. `POST /api/chat` com `{"message": "quais produtos eu tenho cadastrados?"}` retorna SSE com listagem

### Grupo 3 — Testes de integridade SQL

13. Após criar produto, `sku` match `/^[A-Z]{4}$/`
14. Após criar produto, `niche_id` não é NULL (classificação automática funcionou)
15. Tentar INSERT direto em `products` com sku duplicado falha com unique violation
16. Após task `avatar_research` completar, `product_knowledge` tem registro com `artifact_type='avatar'` e `status='fresh'`
17. `copy_combinations` trigger: tentar INSERT com `hook_id` rejeitado falha com check constraint ou RLS
18. `llm_calls` tem `cost_usd > 0` após qualquer chamada Gemini bem-sucedida
19. `embeddings` tem linha com `source_table='products'` após cadastro de produto
20. Tabela `tasks` tem coluna `confirmed_oversized` (correção do AUDIT_FIXES_v2 #4)

### Grupo 4 — Testes de fluxo E2E

21. **Cadastro → classificação de nicho**: POST /api/products com URL de landing page real (usar https://example.com/nutra se não houver URL real). Esperar <10s. Validar no banco que `niche_id` foi atribuído.

22. **Pipeline avatar_only completo**: criar pipeline via chat, aprovar, esperar worker completar. Timeout 3 min. Validar:
    - Task em `tasks` com `status='completed'`
    - `product_knowledge` com artifact `avatar`
    - `llm_calls` com pelo menos 1 linha do agent `avatar_research`

23. **Reaproveitamento de avatar**: rodar pipeline de `copy_only` no mesmo produto. Validar:
    - Plano retornado pelo Jarvis marca avatar como `reused`
    - Nenhuma nova chamada em `llm_calls` para `avatar_research`
    - Tasks novas criadas só pra `market_research`, `angle_generator`, `copy_hook_generator`, `anvisa_compliance`

24. **Materialização de combinações**: após copy_only completar, `copy_components` tem 9 linhas (3H+3B+3C). Aprovar 2H+2B+2C via `POST /api/copy-components/[id]/approve`. Chamar `POST /api/products/[sku]/materialize-combinations`. Validar `copy_combinations` tem 8 linhas (2×2×2) com tags no formato `QAxx_v1_H[n]_B[n]_C[n]`.

25. **force_refresh bumpa versão**: pedir avatar novamente com flag force_refresh=true. Validar:
    - Novo registro em `product_knowledge` com `artifact_type='avatar'`
    - Registro antigo marcado como `status='superseded'`
    - `product_version` incrementou

### Grupo 5 — Testes destrutivos e edge cases (tentar quebrar)

26. **Circuit breaker**: criar pipeline via SQL com `budget_usd=0.01`, disparar task, validar que worker pausa pipeline e cria approval `budget_exceeded` antes de estourar budget.

27. **Race condition em approval**: rodar 2 chamadas simultâneas (Promise.all) de `POST /api/copy-components/[id]/approve` no mesmo componente. Validar que uma ganha e a outra retorna conflito (409) ou ambas retornam 200 mas o banco tem estado consistente (apenas um `approved_at`).

28. **SKU collision**: forçar em loop criação de 20 produtos rapidamente. Nenhum deve falhar por colisão de SKU (trigger de retry deve funcionar).

29. **Payload malformado no chat**: `POST /api/chat` com:
    - Body vazio `{}`
    - `{"message": ""}` (string vazia)
    - `{"message": "a".repeat(100000)}` (muito longo)
    - `{"message": null}`
    - `{"message": "@SKU_INEXISTENTE faz copy"}`
    
    Cada um deve retornar erro adequado (400/422) ou resposta graciosa, nunca 500 ou crash.

30. **Unicode e emoji no cadastro**: POST /api/products com name `"QA_テスト_🚀_Produto"`. Deve cadastrar sem corromper dados no banco (validar por SELECT).

31. **SQL injection no search**: tentar chamar endpoints com query strings tipo `'; DROP TABLE products; --`. Nenhuma query deve executar SQL arbitrário.

32. **Concorrência no worker**: criar 5 tasks simultâneas (direto via SQL). Validar que o worker pega todas sem duplicar execução (FOR UPDATE SKIP LOCKED funcionando). Nenhuma task deve executar 2x.

33. **Referência circular em menções**: mensagem com `@SKU1 @SKU2 @SKU1` — Jarvis resolve sem loop infinito.

34. **Budget negativo ou zero**: criar pipeline com `budget_usd=0` ou `budget_usd=-1`. Esperado: rejeitar no nível de validação ou pausar imediatamente.

35. **Task órfã**: task com `pipeline_id` apontando pra pipeline inexistente. Worker não deve crashar — deve marcar task como failed com erro claro.

## Execução passo a passo

Execute em ordem. Se um grupo falha catastroficamente, pule pro próximo.

### Passo 1 — Verificar pré-requisitos

Rode os 4 checks de pré-requisito. Se algum falha, registre em `QA_REPORT.md`:

```markdown
# QA Report — [timestamp]

## ❌ PRÉ-REQUISITOS NÃO ATENDIDOS

- [ ] Next.js em localhost:3000: FALHOU (detalhes)
- [ ] Worker: FALHOU (detalhes)

Testes não executados. Resolva pré-requisitos e rode novamente.
```

E pare.

### Passo 2 — Seed de dados de teste

Crie 3 produtos com prefixo `QA_` que serão usados nos testes de escrita. Use payloads com sinal semântico real — isso garante que o classificador de nicho encontre embedding significativo (não neutro) e que os testes de classificação (Grupo 3, teste 14 e Grupo 4, teste 21) reflitam comportamento real.

```jsonc
// Produto QA #1 — nicho: emagrecimento
// POST /api/products
{
  "name": "QA_EmagreceFast_Capsulas",
  "product_url": "https://hotmart.com/produto/qa-emagrecimento-premium",
  "platform": "hotmart",
  "ticket_price": 197,
  "commission_percent": 60,
  "affiliate_link": "https://ex.com/qa-aff-1"
}

// Produto QA #2 — nicho: memória/foco
// POST /api/products
{
  "name": "QA_MentalBoost_Nootropico",
  "product_url": "https://hotmart.com/produto/qa-memoria-foco",
  "platform": "hotmart",
  "ticket_price": 147,
  "commission_percent": 55,
  "affiliate_link": "https://ex.com/qa-aff-2"
}

// Produto QA #3 — nicho: libido/masculino
// POST /api/products
{
  "name": "QA_Performance_Masculina",
  "product_url": "https://hotmart.com/produto/qa-libido-masculina",
  "platform": "hotmart",
  "ticket_price": 297,
  "commission_percent": 70,
  "affiliate_link": "https://ex.com/qa-aff-3"
}
```

Armazenar os 3 SKUs retornados para uso nos testes subsequentes.

### Passo 3 — Executar grupos de teste na ordem

Execute na sequência: Grupo 1 → 2 → 3 → 4 → 5. Acumule resultados.

Para cada teste:
1. Execute
2. Compare resultado com expectativa
3. Classifique como PASS / FAIL / SKIP
4. Se FAIL, capture: comando executado, resposta recebida, stack trace, logs do terminal
5. Timeout: 30s para testes unitários, 3 min para testes E2E que aguardam worker

### Passo 4 — Cleanup

Independente do resultado dos testes, execute cleanup:

```sql
-- Deletar em ordem reversa de foreign keys
DELETE FROM llm_calls WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM embeddings WHERE source_table = 'products' AND source_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM copy_combinations WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM copy_components WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM product_knowledge WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM approvals WHERE pipeline_id IN (SELECT id FROM pipelines WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%'));
DELETE FROM tasks WHERE pipeline_id IN (SELECT id FROM pipelines WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%'));
DELETE FROM pipelines WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA%');
DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE title LIKE 'QA%' OR title IS NULL);
DELETE FROM products WHERE sku LIKE 'QA%' OR name LIKE 'QA_%';
```

Confirme no final:
```sql
SELECT COUNT(*) FROM products WHERE sku LIKE 'QA%' OR name LIKE 'QA_%';  -- deve ser 0
```

### Passo 5 — Gerar QA_REPORT.md

Crie arquivo na raiz com formato exato abaixo.

## Formato do relatório

```markdown
# QA Report — [YYYY-MM-DD HH:MM:SS]

## Resumo executivo

- Total de testes: X
- PASS: X (Y%)
- FAIL: X
- SKIP: X
- Tempo total: X minutos

## Por categoria

| Grupo | Descrição | Passaram |
|-------|-----------|----------|
| 1 | API read-only | X/6 |
| 2 | API com criação | X/6 |
| 3 | Integridade SQL | X/8 |
| 4 | Fluxo E2E | X/5 |
| 5 | Destrutivos/edge cases | X/10 |

## FAILs detalhados

### [FAIL #1] Nome do teste
- **Grupo**: X
- **O que foi feito**: `curl -X POST http://localhost:3000/api/... -d '{...}'`
- **Esperado**: `{ "sku": "XXXX", ... }` com status 200
- **Obtido**: status 500, body: `{...}` ou stack trace
- **Severidade**: BLOQUEANTE | ALTO | MÉDIO | BAIXO | COSMÉTICO
- **Hipótese de causa**: 1-2 linhas

(repetir para cada fail)

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

## Recomendação

[Se PASS > 90%: aplicação em bom estado. Corrigir só os FAILs com severidade alta+.]
[Se PASS 70-90%: leva moderada de bugs. Priorizar por severidade, corrigir em sessões de 3-5 bugs.]
[Se PASS < 70%: regressão séria. Revisar se pré-requisitos estavam corretos. Se sim, parar e investigar causa raiz antes de corrigir bugs individuais.]
```

## Observações importantes

- **Ordem dos testes importa.** Grupo 4 depende de Grupo 2 ter funcionado.
- **Timeouts reais são de 3 min**, não 30s, pros testes que aguardam worker completar chamada ao Gemini.
- **Se o Gemini estiver caindo ou lento**, isso afeta testes E2E. Registre como SKIP, não FAIL, e anote motivo.
- **Não invente resultados.** Se não conseguiu testar algo por erro de ferramentas, registre como SKIP com motivo.
- **Rate limiting da API do Gemini** pode afetar testes E2E rodados em lote. Inserir delay de 3s entre pipelines.

## Exemplo de execução bem-sucedida

```
[12:30:15] Pré-requisitos OK
[12:30:16] Seed de 2 produtos QA criado
[12:30:20] Grupo 1 iniciado (6 testes)
[12:30:45] Grupo 1 concluído: 6/6 PASS
[12:30:46] Grupo 2 iniciado (6 testes)
[12:31:30] Grupo 2 concluído: 5/6 PASS (1 FAIL em POST /api/chat)
...
[12:48:12] Grupo 5 concluído: 8/10 PASS
[12:48:13] Cleanup iniciado
[12:48:20] Cleanup OK (0 registros QA_ restantes)
[12:48:21] QA_REPORT.md gerado
```

Total: ~18 minutos para suite completa.
