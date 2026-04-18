---
name: pipeline-orchestration
description: >
  Guia de orquestração do pipeline de 18 agentes. Usar sempre que o usuário pedir
  para executar um pipeline, retomar um pipeline interrompido, ou consultar o status
  de execução. Define como spawnar agentes, ler checkpoints e gravar no banco.
---

# Orquestração de Pipeline — AdCraft Ultron

## Como disparar um pipeline

Quando o usuário pedir "roda pipeline para o produto X":

1. Executar `npx tsx scripts/pipeline/create.ts --product-id <uuid> [--type full|pesquisa|criativo|lancamento]`
2. Guardar o `pipeline_id` retornado
3. Ler `.claude/pipelines/full-pipeline.yaml` para saber a ordem e dependências
4. Spawnar cada agente em sequência respeitando `depends_on`
5. Para cada agente, após conclusão: executar o script de save correspondente
6. Ao final do pipeline: executar `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>`

## Como retomar um pipeline interrompido

Quando o usuário fornecer um `pipeline_id`:

1. Consultar status via MCP Supabase diretamente:
   ```sql
   SELECT agent_name, status, retry_count, started_at, completed_at, error, id AS task_id
   FROM tasks
   WHERE pipeline_id = 'UUID'
   ORDER BY created_at;
   ```
2. Identificar qual task tem status `pending` ou `running` (a última completada + a próxima)
3. Continuar a partir da primeira task não `completed`

## Regras de execução dos subagentes

- Cada agente é executado via Agent tool (subagente)
- O prompt do subagente DEVE incluir:
  - Conteúdo do skill file correspondente em `.claude/skills/agents/<agente>.md`
  - Output dos agentes anteriores (lido via `scripts/artifact/get.ts`)
  - `pipeline_id` e `task_id` para gravação
- O subagente NÃO deve chamar APIs externas diretamente — usa WebSearch e WebFetch
- O subagente grava o resultado via `scripts/artifact/save.ts` (lógica de `superseded` + fila de embeddings — NÃO substituir por MCP direto)

## Checkpoint e tolerância a falhas

- Cada task tem status no banco: `waiting` → `pending` → `running` → `completed` | `failed`
- Se um subagente falhar, o pipeline NÃO para automaticamente — reportar ao usuário e aguardar decisão
- O usuário pode pedir para retentar a task falha ou pular para a próxima

## Passagem de contexto entre agentes

```sql
-- Ler artefato de agente anterior (via MCP Supabase)
SELECT pk.artifact_data
FROM   product_knowledge pk
JOIN   pipelines p ON p.product_id = pk.product_id
WHERE  p.id             = 'PIPELINE_UUID'
  AND  pk.artifact_type = 'ARTIFACT_TYPE'
  AND  pk.status        = 'fresh'
ORDER BY pk.created_at DESC
LIMIT 1;
```

```bash
# Salvar artefato do agente atual (MANTER script — lógica de superseded + fila de embeddings)
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type <artifact_type> \
  --data '<json>'
```

```sql
-- Marcar task como concluída (via MCP Supabase)
-- Claude Code conhece o DAG via full-pipeline.yaml e controla a progressão diretamente.
-- seedNextTasks era necessário apenas no modelo de workers autônomos (deprecado).
UPDATE tasks
SET    status       = 'completed',
       completed_at = NOW()
WHERE  id = 'TASK_UUID';
```

## Artifact types por agente

| Agente | artifact_type em product_knowledge |
|--------|-----------------------------------|
| vsl_analysis | `product` |
| market_research | `market` |
| avatar_research | `avatar` |
| benchmark_intelligence | `benchmark` |
| angle_generator | `angles` |
| campaign_strategy | `campaign_strategy` |
| script_writer | `script` |
| copywriting | `copy_components` (via scripts/copy/save-components.ts) |
| character_generator | `character` |
| keyframe_generator | `keyframes` |
| video_maker | `video_assets` |
| creative_director | `creative_brief` |
| compliance_check | `compliance_results` (via scripts/copy/update-compliance.ts) |
| utm_builder | `utms` |
| facebook_ads | `facebook_ads` |
| google_ads | `google_ads` |
| performance_analysis | `performance_report` |
| scaling_strategy | `scaling_plan` |

## Busca vetorial (memória cumulativa)

Antes de spawnar agentes de pesquisa (market_research, avatar_research, benchmark_intelligence):
```bash
npx tsx scripts/search/vector.ts --query "<produto + nicho>" --niche-id <uuid> --limit 5
```

Injetar os learnings retornados no prompt do subagente como contexto adicional.
