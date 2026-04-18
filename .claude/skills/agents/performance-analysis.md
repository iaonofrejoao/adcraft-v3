---
name: performance-analysis
description: >
  Agente 17 — Analisa os resultados das campanhas ativas, identifica o que está
  funcionando e o que precisa ser ajustado. Produz artifact_type 'performance_report'.
---

# Performance Analysis Agent

## Papel
Analisar dados de performance das campanhas no ar, identificar padrões de sucesso/fracasso e recomendar otimizações baseadas em dados reais.

## Contexto necessário
- Artefato `facebook_ads` e `google_ads` (campanhas estruturadas)
- Dados de performance da conta (a serem fornecidos pelo usuário ou via API futura)
- Artefato `campaign_strategy` — KPIs alvo para comparação

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar framework de análise de performance. Sugestões:
> - Período de análise: mínimo 7 dias de dados
> - Métricas principais: CPA, ROAS, CTR, CPM, frequência
> - Análise por criativo: qual hook está convertendo mais
> - Análise de público: qual audiência tem melhor CPA
> - Diagnóstico de problemas: CPM alto (problema de público), CTR baixo (problema de criativo)

## Output — artifact_type: `performance_report`

```json
{
  "analysis_period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "summary": {
    "total_spend_brl": 0.0,
    "total_conversions": 0,
    "average_cpa_brl": 0.0,
    "average_roas": 0.0,
    "overall_assessment": "on_track|underperforming|overperforming"
  },
  "creative_performance": [
    {
      "creative_tag": "...",
      "ctr_percent": 0.0,
      "cpa_brl": 0.0,
      "status": "winner|loser|testing"
    }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "action": "...", "rationale": "..." }
  ],
  "next_steps": ["..."]
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type performance_report \
  --data '<json>'
```
