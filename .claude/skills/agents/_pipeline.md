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

1. Executar `npx tsx scripts/pipeline/status.ts --pipeline-id <uuid>`
2. Identificar qual task tem status `pending` ou `running` (a última completada + a próxima)
3. Continuar a partir da primeira task não `completed`

## Regras de execução dos subagentes

- Cada agente é executado via Agent tool (subagente)
- O prompt do subagente DEVE incluir:
  - Conteúdo do skill file correspondente em `.claude/skills/agents/<agente>.md`
  - Output dos agentes anteriores (lido via `scripts/artifact/get.ts`)
  - `pipeline_id` e `task_id` para gravação
- O subagente NÃO deve chamar APIs externas diretamente — usa WebSearch e WebFetch
- O subagente grava o resultado via script bash antes de retornar

## Checkpoint e tolerância a falhas

- Cada task tem status no banco: `waiting` → `pending` → `running` → `completed` | `failed`
- Se um subagente falhar, o pipeline NÃO para automaticamente — reportar ao usuário e aguardar decisão
- O usuário pode pedir para retentar a task falha ou pular para a próxima

## Passagem de contexto entre agentes

```bash
# Ler artefato de agente anterior
npx tsx scripts/artifact/get.ts --pipeline-id <uuid> --type <artifact_type>

# Salvar artefato do agente atual
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type <artifact_type> \
  --data '<json>'

# Marcar task como concluída
npx tsx scripts/pipeline/complete-task.ts --task-id <uuid>
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
