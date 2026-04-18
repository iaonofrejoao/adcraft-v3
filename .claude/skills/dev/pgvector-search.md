# Skill — pgvector-search

## Objetivo
Busca semântica via pgvector no Supabase, com queries híbridas (filtro relacional + similaridade vetorial).

## Setup
```sql
create extension if not exists vector;
create table embeddings (
  id uuid primary key,
  source_table text not null,
  source_id uuid not null,
  embedding vector(768) not null,
  model text default 'gemini-embedding-001',
  created_at timestamptz default now()
);
create index on embeddings using hnsw (embedding vector_cosine_ops);
create index on embeddings (source_table, source_id);
```

## Padrão de query híbrida
```sql
select nl.id, nl.content, nl.confidence
from niche_learnings nl
join embeddings e on e.source_table='niche_learnings' and e.source_id=nl.id
where nl.niche_id = $1
  and nl.learning_type = any($2)
  and nl.status = 'active'
order by nl.confidence desc, e.embedding <=> $3 asc
limit $4;
```

`$3` é o vetor de query (embedding do produto atual). Operador `<=>` é cosine distance no pgvector.

## Geração de embeddings
- Modelo: `gemini-embedding-001`, dim 768, parâmetro `output_dimensionality: 768`
- Wrapper único: `lib/embeddings/gemini-embeddings.ts` com função `generateEmbedding(text)` e `generateEmbeddingsBatch(texts[])`
- Worker dedicado roda a cada 30s, lê fila `pending_embeddings`, gera em batch (até 100), grava em `embeddings`

## Lazy generation
Só gera embedding quando o artifact é "estável o suficiente":
- Niche learning: confidence ≥ 0.5
- Product knowledge: sempre (raro o suficiente)
- Copy component: nunca (não é buscado semanticamente)
