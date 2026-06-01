Exibe o status atual do pipeline $ARGUMENTS

Execute:
```
npx tsx scripts/pipeline/status.ts --pipeline-id <uuid>
```

Mostre de forma clara:
- Quais tasks foram concluídas
- Qual task está em andamento (se houver)
- Quais tasks estão pendentes
- Se há algum bloqueio (loop de revisão, compliance vazio, etc.)

Se $ARGUMENTS for um SKU em vez de UUID:
```
SELECT p.id, p.created_at, p.type, p.status
FROM pipelines p
JOIN products prod ON prod.id = p.product_id
WHERE prod.sku = '<sku>'
ORDER BY p.created_at DESC
LIMIT 5;
```

Após exibir o status, sugira o próximo comando a executar.
