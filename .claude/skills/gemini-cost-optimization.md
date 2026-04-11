# Skill — gemini-cost-optimization

## Objetivo
Garantir que toda chamada LLM passe por wrapper único com prompt caching, model routing, e logging.

## Arquivo
`lib/llm/gemini-client.ts` — **única porta de entrada** pro Gemini. Chamadas diretas ao SDK em outros arquivos são proibidas.

## API
```typescript
async function callAgent({
  agent_name, niche_id, dynamic_input, mode?
}): Promise<{ output, usage, cost_usd }>
```

Internamente:
1. Lê `AGENT_REGISTRY[agent_name].model`
2. Carrega prompt do agente (`prompts/{agent_name}.md`)
3. Carrega niche learnings injetáveis
4. Verifica `prompt_caches` por `cache_key = "{agent_name}:{niche_slug}"`
5. Se cache existe e não expirou → usa `cached_content`. Senão, cria cache e salva
6. Chama Gemini API com `generationConfig` apropriado
7. Loga `llm_calls` com tokens e custo (calculado pela tabela de preços)
8. Atualiza `pipelines.cost_so_far_usd`
9. Verifica circuit breaker — se estourou budget, lança `BudgetExceededError`

## Tabela de preços (Gemini, abril 2026 — verificar atualizações)
| Modelo               | Input $/1M | Cached input $/1M | Output $/1M |
| -------------------- | ---------- | ----------------- | ----------- |
| gemini-2.5-pro       | 1.25       | 0.31              | 5.00        |
| gemini-2.5-flash     | 0.075      | 0.019             | 0.30        |
| gemini-embedding-001 | 0.025      | —                 | —           |

## Cache expiration
1 hora padrão. Refresh automático na primeira chamada após expiração.

## Budget circuit breaker
```typescript
if (pipeline.cost_so_far_usd + estimated_call_cost > pipeline.budget_usd) {
  await pausePipeline(pipeline.id, 'budget_exceeded');
  throw new BudgetExceededError(...);
}
```

Cria approval `budget_exceeded` no banco — Jarvis notifica usuário.
