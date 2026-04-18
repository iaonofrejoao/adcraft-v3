# Skill — jarvis-planner

## Objetivo
Implementar o planejador dinâmico do Jarvis: dado um goal e um produto, retorna um DAG mínimo de tasks, reaproveitando artifacts existentes.

## Localização
- `lib/jarvis/planner.ts` — função principal
- `workers/lib/agent-registry.ts` — capability map
- `lib/jarvis/dag-builder.ts` — topological sort

## Capability Registry (formato)
```typescript
export const AGENT_REGISTRY: Record<string, AgentCapability> = {
  avatar_research: {
    requires: ['product'],
    produces: ['avatar'],
    cacheable: true,
    freshness_days: 60,
    model: 'gemini-2.5-pro',
    max_input_tokens: 4000,
  },
  // ...todos os 6 agentes (ver PRD seção 4.1)
};
```

## Algoritmo do planner
```
function planPipeline(goal, product, force_refresh=false):
  1. deliverable = GOAL_TO_DELIVERABLE[goal]
  2. required_artifacts = resolveDependencies(deliverable, AGENT_REGISTRY)
     // BFS reverso a partir do deliverable, coletando todos os 'requires' transitivos
  3. tasks = []
  4. for artifact in topologicalOrder(required_artifacts):
       agent = agentThatProduces(artifact)
       if not force_refresh and isFresh(product, artifact, agent.freshness_days):
         tasks.push({ agent, status: 'reused', source_knowledge_id })
       else:
         tasks.push({ agent, status: 'pending', depends_on: tasksFor(agent.requires) })
  5. mermaid = renderMermaid(tasks)
  6. estimated_cost = sum(estimateCost(task) for task in tasks if status='pending')
  7. return { tasks, mermaid, estimated_cost, checkpoints }
```

## Goal → Deliverable map
```typescript
const GOAL_TO_DELIVERABLE = {
  avatar_only: 'avatar',
  market_only: 'market',
  angles_only: 'angles',
  copy_only: 'copy_components',
  creative_full: 'video_assets',
};
```

## Renderização Mermaid
Reused = verde, pending = azul. Exemplo:
```
graph LR
  A[avatar ✓ reused 5d] --> AG[angles NEW]
  M[market NEW] --> AG
  AG --> C[copy NEW]
  style A fill:#1a5f3f
  style M fill:#3b82f6
```

## Tool no Jarvis
`plan_pipeline(goal, product_id, force_refresh?)` → retorna o objeto acima como JSON. Jarvis renderiza via PlanPreviewCard.

## Testes obrigatórios
- 5 goals × (cold start | parcialmente cacheado | totalmente cacheado)
- force_refresh ignora cache
- Cycle detection (deve quebrar se registry tiver dependência circular)
