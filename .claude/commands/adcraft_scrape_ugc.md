Coleta vídeos TikTok UGC para o produto $ARGUMENTS via Apify e pontua relevância.

## Como usar
- `$ARGUMENTS` pode ser um SKU (ex: BWNP) ou product_id (UUID)
- Se nenhum argumento, pergunte ao usuário qual produto

## Passos de execução

1. **Resolver product_id** (se SKU fornecido):
```sql
SELECT id, name FROM products WHERE sku = '<sku>';
```

2. **Definir query de busca** — use o nicho do produto como base:
```sql
SELECT p.name, n.name as niche FROM products p
LEFT JOIN niches n ON n.id = p.niche_id
WHERE p.id = '<product_id>';
```
Combine nome do produto + nicho em hashtags (ex: `"emagrecimento termogenico"`).

3. **Rodar o script**:
```bash
npx tsx scripts/video/scrape-ugc.ts \
  --product-id <uuid> \
  --query "<hashtags>" \
  --max 20
```

4. **Confirmar resultado** — exiba quantos vídeos foram salvos e sugira acessar
`/products/<sku>/video` para aprovar/rejeitar os vídeos coletados.

## Observações
- O script usa Apify (APIFY_TOKEN no .env) — sem necessidade de cookies
- Scoring é local (keywords + engajamento + duração) — sem custo de API
- Upsert por tiktok_video_id: re-executar não duplica vídeos
- Máximo recomendado: 20 vídeos por execução
