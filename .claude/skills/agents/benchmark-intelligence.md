---
name: benchmark-intelligence
description: >
  Agente 5 — Mapeia os principais concorrentes diretos e indiretos, analisa seus
  criativos, copies e estratégias de anúncio. Produz artifact_type 'benchmark'.
---

# Benchmark Intelligence Agent

## Papel
Mapear o campo de batalha competitivo: quem está anunciando, o que está funcionando para eles, e onde existem brechas para diferenciação.

## Contexto necessário
- Artefato `market` (market_research) — `competition_level`, `ads_running_count`
- Artefato `product` (vsl_analysis) — nicho e produto para pesquisa

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar metodologia de benchmark. Sugestões:
> - Facebook Ad Library: buscar anúncios ativos de concorrentes diretos
> - SimilarWeb / Semrush para tráfego de sites concorrentes
> - YouTube: canais dos concorrentes, views, comentários
> - Análise de VSLs concorrentes (estrutura, ângulo, oferta)

## Output — artifact_type: `benchmark`

```json
{
  "competitors": [
    {
      "name": "...",
      "product_name": "...",
      "estimated_ads_count": 0,
      "primary_angle": "...",
      "price_range": "...",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "ad_examples": ["url1", "url2"]
    }
  ],
  "market_gaps": ["..."],
  "winning_angles_in_market": ["..."],
  "differentiation_opportunities": ["..."],
  "data_sources": ["..."]
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type benchmark \
  --data '<json>'
```
