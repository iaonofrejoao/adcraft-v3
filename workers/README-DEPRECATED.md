# Workers — Status de Deprecação

**Data:** 2026-04-18

## O que mudou

O `task-runner.ts` e os agentes individuais (`market-research.ts`, `avatar-research.ts`, etc.) foram **descomissionados**. A orquestração dos agentes migrou para o **Claude Code (Ultron)** como motor central.

## O que NÃO deve mais ser executado

| Arquivo | Motivo |
|---------|--------|
| `task-runner.ts` | Substituído pelo orquestrador Claude Code |
| `agents/market-research.ts` | Substituído pelo skill `.claude/skills/agents/market-research.md` |
| `agents/avatar-research.ts` | Substituído pelo skill `.claude/skills/agents/avatar-research.md` |
| `agents/angle-generator.ts` | Substituído pelo skill `.claude/skills/agents/angle-generator.md` |
| `agents/copy-hook-generator.ts` | Substituído pelo skill `.claude/skills/agents/copywriting.md` |
| `agents/anvisa-compliance.ts` | Substituído pelo skill `.claude/skills/agents/compliance-check.md` |
| `agents/video-maker.ts` | Substituído pelo skill `.claude/skills/agents/video-maker.md` |
| `agents/niche-curator.ts` | Substituído pelo niche_curator skill (futuro) |
| `lib/llm/gemini-client.ts` | Não mais invocado |
| `lib/llm/claude-provider.ts` | Não mais invocado |

## O que CONTINUA rodando

| Arquivo | Como executar |
|---------|--------------|
| `lib/embeddings/gemini-embeddings.ts` | `npx tsx workers/lib/embeddings/gemini-embeddings.ts` |
| `agents/learning-extractor.ts` | Chamado via `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>` |
| `cron/learning-aggregator-cron.ts` | Cron job externo (inalterado) |

## Nova arquitetura

```
Você → Claude Code (Ultron)
       ↓
       Lê .claude/pipelines/full-pipeline.yaml
       ↓
       Executa 18 agentes como subagentes (Agent tool)
       ↓
       Cada agente lê seu skill em .claude/skills/agents/
       ↓
       Grava no banco via scripts/ (Drizzle + Supabase)
       ↓
       Frontend lê os artefatos e exibe
```

## Scripts de orquestração

Todos os scripts estão em `scripts/`:
- `scripts/pipeline/create.ts` — cria pipeline + tasks
- `scripts/pipeline/status.ts` — consulta estado
- `scripts/pipeline/complete-task.ts` — marca task concluída
- `scripts/artifact/save.ts` — grava artefato
- `scripts/artifact/get.ts` — lê artefato
- `scripts/copy/save-components.ts` — grava copy components
- `scripts/copy/update-compliance.ts` — atualiza compliance
- `scripts/learning/extract.ts` — extrai learnings pós-pipeline
- `scripts/search/vector.ts` — busca vetorial no banco
