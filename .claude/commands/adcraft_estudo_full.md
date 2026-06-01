Roda pipeline completo para o produto $ARGUMENTS

Execute o fluxo completo descrito em CLAUDE.md (seção "Orquestração Claude Code"):
1. Crie o pipeline com `npx tsx scripts/pipeline/create.ts --product-id <uuid> --type full`
2. Leia `.claude/pipelines/full-pipeline.yaml` para ordem e dependências
3. Busque learnings vetoriais do nicho
4. Execute as 3 fases em sequência:
   - Fase 1 (Pesquisa): VSL Analysis → [Market Research ∥ Avatar Research] → Benchmark Intelligence → Angle Generator → Campaign Strategy
   - Fase 2 (Criativo): Copywriting → Creative Director (apenas copy — scripts ficam em fila)
   - Fase 3 (Lançamento): [Compliance Check ∥ UTM Builder] → [Facebook Ads ∥ Google Ads] → Performance Analysis → Scaling Strategy
5. Ao final, extraia learnings com `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>`
6. Registre a atividade em TAREFAS.md com data e produto

Se $ARGUMENTS for um SKU (não UUID), busque o product_id no banco primeiro:
```
SELECT id, name FROM products WHERE sku = '<sku>';
```

Antes de spawnar qualquer agente, obtenha e injete o bloco de mercado-alvo:
```
SELECT target_country, target_language FROM products WHERE id = '<product_id>';
```
