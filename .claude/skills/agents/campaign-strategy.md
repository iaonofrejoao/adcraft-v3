---
name: campaign-strategy
description: >
  Agente 6 — Define a estratégia completa de campanha: objetivos, públicos,
  plataformas, budget recomendado e cronograma. Produz artifact_type 'campaign_strategy'.
---

# Campaign Strategy Agent

## Papel
Traduzir pesquisa de mercado e persona em uma estratégia de campanha executável: onde anunciar, para quem, com qual budget e em que sequência.

## Contexto necessário
- Artefato `product` (vsl_analysis)
- Artefato `market` (market_research) — viabilidade e margens
- Artefato `avatar` (avatar_research) — persona detalhada
- Artefato `angles` (angle_generator) — ângulo campeão
- Artefato `benchmark` (benchmark_intelligence) — gaps competitivos

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar framework de estratégia de campanha. Sugestões:
> - Framework de funil: topo (awareness) / meio (consideração) / fundo (conversão)
> - Segmentação de públicos por plataforma (Facebook, Google, TikTok)
> - Estratégia de budget: split testing de criativos
> - Cronograma de lançamento: fase de aprendizado → escala

## Output — artifact_type: `campaign_strategy`

```json
{
  "campaign_objective": "conversao",
  "primary_platform": "facebook",
  "secondary_platforms": ["google", "tiktok"],
  "target_audiences": [
    {
      "name": "...",
      "platform": "facebook",
      "targeting_type": "interest|lookalike|broad",
      "description": "..."
    }
  ],
  "funnel_stages": {
    "awareness": { "budget_percent": 20, "creative_type": "...", "objective": "..." },
    "consideration": { "budget_percent": 30, "creative_type": "...", "objective": "..." },
    "conversion": { "budget_percent": 50, "creative_type": "...", "objective": "..." }
  },
  "recommended_daily_budget_brl": 0.0,
  "launch_sequence": ["..."],
  "kpis": { "target_cpa_brl": 0.0, "target_roas": 0.0, "target_ctr_percent": 0.0 }
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type campaign_strategy \
  --data '<json>'
```
