Roda pipeline de lançamento (Fase 3) para o pipeline $ARGUMENTS

Execute a Fase 3 descrita em CLAUDE.md a partir de um pipeline que já tem Fase 1 e 2 concluídas:
1. Verifique o estado atual: `npx tsx scripts/pipeline/status.ts --pipeline-id <uuid>`
2. Execute em sequência:
   - [Compliance Check ∥ UTM Builder] (paralelo)
   - [Facebook Ads ∥ Google Ads] (paralelo) — usar exclusivamente `compliance_results.approved_combinations`
   - Performance Analysis
   - Scaling Strategy
3. Se `approved_combinations` estiver vazio, pause e informe o usuário antes de continuar
4. Ao final, extraia learnings com `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>`
5. Registre a atividade em TAREFAS.md

$ARGUMENTS pode ser o `pipeline_id` (UUID) ou o SKU do produto. Se for SKU:
```
SELECT id FROM pipelines WHERE product_id = (SELECT id FROM products WHERE sku = '<sku>') ORDER BY created_at DESC LIMIT 1;
```
