# AdCraft V2 — Arquitetura

**Última atualização:** 2026-04-16

---

## Visão geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USUÁRIO (browser)                           │
│                                                                     │
│  /          /products  /demandas  /insights  /creatives             │
│  (Jarvis)                                                           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS / SSE
┌────────────────────────▼────────────────────────────────────────────┐
│                    FRONTEND — Next.js 14 App Router                 │
│                                                                     │
│  app/page.tsx ──────────── Jarvis chat (SSE streaming)             │
│  app/products/             CRUD de produtos + 6 sub-abas           │
│  app/demandas/             Lista + detalhe de pipelines             │
│  app/insights/             Dashboard de memória cumulativa          │
│                                                                     │
│  lib/jarvis/               Claude agent loop (Fase B)               │
│    claude-agent.ts         Tool use, até 25 rounds, prompt cache   │
│    tool-registry.ts        11 tools registradas                     │
│    tools/                  Implementações (DB, files, memory, web)  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Supabase JS SDK + REST
┌────────────────────────▼────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + RLS)                      │
│                                                                     │
│  pipelines          tasks              products                     │
│  copy_components    copy_combinations  product_knowledge            │
│  niche_learnings    niches             embeddings (queue)           │
│                                                                     │
│  [Fase E] execution_learnings  learning_patterns  insights          │
│                                                                     │
│  RLS habilitado em todas as tabelas                                 │
│  pgvector (dim 768) para embeddings                                 │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Drizzle ORM (polling, FOR UPDATE SKIP LOCKED)
┌────────────────────────▼────────────────────────────────────────────┐
│                    WORKERS — Node.js / TypeScript                   │
│                                                                     │
│  task-runner.ts            Loop principal (poll 5s)                │
│                                                                     │
│  agents/                                                            │
│    avatar-research.ts      Claude Opus 4.6 — persona + avatar      │
│    market-research.ts      Claude Opus 4.6 — viabilidade mercado   │
│    angle-generator.ts      Claude Opus 4.6 — ângulos de copy       │
│    copy-hook-generator.ts  Claude Opus 4.6 — copies completos      │
│    anvisa-compliance.ts    Claude Sonnet 4.6 — compliance ANVISA   │
│    niche-curator.ts        Claude Sonnet 4.6 — curadoria de nicho  │
│    video-maker.ts          Gemini/Veo 3 — scripts + vídeos         │
│                                                                     │
│  agents/ [Fase E]                                                   │
│    learning-extractor.ts   Claude Sonnet 4.6 — extrai learnings    │
│                            após pipeline completar (async, não bloqueia) │
│                                                                     │
│  cron/ [Fase E]                                                     │
│    learning-aggregator-cron.ts  Claude Sonnet 4.6 — agrega         │
│                                  patterns diariamente (OS cron)    │
│                                                                     │
│  lib/embeddings/                                                    │
│    gemini-embeddings.ts    Batch worker — processa fila de         │
│                            embeddings (768d, Gemini)                │
│                            Suporta: product_knowledge, niche_learnings, │
│                            niches, execution_learnings              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de execução de um pipeline

```
Usuário (Jarvis ou UI)
        │
        ▼
  INSERT pipelines (status='pending')
  + INSERT tasks[] (status='pending', depends_on=[])
        │
        ▼
  task-runner.ts (poll 5s)
    SELECT FOR UPDATE SKIP LOCKED → pega task pendente
    Marca running → executa agente → marca completed
    seedNextTasks() → desbloqueia tasks dependentes
        │
        ▼ (quando isPipelineComplete)
  UPDATE pipelines SET status='completed'
  extractLearningsAsync(pipeline_id) → background
        │
        ▼
  learning-extractor.ts
    buildPipelineSummary() → coleta outputs de todas as tasks
    Claude Sonnet analisa → extrai até 8 learnings atômicos
    INSERT execution_learnings[]
    INSERT embeddings[] (fila, source_table='execution_learnings')
        │
        ▼ (cron diário, ou manual)
  learning-aggregator-cron.ts
    Agrupa learnings por (category, niche_id) com ≥ 3 learnings
    Claude Sonnet sintetiza → padrão por grupo
    UPSERT learning_patterns
    Para patterns com confidence ≥ 0.7 e ≥ 5 learnings:
      INSERT insights
        │
        ▼ (separado, pode rodar a qualquer momento)
  batchEmbeddingsWorker()
    Busca fila embeddings WHERE embedding IS NULL
    Resolve texto por source_table
    callEmbedding (Gemini embedding-001, 768d)
    UPDATE embeddings SET embedding = [...]
```

---

## Jarvis — Tool use loop

```
Usuário envia mensagem
        │
        ▼
  claude-agent.ts
  POST /api/jarvis/chat (SSE response)
        │
        ▼
  Claude Opus 4.6 (max 25 rounds)
    system_prompt (cacheado ephemeral)
    + histórico últimas 50 msgs
    + tool_definitions (11 tools)
        │
    ┌───▼──────────────────────────────────────────┐
    │  Round N                                     │
    │                                              │
    │  Claude decide → tool_use block              │
    │        │                                    │
    │        ▼                                    │
    │  buildToolExecutor() → switch (tool_name)   │
    │    query_products → Supabase                │
    │    trigger_agent  → INSERT pipelines+tasks  │
    │    read_file      → fs.readFileSync         │
    │    search_web     → Serper API (ou mock)    │
    │    query_learnings→ Supabase                │
    │    ...                                      │
    │        │                                    │
    │        ▼                                    │
    │  tool_result → volta para Claude            │
    └──────────────────────────────────────────────┘
        │
        ▼ (quando Claude gera text block sem tool_use)
  Resposta final → SSE flush → browser exibe
```

---

## Schema de dados — tabelas principais (Drizzle)

| Tabela | Propósito | Chave |
|--------|-----------|-------|
| `pipelines` | Execução de um goal para um produto | id, product_id, goal, status |
| `tasks` | Task individual dentro de um pipeline | id, pipeline_id, agent_name, status |
| `products` | Produtos cadastrados | id, name, niche_id, platform |
| `niches` | Categorias de nicho | id, slug, name |
| `copy_components` | Componentes de copy gerados | id, pipeline_id, component_type |
| `copy_combinations` | Combinações aprovadas | id, product_id, hook_id, body_id, cta_id |
| `product_knowledge` | Knowledge base do produto | id, product_id, artifact_type |
| `niche_learnings` | Learnings históricos por nicho (V1) | id, niche_id, content, confidence |
| `embeddings` | Fila de embeddings (queue) | id, source_table, source_id, embedding |
| `execution_learnings` | Learnings por pipeline (Fase E) | id, pipeline_id, category, observation |
| `learning_patterns` | Padrões agregados (Fase E) | id, category, niche_id, pattern_text |
| `insights` | Insights estratégicos curados (Fase E) | id, title, body, importance |

---

## Providers de LLM

| Provider | Usado por | Notas |
|----------|-----------|-------|
| Anthropic Claude Opus 4.6 | Jarvis, avatar_research, market_research, angle_generator, copy_hook_generator | Alta qualidade, maior custo |
| Anthropic Claude Sonnet 4.6 | anvisa_compliance, niche_curator, learning_extractor, aggregator | Custo-benefício |
| Google Gemini (Veo 3) | video_maker | Único use case que mantém Gemini |
| Google Gemini embedding-001 | batchEmbeddingsWorker | 768 dimensões |
| Serper API | search_web (tool Jarvis) | Configurar SERPER_API_KEY |

---

## Variáveis de ambiente necessárias

Ver `.env.example` na raiz do projeto. Chaves obrigatórias:
- `DATABASE_URL` + `SUPABASE_*` — banco de dados
- `ANTHROPIC_API_KEY` — todos os agentes Claude + Jarvis
- `GEMINI_API_KEY` + `GOOGLE_CLOUD_*` — video_maker + embeddings
- `SERPER_API_KEY` — busca web do Jarvis (sem esta, retorna mock)
- `NEXT_PUBLIC_SUPABASE_*` — frontend

---

## Pendências de arquitetura (Fase F)

1. **Confirmação de ações via Jarvis** — `trigger_agent` deve pausar e mostrar modal antes de executar
2. **Write tools** — `create_product`, `update_pipeline_status` não existem no Jarvis ainda
3. **WebSocket real-time** — logs do task-runner chegam via polling, não SSE
4. **Observabilidade** — nenhum error tracking (Sentry), logs não são JSON estruturado
5. **CI/CD** — sem GitHub Actions para type-check automático
