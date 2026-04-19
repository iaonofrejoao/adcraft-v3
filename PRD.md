# AdCraft v2 — Product Requirements Document (Arquitetura Ultron)

**Versão:** 2.1 — Ultron / Claude Code
**Atualizado:** Abril 2026
**Legado:** Ver `PRD-jarvis-legacy.md` para arquitetura anterior (Jarvis + workers)

---

## 1. Executive Summary

AdCraft é uma plataforma de marketing com IA para criação de criativos e gestão de campanhas de tráfego pago. O usuário conversa com **Claude Code (Ultron)** — que atua como orquestrador central — e recebe como output um pacote completo de campanha: pesquisa de mercado e avatar, estratégia, copy, roteiro, criativos visuais, estrutura de anúncios para Meta e Google, e plano de escala.

A arquitetura Ultron abandona o modelo de workers autônomos (Node.js polling) em favor de **Claude Code como motor de execução**. Cada agente é um skill file lido por um subagente Claude spawned on-demand. O estado vive no banco (Supabase). O orquestrador (Claude Code) lê o DAG, spawna agentes em sequência, gerencia loops de revisão e grava artefatos.

**Diferencial arquitetural:** inteligência de execução fica no LLM (Claude), não no código. O pipeline é um DAG declarativo (`full-pipeline.yaml`). Cada agente é stateless — o contexto vem dos artefatos do banco.

---

## 2. O que o AdCraft faz

### Jornada do usuário

1. Usuário cadastra produto informando URL da VSL + `target_country` + `target_language`
2. Usuário pede execução de pipeline no chat: `"Roda pipeline completo para o produto X (product_id: UUID)"`
3. Claude Code lê o DAG, busca learnings vetoriais do nicho, spawna o Agente 1 (VSL Analysis)
4. Cada agente grava seu artefato no banco; o próximo agente lê o artefato do anterior
5. Ao final da Fase 1 (pesquisa), Claude Code reporta sumário e continua para Fase 2
6. Loops de revisão são acionados automaticamente se Creative Director ou Compliance bloquearem
7. Output final: estrutura de campanha completa salva no banco, visualizável no frontend

### O que o sistema produz (por fase)

| Fase | Agentes | Output |
|------|---------|--------|
| Pesquisa | 1–6 | Análise do produto, mercado, avatar, benchmark, ângulo campeão, estratégia de campanha |
| Criativo | 7–12 | Roteiro, copy (3H × 3B × 3CTA), personagem, keyframes, storyboard, brief criativo aprovado |
| Lançamento | 13–18 | Copy auditada, UTMs rastreados, campanha Facebook, campanha Google, diagnóstico de performance, plano de escala |

### O que o sistema NÃO faz

- Não sobe campanha automaticamente em Meta/Google (estrutura é entregue para o usuário criar)
- Não decide sem o usuário — loops de revisão escalam para aprovação humana após 2 tentativas
- Não gera materiais em idioma/mercado diferente do `target_country` cadastrado no produto

---

## 3. Arquitetura de Execução

### Stack atual

```
Frontend:    Next.js 14 App Router · Tailwind · TypeScript · Shadcn/ui
Database:    Supabase PostgreSQL + pgvector
ORM:         Drizzle (schema em frontend/lib/schema/index.ts)
LLM:         Claude (Anthropic) via Claude Code — motor principal
             Gemini — embeddings (gemini-embedding-001, 768 dim) + learning-extractor
Orquestrador: Claude Code (Ultron) — substitui Jarvis e workers
Workers ativos: gemini-embeddings.ts (batch embeddings) · learning-extractor.ts · learning-aggregator-cron.ts
Workers deprecados: task-runner.ts · agents/*.ts · gemini-client.ts
```

### Fluxo de execução

```
Usuário fala com Claude Code
        ↓
Claude Code lê full-pipeline.yaml (DAG)
        ↓
Busca learnings vetoriais do nicho (scripts/search/vector.ts)
        ↓
Spawna Agente 1 via Agent tool (subagente com skill file)
        ↓
Subagente executa, grava artefato via scripts/artifact/save.ts
        ↓
Claude Code lê próxima task do DAG, spawna Agente 2
        ↓
... repete até o Agente 18 ...
        ↓
scripts/learning/extract.ts — extrai learnings pós-pipeline
```

### Scripts de orquestração (DB bridge)

| Script | Função |
|--------|--------|
| `scripts/pipeline/create.ts` | Cria pipeline + tasks no banco |
| `scripts/pipeline/status.ts` | Consulta estado atual |
| `scripts/pipeline/complete-task.ts` | Marca task como concluída |
| `scripts/artifact/save.ts` | Salva artefato em product_knowledge (superseded + fila embeddings) |
| `scripts/artifact/get.ts` | Lê artefato de um pipeline |
| `scripts/copy/save-components.ts` | Salva hooks/bodies/CTAs em copy_components |
| `scripts/copy/update-compliance.ts` | Atualiza compliance_status por tag |
| `scripts/learning/extract.ts` | Extrai learnings pós-pipeline |
| `scripts/search/vector.ts` | Busca semântica nos learnings do nicho |

---

## 4. Sistema de 18 Agentes

### Visão geral do pipeline

O pipeline é um DAG de 18 agentes em 3 fases sequenciais. Cada agente é stateless: recebe contexto via artefatos do banco e grava seu output como novo artefato. O orquestrador (Claude Code) controla o fluxo.

```
PRODUTO (product_id + target_country + target_language)
    ↓
┌─────────────────────────────────┐
│ FASE 1 — PESQUISA (Agentes 1–6) │
└─────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ FASE 2 — CRIATIVO (Agentes 7–12) │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ FASE 3 — LANÇAMENTO (Agentes 13–18) │
└──────────────────────────────────────┘
    ↓
CAMPANHA PRONTA
```

---

### Fase 1 — Pesquisa

Objetivo: entender o produto e o mercado antes de criar qualquer material.

```
Agente 1 — VSL Analysis          → artifact: product
"Extrai o DNA do produto da VSL"
        ↓
Agentes 2 e 3 (paralelos)
Agente 2 — Market Research       → artifact: market
"Avalia viabilidade de mercado"
Agente 3 — Avatar Research       → artifact: avatar
"Constrói perfil do comprador ideal"
        ↓
Agente 4 — Benchmark Intelligence → artifact: benchmark
"Mapeia o que concorrentes estão fazendo"
        ↓
Agente 5 — Angle Generator        → artifact: angles
"Formula o posicionamento diferenciado"
        ↓
Agente 6 — Campaign Strategy      → artifact: campaign_strategy
"Define plataforma, budget, KPIs e sequência de lançamento"
```

**Dependências:**
- VSL Analysis: entrada do pipeline, sem dependências
- Market Research + Avatar Research: paralelos (dependem só do produto)
- Benchmark Intelligence: depende de Market Research
- Angle Generator: depende dos 4 anteriores
- Campaign Strategy: depende dos 5 anteriores

---

### Fase 2 — Criativo

Objetivo: produzir o pacote completo de materiais do anúncio.

```
Agentes 7, 8, 9 (paralelos)
Agente 7  — Script Writer         → artifact: script
"Roteiro do vídeo cena a cena"
Agente 8  — Copywriting           → artifact: copy_components (tabela separada)
"3 hooks × 3 bodies × 3 CTAs"
Agente 9  — Character Generator   → artifact: character
"Personagem visual do anúncio"
        ↓
Agente 10 — Keyframe Generator    → artifact: keyframes
"Prompt VEO 3 por cena"
        ↓
Agente 11 — Video Maker           → artifact: video_assets
"Storyboard final (cap: 5 por execução)"
        ↓
Agente 12 — Creative Director     → artifact: creative_brief
"Avalia, ranqueia combinações, aprova ou bloqueia"
```

**Ponto crítico:** O Creative Director é o único filtro de qualidade criativa. Ele pontua cada combinação H×B×CTA de 0–100 e emite `approved_for_production: true/false`. Se bloquear, aciona o Loop 1.

---

### Fase 3 — Lançamento

Objetivo: preparar e estruturar a campanha para veiculação.

```
Agentes 13 e 14 (paralelos)
Agente 13 — Compliance Check      → artifact: compliance_results
"Audita copy contra FTC/ASA/CONAR por target_country"
Agente 14 — UTM Builder           → artifact: utms
"Gera links rastreados por variante e plataforma"
        ↓
Agentes 15 e 16 (paralelos)
Agente 15 — Facebook Ads          → artifact: facebook_ads
"Estrutura campanha Meta completa"
Agente 16 — Google Ads            → artifact: google_ads
"Estrutura campanha Google Search/Display"
        ↓
Agente 17 — Performance Analysis  → artifact: performance_report
"Analisa dados reais pós-veiculação"
        ↓
Agente 18 — Scaling Strategy      → artifact: scaling_plan
"Plano de escala: pausar, aumentar, testar"
```

**Regra crítica:** Facebook Ads e Google Ads usam **exclusivamente** `compliance_results.approved_combinations` como fonte de copy — nunca inferem aprovação da lista de issues.

---

### Artifact types por agente

| Agente | artifact_type | Tabela |
|--------|--------------|--------|
| vsl_analysis | `product` | product_knowledge |
| market_research | `market` | product_knowledge |
| avatar_research | `avatar` | product_knowledge |
| benchmark_intelligence | `benchmark` | product_knowledge |
| angle_generator | `angles` | product_knowledge |
| campaign_strategy | `campaign_strategy` | product_knowledge |
| script_writer | `script` | product_knowledge |
| copywriting | `copy_components` | copy_components (especial) |
| character_generator | `character` | product_knowledge |
| keyframe_generator | `keyframes` | product_knowledge |
| video_maker | `video_assets` | product_knowledge |
| creative_director | `creative_brief` | product_knowledge |
| compliance_check | `compliance_results` | copy_components (update) |
| utm_builder | `utms` | product_knowledge |
| facebook_ads | `facebook_ads` | product_knowledge |
| google_ads | `google_ads` | product_knowledge |
| performance_analysis | `performance_report` | product_knowledge |
| scaling_strategy | `scaling_plan` | product_knowledge |

---

## 5. Loops de Revisão

O pipeline tem 3 pontos de retorno controlados:

### Loop 1 — Creative Director bloqueia

```
Creative Director: approved_for_production = false
    ↓
Identifica qual agente refazer (revision_requests[].agent)
    ↓
Re-invoca agente com mesmo pipeline_id + novo task_id
    ↓
Artefato anterior → status 'superseded'
    ↓
Creative Director reavalia
    ↓
Máximo 2 tentativas → se ainda bloqueado: escala para o usuário
```

### Loop 2 — Compliance bloqueia top_combination

```
compliance_results.approved_combinations avaliado
    ↓
Se approved_combinations NÃO está vazio:
    Facebook Ads + Google Ads usam próxima combinação aprovada
    Registram em setup_notes: "top_combination bloqueada por compliance"
    ↓
Se approved_combinations ESTÁ vazio:
    Pipeline pausa
    Reportar ao usuário: "Nenhuma combinação aprovada. Necessário refazer copywriting."
    Aguardar instrução
```

### Loop 3 — Scaling: todos os criativos são losers

```
Performance Analysis: todos criativos com hook_rate < 15% por 14 dias
    ↓
Scaling Strategy sinaliza ausência de winner
    ↓
Criar pipeline criativo filho:
npx tsx scripts/pipeline/create.ts \
  --product-id <mesmo product_id> \
  --type criativo \
  --parent-pipeline <pipeline_id_original>
    ↓
Brief para Fase 2: usar angles.alternative_angles[0] do pipeline pai
Reutilizar pesquisa (product, market, avatar, benchmark, angles)
Ir direto para Fase 2 — não refazer pesquisa
```

---

## 6. Multi-mercado — target_country como Filtro Transversal

Cada produto tem `target_country` e `target_language` definidos no banco (`products.target_country`, `products.target_language`). Esses dois campos propagam comportamento diferente por toda a cadeia de agentes.

### Como funciona a propagação

Antes de spawnar qualquer subagente, Claude Code injeta obrigatoriamente:

```
## Mercado-alvo do produto
- target_country: <valor>
- target_language: <valor>
- Todos os materiais devem ser gerados em <target_language>,
  adaptados para o contexto cultural, regulatório e econômico de <target_country>.
```

### Impacto por camada

| Camada | O que muda |
|--------|-----------|
| Pesquisa | Fontes corretas por país; benchmarks de CPM/CPC do mercado-alvo |
| Estratégia | Moeda nos KPIs; plataformas disponíveis; CPA ajustado ao ticket local |
| Criativo | Idioma da copy; idioms e referências culturais; preços em moeda local |
| Compliance | FTC (US) · ASA (GB) · CONAR (BR) — regulação do país de destino |
| Anúncios | Geo-targeting configurado; keywords e RSAs no idioma correto |
| Performance | Benchmarks de referência do mercado-alvo |

### Valores de referência

| target_country | target_language | Mercado |
|----------------|-----------------|---------|
| `BR` | `pt-BR` | Brasil (padrão) |
| `US` | `en-US` | Estados Unidos |
| `GB` | `en-GB` | Reino Unido |
| `ES` | `es-ES` | Espanha |
| `MX` | `es-MX` | México |

---

## 7. Sistema de Memória Cumulativa

### Product Knowledge

Cada artefato gravado em `product_knowledge` tem `status: fresh` enquanto válido. Quando um agente é re-executado (ex: Loop 1), o artefato anterior vira `superseded` e um novo é gravado. O orquestrador sempre lê o artefato `fresh` mais recente por `artifact_type`.

### Niche Learnings

Após cada pipeline, `scripts/learning/extract.ts` extrai padrões que funcionaram (ou não) e os consolida em `niche_learnings` por `niche_id`. Tipos de learnings:

`angle_winner` · `angle_loser` · `hook_pattern` · `creative_format` · `objection` · `language_pattern` · `avatar_insight` · `compliance_violation` · `performance_pattern`

### Injeção nos agentes de pesquisa

Antes de spawnar Market Research, Avatar Research e Benchmark Intelligence, o orquestrador executa busca vetorial:

```bash
npx tsx scripts/search/vector.ts --query "<produto + nicho>" --niche-id <uuid> --limit 5
```

Os top-5 learnings são injetados no prompt do subagente como contexto adicional — o sistema fica progressivamente mais inteligente por nicho.

### Niche Curator (job avulso)

Não é agente de pipeline — é executado sob demanda ou via cron. Consolida `execution_learnings` em `niche_learnings` com fórmula de reforço (occurrences × confidence). Usa `workers/cron/learning-aggregator-cron.ts`.

---

## 8. Schema do Banco (tabelas principais)

Schema canônico em `frontend/lib/schema/index.ts` (fonte de verdade).

### `products`
```sql
id, name, platform, niche_id,
target_country text default 'BR',   -- filtro de mercado
target_language text default 'pt-BR',
ticket_price, commission_percent,
vsl_url, vsl_source, vsl_duration_seconds, vsl_file_size_bytes,
viability_score, status, created_at, updated_at
```

### `pipelines`
```sql
id, product_id, type (full|pesquisa|criativo|lancamento),
status (pending|running|completed|failed),
created_at, updated_at, completed_at
```

### `tasks`
```sql
id, pipeline_id, agent_name, mode,
depends_on uuid[],
status (waiting|pending|running|completed|failed),
retry_count, started_at, completed_at, error,
confirmed_oversized bool  -- cap do video_maker
```

### `product_knowledge`
```sql
id, product_id, pipeline_id, artifact_type, artifact_data jsonb,
status (fresh|superseded),
created_at, superseded_at, superseded_by
```

### `copy_components`
```sql
id, pipeline_id, product_id, component_type, slot_number,
tag (unique), content,
compliance_status (pending|approved|rejected),
approval_status (pending|approved|rejected),
created_at
```

### `copy_combinations`
```sql
id, product_id, pipeline_id, tag (unique),
hook_id, body_id, cta_id,
selected_for_video bool, created_at
```

### `niche_learnings`
```sql
id, niche_id, learning_type, content, evidence jsonb,
confidence float, occurrences int,
status (active|archived), created_at, last_reinforced_at
```

---

## 9. Convenção de Tags (Naming System)

Determinístico, único, rastreável por toda a cadeia.

```
Produto:       CITX                            (SKU — 4 letras)
Hook:          CITX_v1_H1
Body:          CITX_v1_B2
CTA:           CITX_v1_C1
Combinação:    CITX_v1_H1_B2_C1               (tag canônica)
Versão:        v{N} — bumpa quando artefatos de pesquisa são regenerados
```

Tags são usadas para cruzar dados entre Ads Manager, banco e analytics.

---

## 10. Frontend (Read-only)

O frontend é **somente leitura** — não dispara LLM calls, não interage com agentes.

### Telas atuais

| Rota | Status | Descrição |
|------|--------|-----------|
| `/demandas` | ✅ 80% | Lista + detalhe com timeline. Pendente: logs WebSocket realtime |
| `/products` | ✅ 70% | Grid de produtos + 6 sub-abas no detalhe |
| `/products/[sku]` | ✅ 70% | Overview, Copies, Criativos, Pipeline, Artefatos |
| `/` | ✅ redirect | Redireciona para /demandas |

### Regras absolutas de frontend

- NUNCA fazer fetch de LLM (Gemini, Anthropic) a partir do frontend
- Lógica de dados sempre em hooks em `hooks/`
- CSS sempre via Tailwind + tokens do design system (nunca `style={{}}` ou hex hardcoded)
- Componentes Shadcn/ui em `components/ui/` — não modificar arquivos gerados

---

## 11. Estado das Fases V2

| Fase | Status | Resumo |
|------|--------|--------|
| A — Migração Claude | ↩️ revertido | Provider padrão revertido para Gemini; Claude mantido como opção |
| B — Jarvis tool use | ⏸️ pausado | Arquivos preservados. Motor migrado para Claude Code |
| C — Tela Demandas | ✅ 80% | Pendente: logs WebSocket em tempo real |
| D — Tela Produto | ✅ 70% | Pendente: diff de copy, score de viabilidade |
| E — Memória cumulativa | ✅ 90% | Extrator + aggregator + busca vetorial funcionando |
| F — Polish + testes | ⬜ 0% | FilterBar, keyboard shortcuts, Playwright E2E — não iniciado |
| G — Ultron (Claude Code) | ✅ 100% | 18 agent skills + pipeline DAG + DB bridge scripts |

---

## 12. Pendências e Decisões Abertas

| Decisão | Contexto |
|---------|---------|
| Fórmula `overall_assessment` no Performance Analysis | `underperforming` começa em `target × 1.3` ou em `max_acceptable_cpa_brl`? Ranges podem se sobrepor |
| Fallback quando `approved_combinations` vazio | Bloquear pipeline aguardando usuário, ou criar pipeline criativo filho automaticamente? |
| `niche_curator` — gatilho de disparo | Cron automático, manual sob demanda, ou gatilho após N learnings validados? |
| Multi-país por produto | Atualmente 1 produto = 1 `target_country`. Para múltiplos mercados, duplicar produto ou adicionar array? |
| Integração Meta/Google Ads | Subir campanha automaticamente — adiado |
| WhatsApp como canal de chat | Adiado |
