# AdCraft v2 — Instruções para o Claude Code

## Contexto do projeto

AdCraft v2 é uma plataforma de marketing autônomo controlada por linguagem natural. O usuário (CMO) conversa com **Jarvis** que orquestra agentes de IA para pesquisa de avatar, mercado, ângulos, copy (3 hooks + 3 bodies + 3 CTAs aprovados por componente) e geração de vídeo VEO 3.

A v2 abandona o pipeline fixo do v1 em favor de **planejamento dinâmico via capability registry**. **Leia o PRD_v2.md antes de qualquer implementação.** Leia também o MIGRATION_GUIDE.md para saber o que aproveitar/apagar do v1.

## Estado do projeto

**Aproveitado da v1 (ver MIGRATION_GUIDE.md):**
- Migrations 001-013 (mantidas, estendidas)
- 5 prompts de agentes íntegros (`persona_builder`, `market_researcher`, `angle_strategist`, `compliance_checker`, mais o `copy_writer` refatorado como `copy_hook_generator`)
- Models Pydantic do `backend/app/models/state.py` como referência pro schema Drizzle
- Tools `web_search` e `read_page`

**Apagado/arquivado da v1:**
- Frontend React Flow canvas + stores Zustand
- 10 prompts movidos pra `prompts/_archive/v3-future/`
- Tools de Ad Library, YouTube, Amazon
- Agentes de Meta/Google Ads, scaler, performance_analyst, utm_structurer

**Em construção (v2):**
- Workers Node.js TypeScript
- Migrations v2 (Drizzle)
- Capability registry + planner
- Knowledge layer + niche intelligence
- Chat Jarvis com SSE + Mermaid
- Tela `/products/[sku]/copies` (aprovação por componente)

## Skills disponíveis

| Tarefa | Skill |
|---|---|
| Workers Node.js, polling, agent router | `@.claude/skills/nodejs-workers.md` |
| Banco PostgreSQL, migrations | `@.claude/skills/database-schema.md` |
| Drizzle ORM com Supabase | `@.claude/skills/drizzle-supabase.md` |
| **Planner do Jarvis** | `@.claude/skills/jarvis-planner.md` |
| **Knowledge layer + reference resolver** | `@.claude/skills/knowledge-layer.md` |
| **pgvector + busca híbrida** | `@.claude/skills/pgvector-search.md` |
| **Otimização de custo Gemini** | `@.claude/skills/gemini-cost-optimization.md` |
| Chat Jarvis SSE | `@.claude/skills/jarvis-chat-sse.md` |
| VEO 3 + FFmpeg | `@.claude/skills/veo3-video.md` |
| Componentes visuais | `@.claude/skills/frontend-adcraft.md` |
| Realtime Supabase | `@.claude/skills/websocket-realtime.md` |
| Gerenciar agentes/tools/skills | `@.claude/skills/manage-{agents,tools,skills}.md` |

## Regras obrigatórias

### Banco de dados
1. Migrations v2 ficam em `/migrations/v2/` — nunca misturar com 001-013
2. snake_case com comentários em todas as colunas
3. Merge JSONB obrigatório (`state || partial::jsonb`) — nunca substituição total
4. RLS em toda tabela com `user_id` (mesmo single-user, prepara pra v3)

### Workers e agentes
5. Context builder obrigatório — nunca passe `pipeline.state` completo pro agente
6. Cada agente escreve apenas no seu campo do `state`
7. `FOR UPDATE SKIP LOCKED` na query de polling de tasks
8. Falha com retries esgotados → pipeline `failed` + notificação

### Aprovações e fluxo
9. Aprovação de copy é **por componente**, nunca por copy completa
10. `copy_combinations` só pode ser inserido se hook+body+cta estão `approved`
11. `video_maker` só roda em combinações com `selected_for_video=true`

### Storage e credenciais
12. R2 + Supabase atomicamente
13. Credenciais somente via `.env` — nunca hardcoded

### Pipelines (regras v2)
14. **Pipelines são planejados, nunca hardcoded.** Todo DAG vem do `/lib/jarvis/planner.ts` consultando `agent-registry.ts`. Nenhum lugar do código pode ter sequência fixa.
15. **Toda escrita em `pipeline.state` também escreve em `product_knowledge`** na mesma transação, e enfileira embedding via `enqueueEmbedding(source_table, source_id)`.
16. **Tagging convention obrigatória.** Todo asset tem `tag` UNIQUE no formato `SKU_v{N}_{H|B|C}{slot}[_{...}]`. Gerada por trigger ou pelo código de criação. Nunca opcional.
17. **Model assignment via registry.** Nenhuma chamada LLM hardcoda modelo — sempre lê `AGENT_REGISTRY[name].model`.
18. **Toda chamada LLM passa por `lib/llm/gemini-client.ts`** que faz prompt caching, batching de embeddings, e logging em `llm_calls`. Chamadas diretas ao SDK do Gemini são proibidas fora desse arquivo.
19. **Budget circuit breaker.** Antes de cada chamada LLM, worker verifica `pipelines.cost_so_far_usd` vs `pipelines.budget_usd`. Se estourar, pausa pipeline e cria approval `budget_exceeded`.

## Stack técnica

```
Frontend:    Next.js 14 · Tailwind · TypeScript · mermaid.js
LLM:         Gemini 2.5 Pro (criativos) + 2.5 Flash (Jarvis/utils)
Embeddings:  Gemini gemini-embedding-001 (768 dim)
Video:       VEO 3
Database:    Supabase PostgreSQL 15 + pgvector + Drizzle
Storage:     Cloudflare R2
Workers:     Node.js TypeScript · polling 5s
```

## Estrutura de pastas

```
adcraft/
├── CLAUDE.md · PRD_v2.md · MIGRATION_GUIDE.md · .env
├── app/
│   ├── (chat)/page.tsx              ← tela Jarvis
│   ├── products/[sku]/copies/       ← aprovação por componente
│   ├── creatives/ · demandas/
│   └── api/
│       ├── chat/route.ts            ← SSE
│       ├── products/ · pipelines/
│       └── copy-components/[id]/{approve,reject}/
├── workers/
│   ├── task-runner.ts
│   ├── lib/
│   │   ├── agent-registry.ts        ← capability map (regra 14)
│   │   ├── context-builder.ts       ← + injeção de niche learnings
│   │   ├── seed-next-task.ts
│   │   └── knowledge-writer.ts      ← regra 15
│   └── agents/
│       ├── avatar-research.ts · market-research.ts · angle-generator.ts
│       ├── copy-hook-generator.ts   ← suporta 4 modos
│       ├── anvisa-compliance.ts · video-maker.ts · niche-curator.ts
│       └── prompts/                 ← .md files (regra: separar prompt de código)
├── lib/
│   ├── db.ts · schema/
│   ├── llm/gemini-client.ts         ← regra 18: único ponto de chamada LLM
│   ├── llm/prompt-cache.ts
│   ├── embeddings/gemini-embeddings.ts
│   ├── jarvis/
│   │   ├── planner.ts               ← topological sort sobre registry
│   │   ├── reference-resolver.ts    ← @ e /
│   │   └── intent-classifier.ts
│   ├── knowledge/
│   │   ├── product-knowledge.ts
│   │   └── niche-learnings.ts
│   ├── tagging.ts                   ← regra 16
│   └── r2.ts
├── components/
│   ├── chat/{MessageList,MessageInput,MentionPicker,PlanPreviewCard,ApprovalCard}.tsx
│   ├── products/CopyComponentBoard.tsx
│   └── ui/
└── migrations/
    ├── 001 ... 013                  ← v1 (não alterar)
    └── v2/                          ← Drizzle
```

## Formato do prompt para o Claude Code

```
Leia PRD_v2.md seção [X] e @.claude/skills/[skill].md
e implemente [componente] em [caminho] seguindo exatamente
as especificações sem adicionar nada que não está documentado.
Antes de criar arquivos, verifique MIGRATION_GUIDE.md
para saber se já existe equivalente no backend/app/ do v1
que possa ser portado.
```
