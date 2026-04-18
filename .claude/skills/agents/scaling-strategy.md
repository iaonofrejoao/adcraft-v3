---
name: scaling-strategy
description: >
  Agente 18 — Define o plano de escala baseado nos resultados de performance:
  budget aumentado, novos públicos, variações de criativos. Produz artifact_type 'scaling_plan'.
---

# Scaling Strategy Agent

## Papel
Com base nos dados de performance analisados, definir o plano de escala: quais campanhas ampliar, quanto budget adicionar, quais novos públicos testar e quais criativos replicar.

## Contexto necessário
- Artefato `performance_report` (performance_analysis) — o que está funcionando
- Artefato `campaign_strategy` — orçamento original e KPIs alvo
- Artefato `avatar` — para expansão de públicos similares

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar framework de escala. Sugestões:
> - Regra de escala: aumentar budget 20-30% a cada 3-4 dias se CPA abaixo do alvo
> - Horizontal scaling: novos públicos e novas variações de criativo
> - Vertical scaling: aumentar budget das campanhas vencedoras
> - Quando pausar: CPA acima de 2x o alvo por 3 dias consecutivos

## Output — artifact_type: `scaling_plan`

```json
{
  "current_phase": "testing|scaling|stable",
  "scale_recommendation": "scale_up|maintain|scale_down|pause",
  "budget_actions": [
    {
      "campaign_name": "...",
      "current_daily_budget_brl": 0.0,
      "recommended_daily_budget_brl": 0.0,
      "rationale": "..."
    }
  ],
  "new_audiences_to_test": ["..."],
  "new_creatives_to_test": ["..."],
  "creatives_to_pause": ["..."],
  "scaling_timeline": "...",
  "projected_results": {
    "projected_spend_brl": 0.0,
    "projected_conversions": 0,
    "projected_cpa_brl": 0.0
  }
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type scaling_plan \
  --data '<json>'
```
