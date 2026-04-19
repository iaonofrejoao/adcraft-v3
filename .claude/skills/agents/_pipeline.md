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

## Contexto de mercado-alvo (target_country / target_language)

Todo pipeline está vinculado a um produto que tem `target_country` e `target_language` definidos na tabela `products`. **Esses dois campos determinam o idioma, as referências culturais, as regulações e os benchmarks de todos os materiais produzidos.**

### Como obter antes de spawnar agentes

```sql
SELECT target_country, target_language FROM products WHERE id = 'PRODUCT_UUID';
```

Exemplos comuns:

| target_country | target_language | Mercado |
|----------------|-----------------|---------|
| `BR` | `pt-BR` | Brasil |
| `US` | `en-US` | Estados Unidos |
| `GB` | `en-GB` | Reino Unido |
| `ES` | `es-ES` | Espanha |
| `MX` | `es-MX` | México |

### Regra obrigatória de passagem

O prompt de **todo subagente** DEVE incluir o bloco abaixo (após o skill file e antes dos artefatos):

```
## Mercado-alvo do produto
- target_country: <valor do banco>
- target_language: <valor do banco>
- Todos os materiais produzidos (copy, script, pesquisa, anúncios, criativos) devem ser gerados no idioma <target_language> e adaptados para o contexto cultural, regulatório e econômico do mercado <target_country>.
```

### Impacto por camada do pipeline

| Camada | O que muda com target_country ≠ BR |
|--------|-----------------------------------|
| **Pesquisa** (market, avatar, benchmark) | Fontes de dados do país certo; benchmarks de CPM/CPC do mercado-alvo |
| **Estratégia** (campaign_strategy) | Moeda nos KPIs (USD, EUR…); plataformas disponíveis no país; CPA target ajustado ao ticket em moeda local |
| **Criativo** (copy, script, angles) | Idioma da copy; idioms e referências culturais locais; dores e linguagem do avatar do país |
| **Compliance** (compliance_check) | Regulação do país: FTC (US), ASA (UK), CONAR (BR), etc. |
| **Anúncios** (facebook_ads, google_ads) | Geo-targeting configurado para target_country; negative keywords no idioma certo; extensões adaptadas |
| **Performance** (performance_analysis) | Benchmarks de referência do mercado-alvo (CPM US ≠ CPM BR) |

---

## Regras de execução dos subagentes

- Cada agente é executado via Agent tool (subagente)
- O prompt do subagente DEVE incluir:
  - Conteúdo do skill file correspondente em `.claude/skills/agents/<agente>.md`
  - Bloco de **Mercado-alvo do produto** (ver seção acima)
  - Output dos agentes anteriores (lido via `scripts/artifact/get.ts`)
  - `pipeline_id` e `task_id` para gravação
- O subagente NÃO deve chamar APIs externas diretamente — usa WebSearch e WebFetch
- O subagente grava o resultado via `scripts/artifact/save.ts` (lógica de `superseded` + fila de embeddings — NÃO substituir por MCP direto)

## Checkpoint e tolerância a falhas

- Cada task tem status no banco: `waiting` → `pending` → `running` → `completed` | `failed`
- Se um subagente falhar, o pipeline NÃO para automaticamente — reportar ao usuário e aguardar decisão
- O usuário pode pedir para retentar a task falha ou pular para a próxima

## Loops de revisão

### Loop 1 — creative_director bloqueia (approved_for_production: false)

```
1. Ler revision_requests[].agent — identifica qual agente refazer
2. Re-invocar o agente indicado com MESMO pipeline_id e NOVO task_id
3. Salvar novo artefato (scripts/artifact/save.ts — o anterior vira status 'superseded' automaticamente)
4. Re-invocar creative_director com os artefatos atualizados
5. Máximo 2 loops de revisão por pipeline
   - Se ainda bloqueado após 2 tentativas: reportar ao usuário com o revision_requests detalhado
```

### Loop 2 — compliance_check bloqueia top_combination

```
1. Ler compliance_results.approved_combinations
2. Se approved_combinations NÃO está vazio:
   - Prosseguir com facebook_ads e google_ads usando approved_combinations (não top_combination)
   - Registrar em setup_notes: "top_combination bloqueada por compliance — usando [próxima combinação]"
3. Se approved_combinations ESTÁ vazio:
   - Pausar pipeline
   - Reportar ao usuário: "Nenhuma combinação aprovada pelo compliance. Necessário refazer copywriting."
   - Aguardar instrução antes de continuar
```

### Precedência de aprovação

| Situação | Fonte autoritativa |
|---|---|
| Quais combinações lançar | `compliance_results.approved_combinations` |
| Qual combinação priorizar | `creative_brief.top_combination` (se estiver em approved_combinations) |
| Fallback se top bloqueada | `creative_brief.combinations_ranked[1]` (segunda melhor que esteja aprovada) |

> O `approved_for_production: true` do `creative_director` é aprovação criativa.
> A aprovação de lançamento é `compliance_results.overall_approved`.
> Os dois artefatos coexistem — `facebook_ads` sempre usa `compliance_results.approved_combinations`.

### Loop 3 — scaling_strategy sem winner (todos losers)

```
Criar pipeline criativo filho para novo ângulo:

npx tsx scripts/pipeline/create.ts \
  --product-id <mesmo product_id> \
  --type criativo \
  --parent-pipeline <pipeline_id_original>

Brief para script_writer e copywriting do novo pipeline:
- angle_type: usar angles.alternative_angles[0] do pipeline pai
- Artefatos reutilizados do pipeline pai: product, market, avatar, benchmark, angles
- Não refazer pesquisa — ir direto para fase criativa
- Registrar em script_rationale: "Novo ângulo — ângulo [X] não converteu (hook_rate < 15% por 14 dias)"
```

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
