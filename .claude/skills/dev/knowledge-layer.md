# Skill — knowledge-layer

## Objetivo
Camada de memória persistente: `product_knowledge` (memória por produto) e helpers de leitura/escrita.

## Arquivos
- `lib/knowledge/product-knowledge.ts`
- `lib/knowledge/freshness.ts`
- `lib/jarvis/reference-resolver.ts`

## API
```typescript
// Escrita — chamada após cada agente terminar
writeArtifact({
  product_id, product_version, artifact_type, artifact_data,
  source_pipeline_id, source_task_id
}): Promise<KnowledgeRecord>

// Leitura
getFreshArtifact(product_id, artifact_type): Promise<KnowledgeRecord | null>
getAllFreshArtifacts(product_id): Promise<Record<string, KnowledgeRecord>>

// Refresh forçado
supersedeArtifact(old_id, new_id): Promise<void>
```

## Regra crítica
**Toda escrita em `product_knowledge` é atômica com a escrita em `pipeline.state` E enfileira embedding** via `enqueueEmbedding('product_knowledge', new_id)`. Use transação Postgres.

## Reference resolver
Pre-processor de mensagens do chat:
```typescript
async function resolveReferences(message: string, conversationId: string) {
  const mentions = parseMentions(message);  // [@ABCD, /copy]
  const resolved = await Promise.all(mentions.map(resolve));
  return { message, resolved };
}
```

`@SKU` → busca exata em `products.sku`.
`@nome` → busca fuzzy em `products.name` (trigram).
`/acao` → mapeia pra goal.

Se ambíguo, retorna `{ ambiguous: true, candidates: [...] }` e Jarvis pergunta com cards.