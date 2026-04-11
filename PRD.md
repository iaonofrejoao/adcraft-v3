# AdCraft v2 — Product Requirements Document

**Versão:** 2.0
**Data:** Abril 2026
**Status:** Aprovado para implementação

---

## 1. Executive Summary

AdCraft v2 é uma plataforma de marketing autônomo controlada por linguagem natural. O usuário (CMO) conversa com **Jarvis**, um orquestrador de IA que interpreta pedidos, planeja dinamicamente quais agentes precisam rodar, executa o pipeline e apresenta resultados.

A v2 abandona o pipeline fixo do v1 em favor de **planejamento dinâmico via capability registry**. Cada pedido vira um DAG mínimo de tasks reaproveitando artifacts já gerados quando possível. O sistema aprende padrões por nicho e injeta esse aprendizado em todo produto novo do mesmo nicho.

**Escopo da v2:** pesquisa de avatar/mercado, geração de ângulos, geração de copy (3 hooks + 3 bodies + 3 CTAs com aprovação por componente), geração de vídeo via VEO 3.

**Fora do escopo (v3):** integrações com Meta Ads, Google Ads, YouTube/Amazon scrapers, pipeline de campanha.

---

## 2. Product Overview

### 2.1 O que o AdCraft v2 faz

- Recebe pedidos em linguagem natural via chat (Jarvis)
- Planeja dinamicamente quais agentes rodar com base no goal e nos artifacts existentes do produto
- Apresenta o plano como diagrama Mermaid pro usuário aprovar antes de executar
- Executa pipeline reaproveitando avatar/market/angles já gerados (frescor configurável)
- Gera 3 hooks + 3 bodies + 3 CTAs como componentes independentes
- Permite aprovação por componente, não por copy completa
- Materializa combinações N×M×K só com componentes aprovados
- Gera vídeos VEO 3 apenas das combinações selecionadas pelo usuário
- Aprende padrões por nicho via curadoria humana e injeta nos agentes
- Rastreia tudo via tags determinísticas (SKU + versão + componentes)

### 2.2 Jornada do usuário

1. Usuário cadastra produto (URL ou descrição) → sistema gera SKU de 4 letras + classifica nicho automaticamente
2. Usuário pede algo no chat: "faz uma copy pra @ABCD" ou "quero entender o público desse novo produto"
3. Jarvis classifica o goal, consulta `product_knowledge` e `niche_learnings`, monta plano
4. Jarvis apresenta plano como Mermaid + lista textual + botões Aprovar/Ajustar/Cancelar
5. Usuário aprova → workers executam tasks em ordem de dependência
6. Quando atinge checkpoint (componentes de copy ou seleção de combinações), Jarvis pausa e notifica
7. Usuário aprova componentes em `/products/[sku]/copies` (3 colunas: Hooks/Bodies/CTAs)
8. Sistema materializa combinações; se goal for `creative_full`, Jarvis pergunta quais viram vídeo
9. Vídeos prontos → usuário baixa em `/creatives` e usa onde quiser

### 2.3 O que o AdCraft v2 NÃO faz

- Não sobe campanha em Meta/Google Ads (volta na v3)
- Não scrapeia YouTube, Amazon, Mercado Livre, Facebook Ad Library
- Não decide sozinho — sempre pede aprovação de plano e checkpoints
- Não gera 27 vídeos automaticamente — usuário seleciona combinações

---

## 3. Technical Architecture

### 3.1 Stack

```
Frontend:    Next.js 14 App Router · Tailwind · TypeScript · React
Realtime:    SSE (chat Jarvis) + Supabase Realtime (status de tasks)
LLM:         Google Gemini API
             - gemini-2.5-pro (agentes criativos: avatar, market, angles, copy)
             - gemini-2.5-flash (Jarvis, compliance, niche_curator, video_maker)
Embeddings:  Gemini gemini-embedding-001 (768 dim)
Video:       Google VEO 3 via Google AI Studio
Database:    Supabase PostgreSQL 15 + pgvector
ORM:         Drizzle
Storage:     Cloudflare R2 (S3-compatible)
Workers:     Node.js TypeScript · polling tasks a cada 5s
Diagrams:    mermaid.js (renderização client-side do plano do Jarvis)
Auth:        Nenhuma (v1.0 local, single-user)
```

### 3.2 Arquitetura de execução

```
[Frontend Next.js]
       ↓ SSE
[/api/chat]  ←→  [Jarvis Service]
                       ↓ tools
                  [Planner] → consulta product_knowledge + niche_learnings
                       ↓
                  [DB Supabase] ← workers polling
                                       ↓
                                  [Worker Node.js]
                                       ↓
                                  [Agent Router]
                                       ↓
                                  [Gemini Client com cache]
                                       ↓
                                  escreve em pipeline.state
                                       ↓
                                  escreve em product_knowledge
                                       ↓
                                  enfileira embedding
```

### 3.3 Pipeline de execução

Não existe sequência fixa. O Jarvis monta o DAG por demanda via capability registry. Cada task tem `depends_on uuid[]` que aponta pras tasks predecessoras. O worker só pega tasks cujas dependências estão `done`.

---

## 4. Agent System Design

### 4.1 Capability Registry

Cada agente declara o que consome e o que produz. O planner usa isso pra resolver dependências.

```typescript
// /workers/lib/agent-registry.ts
export const AGENT_REGISTRY = {
  avatar_research: {
    requires: ['product'],
    produces: ['avatar'],
    cacheable: true,
    freshness_days: 60,
    model: 'gemini-2.5-pro',
    max_input_tokens: 4000,
  },
  market_research: {
    requires: ['product'],
    produces: ['market'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',
    max_input_tokens: 4000,
  },
  angle_generator: {
    requires: ['product', 'avatar', 'market'],
    produces: ['angles'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',
    max_input_tokens: 8000,
  },
  copy_hook_generator: {
    requires: ['product', 'avatar', 'angles'],
    produces: ['copy_components'],
    cacheable: false,
    model: 'gemini-2.5-pro',
    max_input_tokens: 10000,
    modes: ['full', 'hooks_only', 'bodies_only', 'ctas_only'],
  },
  anvisa_compliance: {
    requires: ['copy_components'],
    produces: ['compliance_results'],
    cacheable: false,
    model: 'gemini-2.5-flash',
    max_input_tokens: 6000,
  },
  video_maker: {
    requires: ['copy_combinations_selected', 'product'],
    produces: ['video_assets'],
    cacheable: false,
    model: 'gemini-2.5-flash',
    max_input_tokens: 4000,
  },
};
```

### 4.2 Goals Catalog

5 goals fechados na v2. Jarvis classifica o pedido livre do usuário em um destes.

| Goal | Deliverable | Agentes envolvidos | Checkpoints |
|---|---|---|---|
| `avatar_only` | avatar | avatar_research | nenhum |
| `market_only` | market | market_research | nenhum |
| `angles_only` | angles | avatar + market + angle_generator | nenhum |
| `copy_only` | copy_components aprovados | angles + copy_hook_generator + anvisa_compliance | aprovação por componente |
| `creative_full` | vídeos das combinações selecionadas | copy + video_maker | aprovação de componentes + seleção de combinações |

### 4.3 Jarvis — Orquestrador

**Modelo:** gemini-2.5-flash
**Prompt:** `prompts/jarvis.md`

**Intents:**
- `create_pipeline` — pedido de novo trabalho
- `check_status` — consulta de pipeline em andamento
- `query_data` — pergunta sobre artifacts/learnings existentes
- `approve_plan` — aprovação do DAG sugerido
- `approve_components` — aprovação de componentes de copy (dispara via UI também)
- `select_combinations` — escolha de combinações pra virar vídeo
- `general_question` — dúvidas operacionais

**Tools:**
- `resolve_product(query)` — busca produto por SKU/nome/menção
- `get_product_knowledge(product_id)` — artifacts fresh do produto
- `plan_pipeline(goal, product_id, force_refresh?)` — gera DAG via planner
- `create_pipeline_from_plan(plan_id)` — persiste e enfileira tasks
- `get_pipeline_status(pipeline_id)` — estado atual com progresso
- `query_niche_learnings(niche_id, types, limit)` — consulta learnings
- `list_recent_artifacts(limit)` — pra dropdown do `/`
- `render_plan_card(plan_data)` — card visual com Mermaid
- `render_approval_card(approval_type, payload)`

### 4.4 Agentes (refatorados/reaproveitados)

| Agente v2 | Origem | Mudança |
|---|---|---|
| `avatar_research` | `persona_builder.md` v1 | Nenhuma — reaproveita íntegro |
| `market_research` | `market_researcher.md` v1 | Nenhuma — reaproveita íntegro |
| `angle_generator` | `angle_strategist.md` v1 | Nenhuma — reaproveita íntegro |
| `copy_hook_generator` | `copy_writer.md` v1 | Refatorado — output 3+3+3 + 4 modos de execução |
| `anvisa_compliance` | `compliance_checker.md` v1 | Nenhuma — reaproveita íntegro |
| `video_maker` | novo orquestrador | Novo — internamente usa lógica de `character_generator`, `keyframe_generator`, `video_generator` da v1 (arquivados, reaproveitados como sub-rotinas) |
| `niche_curator` | novo | Novo — processa sinais de aprovação/rejeição em learnings |

---

## 5. Shared State Schema

`pipeline.state` é JSONB. Cada agente escreve apenas no seu campo. Merge JSONB obrigatório (`state || partial::jsonb`).

```json
{
  "product": { "id", "sku", "name", "url", "niche_id", "version" },
  "avatar": { ... },
  "market": { ... },
  "angles": [ { "id", "name", "rationale", "score" } ],
  "copy_components": {
    "hooks":  [ { "slot": 1, "tag": "ABCD_v1_H1", "content", "register" } ],
    "bodies": [ { "slot": 1, "tag": "ABCD_v1_B1", "content", "structure" } ],
    "ctas":   [ { "slot": 1, "tag": "ABCD_v1_C1", "content", "intensity" } ]
  },
  "compliance_results": { "by_component": { "ABCD_v1_H1": "approved", ... } },
  "selected_combinations": [ "ABCD_v1_H1_B2_C1", ... ],
  "video_assets": [ { "tag": "ABCD_v1_H1_B2_C1_V1", "url" } ]
}
```

---

## 6. Database Schema

### Tabelas mantidas do v1 (não alterar — migrations 001-013 já aplicadas)
`enums`, `users`, `user_credentials`, `niches`, `pattern_intelligence`, `products`, `templates`, `projects`, `executions`, `assets`, `campaigns`, `knowledge_notifications`. Algumas serão estendidas com colunas novas (ver abaixo).

### Novas tabelas v2 (em `/migrations/v2/` via Drizzle)

**`pipelines`** — substitui o conceito de "execution" do v1
```sql
id uuid pk, user_id uuid fk, product_id uuid fk, goal text not null,
deliverable_agent text not null, plan jsonb not null, state jsonb default '{}',
status text default 'pending', product_version int not null, force_refresh bool default false,
budget_usd numeric(10,2), cost_so_far_usd numeric(10,4) default 0,
created_at, updated_at, completed_at
```

**`tasks`** — unidade de execução do worker
```sql
id uuid pk, pipeline_id uuid fk, agent_name text not null, mode text,
depends_on uuid[] default '{}', status text default 'pending',
input_context jsonb, output jsonb, error text, retry_count int default 0,
started_at, completed_at, created_at
```

**`approvals`**
```sql
id uuid pk, pipeline_id uuid fk, task_id uuid fk, approval_type text,
payload jsonb, status text default 'pending', resolved_at, created_at
```

**`copy_components`**
```sql
id uuid pk, pipeline_id uuid fk, product_id uuid fk, product_version int,
component_type text, slot_number int, tag text unique not null, content text,
angle_id uuid fk, rationale text, register text, structure text, intensity text,
compliance_status text default 'pending', compliance_violations jsonb,
approval_status text default 'pending', approved_at, created_at
```

**`copy_combinations`**
```sql
id uuid pk, product_id uuid fk, pipeline_id uuid fk, tag text unique not null,
hook_id uuid fk, body_id uuid fk, cta_id uuid fk, full_text text,
selected_for_video bool default false, created_at
-- trigger: só permite INSERT se hook/body/cta tiverem approval_status='approved' e compliance_status='approved'
```

**`product_knowledge`**
```sql
id uuid pk, product_id uuid fk, product_version int, artifact_type text,
artifact_data jsonb, source_pipeline_id uuid fk, source_task_id uuid fk,
status text default 'fresh', created_at, superseded_at, superseded_by uuid fk
```

**`niche_learnings`**
```sql
id uuid pk, niche_id uuid fk, learning_type text, content text,
evidence jsonb, confidence float, occurrences int default 1,
status text default 'active', created_at, last_reinforced_at
```

**`embeddings`** (polimórfica)
```sql
id uuid pk, source_table text, source_id uuid,
embedding vector(768), model text default 'gemini-embedding-001', created_at
-- create extension vector;
-- create index on embeddings using hnsw (embedding vector_cosine_ops);
-- create index on embeddings (source_table, source_id);
```

**`conversations`**
```sql
id uuid pk, user_id uuid fk, title text, created_at, last_message_at
```

**`messages`**
```sql
id uuid pk, conversation_id uuid fk, role text, content text,
references jsonb, pipeline_id uuid fk, created_at
```

**`prompt_caches`**
```sql
id uuid pk, cache_key text unique, gemini_cache_name text, expires_at, created_at
```

**`llm_calls`** — observabilidade de custo
```sql
id uuid pk, agent_name text, pipeline_id uuid fk, product_id uuid fk, niche_id uuid fk,
model text, input_tokens int, cached_input_tokens int, output_tokens int,
cost_usd numeric(10,6), duration_ms int, created_at
```

### Colunas novas em tabelas existentes

```sql
alter table products add column sku char(4) unique;
alter table products add column slug text;
-- trigger BEFORE INSERT que gera 4 letras [A-Z] aleatórias até achar livre

alter table niches add column embedding_anchor text; -- texto representativo do nicho pra embedding
```

---

## 7. Memory & Knowledge System

Camada de memória persistente que torna o sistema progressivamente mais inteligente.

### 7.1 Product Knowledge

Toda escrita em `pipeline.state.{campo}` dispara escrita em `product_knowledge` na mesma transação. Quando o planner monta um DAG, consulta `product_knowledge` por produto e pula agentes cujos artifacts estão `fresh`. Frescor: avatar 60d, market 30d, angles 30d. Reformulação manual via `force_refresh: true` ignora cache, marca antigo como `superseded`, bumpa `product_version`.

### 7.2 Niche Intelligence

`niche_learnings` armazena padrões por nicho. Tipos:
- `angle_winner` / `angle_loser`
- `hook_pattern`
- `creative_format`
- `objection`
- `language_pattern`
- `avatar_insight`
- `compliance_violation`

**Geração de learnings:** quando usuário aprova/rejeita componentes em `/products/[sku]/copies`, sinais entram numa fila. O `niche_curator` (rodando via cron diário ou sob demanda) consolida em learnings. Confidence sobe com `occurrences`.

**Injeção nos agentes:** o context builder, antes de chamar cada agente, faz query híbrida:
```sql
select content, confidence
from niche_learnings nl
join embeddings e on e.source_table='niche_learnings' and e.source_id=nl.id
where nl.niche_id = $1 and nl.learning_type = any($2) and nl.status='active'
order by nl.confidence desc, e.embedding <=> $product_embedding asc
limit 15;
```

Top-K learnings são injetados no prompt do agente.

### 7.3 Niche Classification

Quando produto novo é cadastrado, sub-rotina `classifyNiche(productPage)` (não é agente — é função no código de cadastro):
1. Lê página/URL via `web_search` ou fetch
2. Gera embedding do conteúdo via Gemini
3. Busca nichos existentes por similaridade vetorial (`embeddings` onde `source_table='niches'`)
4. Se similaridade > 0.85 → atribui automaticamente
5. Se < 0.85 → Jarvis pergunta no chat se cria nicho novo

---

## 8. Reference Resolution (Menções @ e /)

**`@`** abre dropdown de **entidades** (produtos por SKU/nome).
**`/`** abre dropdown de **ações rápidas** (`/pesquisa-mercado`, `/copy`, `/video`, `/reformular`).

Backend tem pre-processor que parseia menções antes de mandar pro Jarvis e resolve em contexto rico:
```
[USER_MESSAGE]: gera copy pra @ABCD
[RESOLVED]:
  - product: { id, sku=ABCD, name="Xpto Fórmula", niche="emagrecimento" }
  - knowledge: avatar(v1, 5d), market(v1, 5d), angles(v1, 5d)
```

Se usuário não usa `@` e diz "aquele produto", Jarvis usa histórico recente da conversa. Se ambíguo, pergunta com cards.

---

## 9. Tagging Convention

Determinístico, único, rastreável.

```
SKU:           ABCD                                  (4 letras geradas)
Hook:          ABCD_v1_H1
Body:          ABCD_v1_B2
CTA:           ABCD_v1_C1
Combinação:    ABCD_v1_H1_B2_C1
Vídeo:         ABCD_v1_H1_B2_C1_V1
```

Versão `v{N}` reflete `product_version`. Bumpa quando `force_refresh` em avatar ou market. Coluna `tag` é `UNIQUE NOT NULL` em `copy_components`, `copy_combinations`, `assets` (vídeo).

---

## 10. Cost Optimization Strategy

Documentação completa em `skills/gemini-cost-optimization.md`. Resumo das 9 práticas:

1. **Model routing por agente** — Flash pra Jarvis/compliance/curator; Pro pra agentes criativos
2. **Token budget** — `max_input_tokens` declarado no registry; context builder trunca/resume
3. **Prompt caching Gemini** — cache de system_prompt + niche_learnings por (agent × niche), expira em 1h
4. **Reaproveitamento de artifacts** — frescor configurável em `product_knowledge`
5. **Embeddings em batch** — agrupa a cada 30s, máximo 100 por chamada
6. **Lazy embedding** — só gera embedding de learnings com `confidence >= 0.5`
7. **Modo parcial em copy** — re-gerar só hooks/bodies/ctas sem refazer os outros
8. **Logging em `llm_calls`** — toda chamada gravada com tokens e custo
9. **Circuit breaker por pipeline** — `budget_usd` por pipeline; pausa se estourar

**Defaults de budget:**
- avatar_only: $0.30 · market_only: $0.30 · angles_only: $1.00 · copy_only: $2.00 · creative_full: $8.00

**Hard limit de vídeo:** máximo 5 por execução de `video_maker` sem confirmação extra.

---

## 11. API Endpoints

```
POST   /api/chat                          → SSE endpoint do Jarvis
GET    /api/products                      → lista
POST   /api/products                      → cadastra (gera SKU + classifica nicho)
GET    /api/products/[sku]
GET    /api/products/[sku]/copies         → componentes pra aprovar
POST   /api/copy-components/[id]/approve
POST   /api/copy-components/[id]/reject
POST   /api/products/[sku]/materialize-combinations
GET    /api/pipelines/[id]
GET    /api/pipelines/[id]/status
POST   /api/pipelines/[id]/select-combinations
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/[id]/messages
GET    /api/niches/[id]/learnings
```

---

## 12. UI Specifications

### `/` — Chat Jarvis (tela principal)
Sidebar 240px (Conversas recentes, Nova conversa, Produtos, Criativos, Demandas) + área de chat com SSE. Input com suporte a `@` (produtos) e `/` (ações). Cards inline: PlanPreviewCard (Mermaid), PipelineStatusCard, ApprovalCreativeCard, MetricsCard.

### `/products`
Grid de cards (SKU, nome, nicho, último pipeline, badge de versão).

### `/products/[sku]`
Detalhe do produto + tabs: Overview, Copies, Vídeos, Histórico de pipelines.

### `/products/[sku]/copies`
**Tela crítica.** 3 colunas (Hooks / Bodies / CTAs). Cada card: tag, conteúdo, rationale, badge de compliance, botões Aprovar/Rejeitar/Pedir refresh. Botão "Gerar combinações" libera quando ≥1 aprovado em cada coluna.

### `/creatives`
Grid de vídeos com filtros.

### `/demandas`
Kanban: Aguardando / Rodando / Aprovação Pendente / Concluído / Falhou. Realtime via Supabase.

---

## 13. Non-Functional Requirements

- **Local-only v1:** roda em localhost, sem auth, single-user
- **Latência de chat:** primeira resposta SSE em < 2s
- **Confiabilidade de workers:** retry com backoff exponencial, dead letter após 3 falhas
- **Observabilidade:** todo `llm_call` logado com custo; view `cost_by_product` consultável pelo Jarvis
- **Idempotência:** tasks têm chave única `(pipeline_id, agent_name, mode)` pra evitar duplicação

---

## 14. Open Decisions

- WhatsApp como canal alternativo de chat — adiado pra v3
- Integrações Meta/Google Ads — adiado pra v3
- Modelo alternativo de vídeo (Sora, Kling) — quando preço VEO 3 incomodar
