# Plano de Execução — AdCraft v2 Ultron

**Última atualização:** 2026-04-18
**Contexto:** Claude Code (Ultron) é o motor central. Frontend é galeria read-only. MCP Supabase conectado.

---

## Como usar este documento

Execute cada tarefa em ordem dentro de uma nova sessão do Claude Code.
Ao iniciar cada tarefa, diga literalmente o comando sugerido na seção "Como pedir".
Marque cada item como concluído conforme avança.

---

## ETAPA 0 — Validação do ambiente

> Fazer antes de tudo. Garante que a nova sessão tem acesso ao banco.

### 0.1 Testar MCP Supabase
**Como pedir:** `"Testa a conexão com o MCP do Supabase e lista as tabelas disponíveis"`

**O que verificar:**
- MCP aparece como connected
- Consegue listar tabelas: `products`, `pipelines`, `tasks`, `product_knowledge`, `copy_components`, `embeddings`

**Critério de sucesso:** Claude Code consegue fazer um SELECT em `products` e retornar dados reais.

---

## ETAPA 1 — Criar produto via MCP Supabase

> Valida o ciclo completo: Claude Code escreve → frontend exibe.

### 1.1 Criar produto de teste
**Como pedir:** `"Cria um produto de teste no banco com os seguintes dados: [nome, VSL URL, ticket, comissão, nicho]"`

**O que acontece:**
- Claude Code usa MCP Supabase para INSERT na tabela `products`
- Produto aparece imediatamente na tela `/products` do frontend

**Schema da tabela `products` (campos obrigatórios):**
```sql
id           uuid DEFAULT gen_random_uuid()
user_id      uuid  -- usar o user_id da sua conta
name         text  -- nome do produto
sku          text  -- 4 letras maiúsculas ex: CBRN
niche_id     uuid  -- FK para niches
vsl_url      text  -- URL da VSL ou landing page
ticket_price numeric -- preço de venda em BRL
commission_percent numeric -- % de comissão
target_country text DEFAULT 'BR'
target_language text DEFAULT 'pt-BR'
version      integer DEFAULT 1
```

**Critério de sucesso:** Produto aparece em `/products` no frontend.

---

## ETAPA 2 — Primeiro pipeline completo (Fase Pesquisa)

> Teste real do pipeline com os 6 agentes da Fase 1.

### 2.1 Criar pipeline de pesquisa
**Como pedir:** `"Roda pipeline pesquisa para o produto [nome] (product_id: UUID)"`

**O que acontece:**
1. Claude Code cria pipeline + 6 tasks no banco via MCP
2. Executa em sequência: vsl_analysis → market_research + avatar_research (paralelo) → benchmark_intelligence → angle_generator → campaign_strategy
3. Cada agente grava artefato via MCP Supabase
4. Ao final, extrai learnings

**Como acompanhar:**
- Peça status: `"Qual o status do pipeline UUID?"`
- Claude Code faz SELECT em `tasks` e mostra tabela de progresso

**Critério de sucesso:** 6 tasks com status `completed` e artefatos visíveis em `/products/[sku]/mercado`, `/personas`, `/angulos`.

### 2.2 Validar artefatos no frontend
Navegar no frontend e verificar cada sub-aba do produto:
- `/products/[sku]/mercado` → artefato `market`
- `/products/[sku]/personas` → artefato `avatar`
- `/products/[sku]/angulos` → artefato `angles`

---

## ETAPA 3 — Enriquecer skills skeleton (11 agentes)

> Sem pressa — fazer um por vez conforme forem sendo usados. Prioridade pela ordem do pipeline.
ok
### Ordem de prioridade:

| Prioridade | Agente                 | Skill file                                        | Fase       |
| ---------- | ---------------------- | ------------------------------------------------- | ---------- |
| 1          | benchmark-intelligence | `.claude/skills/agents/benchmark-intelligence.md` | Pesquisa   |
| 2          | campaign-strategy      | `.claude/skills/agents/campaign-strategy.md`      | Pesquisa   |
| 3          | script-writer          | `.claude/skills/agents/script-writer.md`          | Criativo   |
| 4          | character-generator    | `.claude/skills/agents/character-generator.md`    | Criativo   |
| 5          | keyframe-generator     | `.claude/skills/agents/keyframe-generator.md`     | Criativo   |
| 6          | creative-director      | `.claude/skills/agents/creative-director.md`      | Criativo   |
| 7          | utm-builder            | `.claude/skills/agents/utm-builder.md`            | Lançamento |
| 8          | facebook-ads           | `.claude/skills/agents/facebook-ads.md`           | Lançamento |
| 9          | google-ads             | `.claude/skills/agents/google-ads.md`             | Lançamento |
| 10         | performance-analysis   | `.claude/skills/agents/performance-analysis.md`   | Lançamento |
| 11         | scaling-strategy       | `.claude/skills/agents/scaling-strategy.md`       | Lançamento |

### Como enriquecer cada skill:
**Como pedir:** `"Vamos enriquecer o skill do agente benchmark-intelligence. Ele precisa de: [descreva o que você quer que o agente faça, quais fontes pesquise, qual o critério de qualidade]"`

**O que cada skill precisa ter (seções TODO a preencher):**
- Metodologia detalhada (fontes, ordem de pesquisa, como avaliar)
- Critérios de qualidade do output
- Casos de borda (o que fazer quando não encontra dados)

---

## ETAPA 4 — Atualizar agent-registry.ts

> Fazer após enriquecer os skills dos 11 novos agentes.

### 4.1 Registrar os 11 novos agentes
**Como pedir:** `"Atualiza o agent-registry.ts para incluir os 11 novos agentes do pipeline"`.

**O que adicionar para cada agente:**
```typescript
benchmark_intelligence: {
  requires: ['market'],           // artefatos que precisa como input
  produces: ['benchmark'],        // artefato que gera
  cacheable: true,
  freshness_days: 30,
  model: 'claude-sonnet-4-6',    // modelo a usar
  max_input_tokens: 6000,
},
```

**Arquivo:** `frontend/lib/agent-registry.ts`

---

## ETAPA 5 — Pipeline Fase Criativo

> Só executar após Etapa 3 (skills enriquecidos para os agentes criativos).

### 5.1 Rodar fase criativo
**Como pedir:** `"Roda pipeline criativo para o produto [nome] (product_id: UUID) usando o pipeline_id: UUID da fase pesquisa"`

**Agentes em sequência:**
1. script_writer (depende de: angles, campaign_strategy)
2. copywriting + character_generator (paralelo, depende de: avatar, angles, campaign_strategy)
3. keyframe_generator (depende de: script, character)
4. video_maker (depende de: script, copy, keyframes)
5. creative_director (depende de: copy, video)

**Critério de sucesso:** Artefatos visíveis em `/products/[sku]/copies` e `/criativos`.

---

## ETAPA 6 — Pipeline Fase Lançamento

> Só executar após Etapa 5.

### 6.1 Rodar fase lançamento
**Como pedir:** `"Roda pipeline lançamento para o produto [nome] (product_id: UUID)"`

**Agentes em sequência:**
1. compliance_check + utm_builder (paralelo)
2. facebook_ads + google_ads (paralelo)
3. performance_analysis
4. scaling_strategy

---

## ETAPA 7 — Migrar scripts para MCP (simplificação)

### O que pode ser aposentado com MCP ativo:

| Script                              | Substituto via MCP                                     |
| ----------------------------------- | ------------------------------------------------------ |
| `scripts/pipeline/status.ts`        | `SELECT * FROM tasks WHERE pipeline_id = 'UUID'`       |
| `scripts/artifact/get.ts`           | `SELECT artifact_data FROM product_knowledge WHERE...` |
| `scripts/pipeline/complete-task.ts` | `UPDATE tasks SET status = 'completed'...`             |
| `scripts/copy/update-compliance.ts` | `UPDATE copy_components SET compliance_status...`      |

### O que MANTER mesmo com MCP:
| Script                            | Por quê manter                                        |
| --------------------------------- | ----------------------------------------------------- |
| `scripts/pipeline/create.ts`      | Lógica complexa de DAG + criação de múltiplas tasks   |
| `scripts/artifact/save.ts`        | Lógica de `superseded` + enfileiramento de embeddings |
| `scripts/copy/save-components.ts` | Lógica de tagging canônico (SKU_v1_H1)                |
| `scripts/learning/extract.ts`     | Chama learning-extractor com contexto correto         |
| `scripts/search/vector.ts`        | Ainda precisa gerar embedding da query via Gemini     |

### Como pedir:
`"Com o MCP Supabase conectado, podemos aposentar os scripts de leitura simples. Atualiza o _pipeline.md para refletir que status e leitura de artefatos agora usam MCP diretamente"`

---

## ETAPA 8 — Ajustes de frontend

> Polimento visual

### 8.1 Sidebar — remover ou ajustar link do Jarvis
**Como pedir:** `"A sidebar ainda tem link para o Jarvis (página /). Ou remove o link ou troca para mostrar algo diferente"`

### 8.2 Página /demandas — mostrar pipelines criados via Claude Code
Verificar se os pipelines criados via `scripts/pipeline/create.ts` aparecem corretamente na tela `/demandas` com todos os status.

### 8.3 Componentes ShadCn
Validar cada componente de UX e UI do frontend para garantir que estão usando os componentes do ShadCn corretamente.
Link do ShadCn: https://ui.shadcn.com/docs/components

---

## ETAPA 9 — niche_curator (decisão pendente)

> Agente que cuida dos learnings do nicho. Hoje é um job avulso, não está no pipeline.

### Opções:
**A) Manter como job avulso** — você pede manualmente após acumular aprovações de copy: `"Roda o niche_curator para o nicho UUID"`

**B) Adicionar ao pipeline** — vira agente 19, roda após scaling_strategy

**Como pedir (opção A):** `"Cria um skill para o niche_curator como job avulso que eu possa rodar manualmente"`

---

## ETAPA 10 — Memória vetorial em produção

> Validar que o ciclo de aprendizado está funcionando end-to-end.

### 10.1 Verificar embeddings sendo gerados
**Como pedir:** `"Verifica se o embeddings worker está gerando vetores. Faz um SELECT na tabela embeddings e mostra quantos registros têm embedding preenchido vs NULL"`

### 10.2 Testar busca vetorial
**Como pedir:** `"Testa a busca vetorial para o nicho UUID com a query '[produto]' e mostra os learnings retornados"`

### 10.3 Confirmar injeção de learnings nos agentes
Verificar que os agentes de pesquisa (market_research, avatar_research) estão recebendo learnings anteriores como contexto antes de executar.

---

## Resumo de status

| Etapa | Descrição                     | Status     |
| ----- | ----------------------------- | ---------- |
| 0     | Validar MCP Supabase          | ✅ concluído |
| 1     | Criar produto via MCP         | ✅ concluído (CitrusBurn PCFU) |
| 2     | Pipeline pesquisa completo    | ✅ concluído (CitrusBurn — 14 artefatos) |
| 3     | Enriquecer 11 skills skeleton | ✅ concluído (todos têm metodologia + QA) |
| 4     | Atualizar agent-registry.ts   | ✅ concluído (11 agentes + GoalName expandido) |
| 5     | Pipeline criativo             | ⬜ pendente |
| 6     | Pipeline lançamento           | ⬜ pendente |
| 7     | Migrar scripts para MCP       | ✅ concluído |
| 8     | Ajustes de frontend           | 🔄 em andamento |
| 9     | niche_curator (decisão)       | ⬜ pendente |
| 10    | Memória vetorial end-to-end   | ⬜ pendente |

---

## Referências rápidas

| O que                 | Onde                                   |
| --------------------- | -------------------------------------- |
| Pipeline DAG completo | `.claude/pipelines/full-pipeline.yaml` |
| Guia de orquestração  | `.claude/skills/agents/_pipeline.md`   |
| Skills dos agentes    | `.claude/skills/agents/`               |
| Scripts DB bridge     | `scripts/`                             |
| Schema do banco       | `frontend/lib/schema/index.ts`         |
| Registry de agentes   | `frontend/lib/agent-registry.ts`       |
| Workers ativos        | `workers/README-DEPRECATED.md`         |
