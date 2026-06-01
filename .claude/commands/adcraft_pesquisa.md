Roda pipeline de pesquisa (Fase 1) para o produto $ARGUMENTS

Execute apenas a Fase 1 descrita em CLAUDE.md:
1. Crie o pipeline com `npx tsx scripts/pipeline/create.ts --product-id <uuid> --type pesquisa`
2. Execute em sequência:
   - VSL Analysis
   - [Market Research ∥ Avatar Research] (paralelo)
   - Benchmark Intelligence
   - Angle Generator
   - Campaign Strategy
3. Salve cada artefato com `scripts/artifact/save.ts`
4. Ao final, extraia learnings com `npx tsx scripts/learning/extract.ts --pipeline-id <uuid>`
5. Registre a atividade em TAREFAS.md

Se $ARGUMENTS for um SKU, busque o product_id primeiro:
```
SELECT id, name FROM products WHERE sku = '<sku>';
```

Injete o bloco de mercado-alvo antes de cada agente:
```
SELECT target_country, target_language FROM products WHERE id = '<product_id>';
```
