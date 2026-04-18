# AdCraft V2 — Backlog de débitos técnicos e pendências

**Última atualização:** 2026-04-16 (pós-auditoria de validação Fases A-F)

---

## CRÍTICOS — Bloqueadores para produção confiável

### C1 — Zero testes automatizados
- **Impacto:** Regressões só detectadas manualmente
- **Ação:** Fase F — Playwright E2E (3 fluxos) + Vitest unitários
- **Arquivos críticos para teste:** `workers/lib/seed-next-task.ts`, `learning-extractor.ts`

### C2 — Web search do Jarvis usa mock
- **Impacto:** Jarvis inventa resultados de busca em vez de usar dados reais
- **Ação:** Configurar `SERPER_API_KEY` no `.env` (obter em https://serper.dev)
- **Arquivo:** `workers/lib/tools/web-search.ts`

### C3 — trigger_agent sem confirmação humana
- **Impacto:** Jarvis pode disparar pipeline sem o usuário aprovar explicitamente
- **Ação:** Implementar modal de confirmação no frontend antes de executar
- **Arquivo:** `frontend/lib/jarvis/tools/execution.ts`

---

## MÉDIOS — Qualidade e observabilidade

### M1 — Nenhum error tracking (Sentry ou similar)
- **Impacto:** Erros em produção ficam silenciosos — só aparecem em logs do processo
- **Ação:** Adicionar Sentry DSN no `.env`, instrumentar workers e frontend

### M2 — Logs não são JSON estruturado
- **Impacto:** Difícil correlacionar eventos em produção, não integra com ferramentas de log
- **Ação:** Trocar `console.log/info/error` por logger JSON (ex: `pino`)
- **Arquivos afetados:** todos em `workers/`

### M3 — Dashboard de custos não existe
- **Impacto:** Impossível monitorar gasto com LLMs sem ir direto na Anthropic
- **Ação:** UI simples que soma `cost_so_far_usd` dos pipelines agrupado por dia/agente
- **Dado disponível:** já está em `tasks` e `pipelines` no banco

### M4 — Pipeline cancellation sem intent no Jarvis
- **Impacto:** Usuário precisa ir na UI clicar "Cancelar"; não consegue via chat
- **Ação:** Adicionar intent `cancel_pipeline` nas goals + tool `cancel_pipeline`
- **Arquivo:** `frontend/lib/jarvis/goals.ts`, `tool-registry.ts`

### M5 — Deleção de conversa sem UI
- **Impacto:** Sidebar de conversas cresce infinitamente
- **Ação:** Botão de delete na sidebar (com confirmação)
- **Arquivo:** `frontend/components/Sidebar.tsx`

### M6 — products.description ausente no schema
- **Impacto:** Embedding de classificação de nicho fica sem contexto textual
- **Ação:** `ALTER TABLE products ADD COLUMN description TEXT;` + incluir no niche embedding
- **Arquivo:** `frontend/lib/schema/index.ts`, nova migration

---

## FASE F — Funcionalidades não iniciadas

### F1 — FilterBar reutilizável
- Componente `<FilterBar />` com estado persistido na URL (`?status=&period=`)
- Aplicar em: `/products`, `/demandas`, `/campanhas`, `/insights`

### F2 — Keyboard shortcuts
- `?` → modal de atalhos disponíveis
- `Cmd+K` → command palette
- `Cmd+/` → foca no input do Jarvis
- `g p` → navega para /products
- `g d` → navega para /demandas

### F3 — Empty states
- Todas as listagens precisam de empty state com ilustração + CTA
- Hoje: listagem vazia = tela em branco

### F4 — Skeleton loaders padronizados
- Hoje: componentes que carregam ficam piscando ou mostram layout quebrado

### F5 — Testes E2E (Playwright)
- Fluxo 1: criar produto → rodar pipeline → acompanhar na tela de demandas
- Fluxo 2: chat Jarvis → query ao banco → resposta com dados reais
- Fluxo 3: filtrar demandas → abrir detalhes → re-executar agente

### F6 — Documentação final
- `README.md` com setup completo + arquitetura
- `docs/JARVIS.md` — guia de uso do Jarvis
- `docs/AGENTS.md` — lista de agentes, modelos, exemplos de output
- ✅ `docs/ARCHITECTURE.md` — criado em 2026-04-16
- ✅ `docs/VALIDACAO_V2.md` — criado em 2026-04-16

---

## REFATORAÇÃO INTERNA (tech debt menor)

### R1 — useJarvisChat embutido em app/page.tsx
- **Ação:** Extrair para `frontend/hooks/useJarvisChat.ts`

### R2 — lib/constants.ts não existe
- **Ação:** Criar com: plataformas, goals, status values, agent names

### R3 — useNotifications não extraído
- **Ação:** Extrair de `NotificationBell.tsx` → `hooks/useNotifications.ts`

### R4 — products/page.tsx e products/[sku]/page.tsx com style={{}}
- **Ação:** Migrar para classes Tailwind semânticas (ver CLAUDE.md Fase 3 item 13-14)

### R5 — Duplicação de tagging.ts
- `frontend/lib/tagging.ts` vs `workers/lib/tagging.ts` — monitorar drift
- Intencional por ora; unificar em v2.1 se divergirem

---

## INFRAESTRUTURA

### I1 — CI/CD ausente
- **Ação:** GitHub Actions com: type-check TypeScript, pnpm build, testes (quando existirem)

### I2 — Deploy não documentado
- **Ação:** Criar `docs/DEPLOY.md` com processo de deploy (Vercel + workers)

### I3 — Aggregator cron sem scheduler
- **Contexto:** `learning-aggregator-cron.ts` precisa ser agendado externamente
- **Ação:** Configurar cron job no servidor: `0 3 * * * npx tsx workers/cron/learning-aggregator-cron.ts`
- Alternativa: usar Supabase Edge Functions scheduler

### I4 — batchEmbeddingsWorker não é executado automaticamente
- **Contexto:** Embeddings são enfileirados mas o worker precisa ser invocado
- **Ação:** Integrar chamada ao `batchEmbeddingsWorker()` no task-runner (a cada N ciclos)
  ou criar cron job separado

---

## IDEIAS V3 (não priorizar agora)

- Autenticação multi-usuário (RLS já preparada)
- Integração Meta Ad Library para análise de concorrência
- Agentes arquivados: scaler, performance_analyst, utm_structurer
- Dashboard de ROI: CAC/LTV por criativo
- Modo colaborativo (review de copies em equipe)
- Batch API Anthropic para redução de custos em volume
- Fine-tuning de prompts por agente pós-dados reais
