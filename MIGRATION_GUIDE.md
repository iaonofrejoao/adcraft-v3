# MIGRATION_GUIDE.md — v1 → v2

Guia operacional de **o que apagar, mover, manter e portar** da v1 antes de começar a v2. Execute na ordem.

## 1. Backup primeiro

```bash
git checkout -b v2-migration
git tag v1-final
```

## 2. APAGAR (frontend v1 obsoleto)

```bash
rm -rf frontend/stores/                              # Zustand do React Flow
rm -rf frontend/components/canvas/                   # canvas se existir
rm -rf frontend/components/nodes/ frontend/components/edges/
rm -rf frontend/app/projects/                        # tela de projetos React Flow
rm -f frontend/package-lock.json frontend/node_modules/.package-lock.json
# Remover de package.json: reactflow, zustand, @reactflow/*
```

**Manter de `frontend/`:**
- `lib/` (clientes Supabase, utils)
- `components/ui/` (primitivos)
- `hooks/useSupabase`, `hooks/useRealtime` se existirem
- `tailwind.config.ts`, `next.config.mjs`, `tsconfig.json`

## 3. MOVER (prompts arquivados)

```bash
mkdir -p backend/app/agents/prompts/_archive/v3-future
cd backend/app/agents/prompts

mv script_writer.md character_generator.md keyframe_generator.md \
   video_generator.md campaign_strategist.md media_buyer_facebook.md \
   media_buyer_google.md utm_structurer.md performance_analyst.md \
   scaler.md benchmark_intelligence.md \
   _archive/v3-future/
```

Ler `prompts/_archive/v3-future/README.md` (gerado junto desta entrega) que explica quando cada um volta.

## 4. RENOMEAR

```bash
mv backend/app/agents/prompts/copy_writer.md \
   backend/app/agents/prompts/copy_hook_generator.md
```

Substituir conteúdo pelo novo `copy_hook_generator.md` (entregue nesta leva).

## 5. MANTER ÍNTEGRO (zero mudança)

- `prompts/persona_builder.md` → renomeado conceitualmente para `avatar_research` mas arquivo fica
- `prompts/market_researcher.md`
- `prompts/angle_strategist.md` → conceito vira `angle_generator`
- `prompts/compliance_checker.md` → conceito vira `anvisa_compliance`
- `prompts/product_analyzer.md` → opcional na v2 (não está nos 5 goals atuais, mas mantém pra possível goal `product_analysis` futuro). Move pra `_archive/v3-future/` se quiser limpeza máxima.

## 6. PORTAR (backend Python → TypeScript v2)

A v1 tem trabalho considerável aproveitável. Antes de criar do zero no v2, **sempre verifique**:

| Você precisa de... | Verifique em... | Como usar |
|---|---|---|
| Schema Pydantic do shared state | `backend/app/models/state.py` | Porte os tipos pra `lib/schema/state.ts` (Drizzle/Zod). 20 modelos prontos |
| Tipos de Project/Execution/Asset/Campaign | `backend/app/models/{project,execution,asset,campaign}.py` | Use como referência mas adapte ao schema v2 |
| Tool `web_search` | `backend/app/tools/web_search.py` | Porte pra `lib/tools/web-search.ts` |
| Tool `read_page` | `backend/app/tools/read_page.py` | Porte pra `lib/tools/read-page.ts` |
| Endpoint do Jarvis (esqueleto) | `backend/app/api/assistant.py` | Reescreva como `app/api/chat/route.ts` SSE |
| Notification model | `backend/app/models/notification.py` | Porte direto |
| Tabelas de niches/products já existentes | migrations 005, 007 | Não recriar — estender com novas colunas (ver PRD seção 6) |

**Não portar:**
- `backend/app/tools/{search_ad_library,search_youtube,transcribe_vsl,generate_image,generate_video,render_video_ffmpeg}.py` — usados só nos agentes arquivados
- `backend/app/api/{campaigns,executions}.py` — substituídos por `pipelines` e `tasks` no v2
- `ExecutionEngine` — substituído por planner dinâmico

## 7. MANTER COMO REFERÊNCIA (não apagar)

- `backend/` inteiro fica no repo, não rodando
- Adicione `backend/.v2-archived` (arquivo vazio) marcando que é legado
- README do repo deve dizer: "backend/ é o legado v1 mantido para portar trechos quando necessário; v2 roda em workers/ + app/"

## 8. Banco de dados

Migrations 001-013 ficam aplicadas. **Não rebuildar.** O que muda:

- `extension vector` (nova migration `v2/000_enable_pgvector.sql`)
- `alter table products add column sku char(4) unique`
- `alter table products add column slug text`
- Trigger de geração de SKU
- Novas tabelas v2 listadas no PRD seção 6

Aplique via Drizzle:
```bash
cd /
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

## 9. Verificação final

```bash
# Não deve haver imports de reactflow no app/
grep -r "reactflow" app/ components/ && echo "AINDA EXISTE — REMOVA"

# Não deve haver chamadas a tools cortadas
grep -r "search_ad_library\|search_youtube\|transcribe_vsl" workers/ lib/

# Prompts arquivados não devem ser carregados pelo registry
grep -r "scaler\|media_buyer\|utm_structurer" workers/lib/agent-registry.ts
```

Se todos retornarem vazio, migration está limpa.
