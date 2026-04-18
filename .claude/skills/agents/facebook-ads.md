---
name: facebook-ads
description: >
  Agente 15 — Monta a estrutura completa de campanha no Facebook Ads: campanha,
  conjuntos de anúncios e anúncios com configurações detalhadas. Produz artifact_type 'facebook_ads'.
---

# Facebook Ads Agent

## Papel
Estruturar a campanha completa no Facebook Ads Manager, pronta para ser criada: configurações de campanha, conjuntos de anúncio (públicos, budget, lance) e anúncios (criativos, copy, links).

## Contexto necessário
- Artefato `compliance_results` (compliance_check) — garantir que só copy aprovada vai ao ar
- Artefato `utms` (utm_builder) — URLs rastreadas para cada criativo
- Artefato `campaign_strategy` (campaign_strategy) — budget, públicos, objetivos
- Artefato `creative_brief` (creative_director) — combinações ranqueadas

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar estrutura de campanha Facebook. Sugestões:
> - Estrutura CBO (Campaign Budget Optimization) vs ABO
> - Naming convention para campanhas/conjuntos/anúncios
> - Configuração de pixel e eventos de conversão
> - Públicos: interesse, LAL 1%, LAL 2-5%, broad

## Output — artifact_type: `facebook_ads`

```json
{
  "campaign": {
    "name": "...",
    "objective": "CONVERSIONS",
    "budget_type": "CBO",
    "daily_budget_brl": 0.0,
    "bid_strategy": "LOWEST_COST"
  },
  "ad_sets": [
    {
      "name": "...",
      "audience_type": "interest|lookalike|broad",
      "targeting_description": "...",
      "placements": ["feed", "reels", "stories"],
      "optimization_event": "PURCHASE"
    }
  ],
  "ads": [
    {
      "name": "...",
      "creative_tag": "ABCD_v1_H1_B2_C3",
      "primary_text": "...",
      "headline": "...",
      "cta_button": "...",
      "destination_url": "...",
      "compliance_approved": true
    }
  ]
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type facebook_ads \
  --data '<json>'
```
