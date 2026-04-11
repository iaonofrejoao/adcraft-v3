# CHANGELOG — AdCraft

Registro cronológico de alterações significativas no projeto.

---

## 2026-04-11 16:55 (BRT)

### ✅ Implementação da Fase 3 — Agentes (TypeScript)

Finalizada a portagem dos agentes principais para a nova arquitetura de workers em TypeScript.
- **`avatar_research`**: Portado de `persona_builder.md`, integrado ao `context-builder` e `gemini-client`.
- **`market_research`**: Portado de `market_researcher.md`, focado em análise de viabilidade e margem.
- **`angle_generator`**: Portado de `angle_strategist.md`, define USP e hooks iniciais.
- **`copy_hook_generator`**: Evoluído para suporte a 3 variantes por componente (Hooks/Bodies/CTAs) e 4 modos de execução (`full`, `hooks_only`, etc.).
- **`anvisa_compliance`**: Sistema de auditoria em batch que valida componentes contra políticas de ads e ANVISA.
- **`niche_curator`**: Novo agente de manutenção que consolida sinais humanos (aprovações/rejeições) em aprendizados de nicho (`niche_learnings`).
- **Infraestrutura**: Criado `workers/lib/knowledge.ts` para persistência atômica de artifacts e enfileiramento de embeddings.
- **Estabilização**: Aplicados type-casts (`as any`) em consultas Drizzle para contornar incompatibilidade de versão entre pacotes (`workers` @ 0.36.4 vs `frontend` @ 0.45.2).

---

## 2026-04-11 13:26 (BRT)


### ✅ Início da Migração V1 -> V2

- Inicializado projeto Node.js padrão com Next.js, Zod e Drizzle.
- Convertido os esquemas do backend em Pydantic para Zod.
- Transcritas as Tools `web_search` e `read_page` para TypeScript, usando Cheerio para parsing da estrutura da V2.
- Adicionado endpoint mock SSE (Server Sent Events) para `jarvis`.
- Adicionadas definições de tabela PostgreSQL baseadas na V2 do PRD ao Drizzle.
- Arquivos de V1 isolados via arquivo '.v2-archived' e referenciados adequadamente.

---

## 2026-04-06 21:18 (BRT)

### ✅ Finalização da Fase 7 (Testes Unitários & WebSockets)

Implementados e validados os últimos componentes da estrutura de APIs:
- **WebSocket Route (`/ws/execution/{id}`)**: Estabelecido endpoint que acopla na connection-pool (`ConnectionManager`) enviando real-time feed de custo de execuções.
- **Roteamento Central do FastAPI**: Confirmados e amarrados os 7 principais routers dentro de `main.py`, sem ocorrência de falhas com pydantic ou injeção.
- **PyTest Unit API Tests**: Injetado framework PyTest sob o pacote `backend/tests/unit/api/test_api_endpoints.py` mockando todos os sub-sistemas persistentes (Celery e Supabase) globalmente para todas as endpoints geradas (Projects, Assets, Campaigns, Executions, Assistant, Websockets e Niches). Cobertura total aprovando sem falhas (8/8).

Com isso a Fase 7 foi finalizada.

---

## 2026-04-06 21:10 (BRT)

### ✅ Setup e CRUD das rotas da API — Finalizado (`executions.py`, `assets.py`, `campaigns.py`, `niches.py`, `assistant.py`)

A arquitetura REST das rotas descritas na **Seção 8 do PRD** foi finalizada com sucesso nas camadas de controllers da API via `FastAPI`.

- **`/executions`**: Adicionados enfileiramentos assíncronos (`POST / executions/` chamando as `run_execution` no `Celery`), retornos de dados de custo granular interligados, retornos unificados de state do Execution Engine e soft triggers (`resume`, `approve_node`).
- **`/assets`**: Implementado as paginações com listagem otimizada + join das tabelas para preenchimento de `AssetCard`, retornos dinâmicos para `AssetDetailResponse` contendo o `Feedback History` e soft-deletion (`DELETE /assets/{id}`).
- **`/campaigns`**: Construída base para recuperar `snapshots` agendados do Celery (Performance Analyst) via `GET /campaigns/{id}/metrics`, além de triggers diretos de proxy API (`/pause`, `/activate`) com verificação de segurança no banco.
- **`/niches` e `/knowledge`**: Criada estruturação de aprovação manual via filas pendentes e status tracking de treinamento dos subnós. As endpoints de `POST /knowledge/{item_id}/[approve|reject]` transferem o conhecimento para a `niche_memory` atrelando o User ownership.
- **`/assistant`**: Gerador da rota protótipo que será convertida em Function Calls na futura base Gemini. A topologia encontra-se isolada ao `user_id` e pronta pra injetar a Natural Language em consultas de banco reais.

---

## 2026-04-06 21:05 (BRT)

### ✅ Implementado CRUD completo de Projetos — `backend/app/api/projects.py`

Implementação dos endpoints de projeto exigidos na seção 8 do PRD, utilizando os modelos Pydantic recém-criados.

| Método   | Endpoints        | Testado                 | Detalhe                                                                                                                                                          |
| -------- | ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/projects`      | Pendente integrações UI | Lista projects do user ativo com subselect no relacionamentos (incluindo produto vinculado e nicho associado) usando a structure ProjectCard.                    |
| `POST`   | `/projects`      | Pendente integrações UI | Lógica avançada garantindo a coerência: Busca/Cria o Nicho, Cria o Produto Atrelado a ele e então em fim injeta tudo no payload da criação principal do Project. |
| `GET`    | `/projects/{id}` | Pendente integrações UI | Traz as estatísticas do banco de dados agregando as informações do PRD.                                                                                          |
| `PATCH`  | `/projects/{id}` | Pendente integrações UI | Atualiza a configuração do projeto verificando sua existência via soft-delete check e injeta enum serialization on-the-fly (`orchestrator_behavior_on_failure`). |
| `DELETE` | `/projects/{id}` | Pendente                | Apenas aplica data na flag `deleted_at` como requisitado.                                                                                                        |

---

## 2026-04-06 20:01 (BRT)

### ✅ Completados testes de integração — `tests/integration/test_execution_engine.py`

Validados todos os 13 testes do ExecutionEngine cobrindo o fluxo orquestrado do AdCraft.

| Componente        | Testes incluídos                                                                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExecutionEngine` | Execução sequencial dos agentes (nodes-1 a 8), checagem de exclusão correta dos campos paralelos (nodes-8 e 9), retomada após falha (node-5 start), aprovação com checkpoint programado (node-3), e fallback/falhas de validações. Mocked Supabase fluent chain, agentes paralelos configurados e StateManager. |

Foram corrigidas referências do `get_supabase` nos mocks e ajustada lógica de fallback de DAG (Kahn's) de waves para isolamento total nos testes!

---

## 2026-04-05 23:55 (BRT)

### ✅ Completados testes unitários — `tests/unit/tools/` (8 arquivos)

Validados os 6 testes existentes (criados anteriormente) e criados os 2 faltantes para cobrir 100% das tools.

| Arquivo de teste                    | Tool testada             | Testes                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_web_search.py` ✓              | `web_search.py`          | 5 — placeholder, API real, cap 10, 401 error, query vazia                                                                                                                                                                                                                                                 |
| `test_read_page.py` ✓               | `read_page.py`           | 5 — body text, JSON-LD, timeout, 404, meta description                                                                                                                                                                                                                                                    |
| `test_search_ad_library.py` ✓       | `search_ad_library.py`   | 7 — placeholder, API real, days_running filter, limit, 401                                                                                                                                                                                                                                                |
| `test_search_youtube.py` ✓          | `search_youtube.py`      | 10 — videos (placeholder/quota/real/order), comments (real/disabled/placeholder), transcript (found/not found), combined search                                                                                                                                                                           |
| `test_transcribe_vsl.py` ✓          | `transcribe_vsl.py`      | 7 — YouTube/youtu.be, unknown URL, Vturb/yt-dlp, local file, success fields, fail fields, no transcript                                                                                                                                                                                                   |
| `test_generate_image.py` ✓          | `generate_image.py`      | 12 — mock provider, quantity clamp, rate limiter, providers selection, Flux/Ideogram/Fal sem key, Flux API mockada                                                                                                                                                                                        |
| **`test_generate_video.py`** ⭐      | `generate_video.py`      | 16 — mock provider, duration clamp, rate limiter, aspect ratios, provider selection, Runway/Kling/Pika sem key, Runway API mockada (success/fail/duration mapping), Kling API mockada, Pika (success/max 5s), helpers                                                                                     |
| **`test_render_video_ffmpeg.py`** ⭐ | `render_video_ffmpeg.py` | 18 — generate_srt (básico/words_per_line/vazio/duração), _fmt_srt_time, validate_video_quality (valid/curto/longo/baixa res/baixo fps/sem áudio/inexistente/múltiplos issues), concatenate_clips (vazio/um clipe), export (ratio desconhecido), ASPECT_RATIO_CONFIG, ffmpeg missing, execute_generate_srt |

**⭐ Novos** | ✓ Já existentes (validados)

**Total: 80 testes em 8 arquivos cobrindo todas as 8 tools.**

---

## 2026-04-05 21:35 (BRT)

### ✅ Criados modelos Pydantic de API — `project.py`, `execution.py`, `asset.py`, `campaign.py`, `notification.py`

Implementação dos schemas Pydantic de request/response para todos os endpoints da API (PRD Seções 7-8).

| Arquivo           | Classes principais                                                                                                                                                                                   | Endpoints cobertos                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `project.py`      | `CreateProjectRequest`, `UpdateProjectRequest`, `ProjectResponse`, `ProjectCard`, `ProjectDetailResponse`, `ProductBase`, `ProductResponse`, `ProjectStats`                                          | `/projects` CRUD                                  |
| `execution.py`    | `CreateExecutionRequest`, `ExecutionResponse`, `ExecutionDetailResponse`, `ApproveNodeRequest`, `RejectNodeRequest`, `NodeActionResponse`, `NodeStatus`, `NodeStatusUpdate`, `CostBreakdownResponse` | `/executions` CRUD + approve/reject/resume/cancel |
| `asset.py`        | `AssetFilterParams`, `UpdateAssetRequest`, `AssetResponse`, `AssetCard`, `AssetDetailResponse`, `FeedbackEntry`, `AssetType`, `ApprovalStatus`                                                       | `/assets` CRUD + filtros                          |
| `campaign.py`     | `CampaignFilterParams`, `CampaignResponse`, `PerformanceSnapshot`, `CampaignMetricsResponse`, `CumulativeMetrics`, `LaunchReviewPayload`, `AdPreview`, `AdsetPreview`                                | `/campaigns` + métricas + revisão de lançamento   |
| `notification.py` | `NotificationResponse`, `NotificationListResponse`, `MarkNotificationReadRequest`, `CreateNotification`, `NotificationType`                                                                          | Notificações via Supabase Realtime                |

**Validação:** Todos os 5 arquivos compilam sem erros com `py_compile`.

---

## 2026-04-05 21:15 (BRT)

### ✅ Criado `backend/app/models/state.py` — Shared State Pydantic Models

Implementação completa dos modelos Pydantic representando o **Shared State Schema** (PRD Seção 6).

**Classes criadas (20 modelos principais + 14 enums + sub-modelos auxiliares):**

| Modelo             | Descrição                                                | Agente        |
| ------------------ | -------------------------------------------------------- | ------------- |
| `ExecutionState`   | Raiz — 24 campos, serializa/deserializa o JSONB completo | —             |
| `ProductInfo`      | Dados básicos do produto afiliado                        | Input usuário |
| `ProductAnalysis`  | Análise da VSL e página de vendas                        | Agente 1      |
| `MarketAnalysis`   | Viabilidade de mercado                                   | Agente 2      |
| `PersonaProfile`   | Persona do comprador ideal                               | Agente 3      |
| `AngleStrategy`    | Ângulo criativo e hooks A/B                              | Agente 4      |
| `BenchmarkData`    | Referências de criativos vencedores                      | Agente 5      |
| `CampaignStrategy` | Estratégia de campanha                                   | Agente 6      |
| `Scripts`          | Roteiros com scene breakdown                             | Agente 7      |
| `Copy`             | Textos de anúncio (headlines, body, CTA)                 | Agente 8      |
| `Character`        | Personagem visual consistente                            | Agente 9      |
| `Keyframes`        | Keyframes por cena                                       | Agente 10     |
| `VideoClips`       | Clipes de vídeo por cena                                 | Agente 11     |
| `FinalCreatives`   | Criativos finais renderizados                            | Agente 12     |
| `Compliance`       | Verificação de políticas de ads                          | Agente 13     |
| `Tracking`         | UTM e link de afiliado                                   | Agente 14     |
| `FacebookCampaign` | Campanha Facebook Ads                                    | Agente 15     |
| `GoogleCampaign`   | Campanha Google Ads                                      | Agente 16     |
| `Performance`      | Análise de performance                                   | Agente 17     |
| `ExecutionMeta`    | Metadados operacionais                                   | Sistema       |

**Enumerações:** `ExecutionStatus`, `AffiliatePlatform`, `OrchestratorBehavior`, `VSLTranscriptionStatus`, `ViabilityVerdict`, `CompetitionLevel`, `TrendDirection`, `CreativeFormat`, `FunnelStage`, `CampaignObjective`, `NarrativeStructure`, `CampaignStatus`, `ComplianceSeverity`, `RecommendedAction`

**Sub-modelos auxiliares:** `OfferDetails`, `PersonaFullProfile`, `PersonaPsychographic`, `HookVariation`, `BenchmarkHook`, `SceneBreakdown`, `ScriptItem`, `HeadlineVariation`, `CharacterVariation`, `KeyframeItem`, `VideoClipItem`, `MarketingMetadata`, `CreativeItem`, `ComplianceIssue`, `UTMParameters`, `PerformanceMetrics`, `NextExecutionSuggestion`, `QualityWarning`, `LastError`

**Validação:** Todos os modelos instanciam corretamente com defaults. Testado com Pydantic v2 no Python 3.14.
