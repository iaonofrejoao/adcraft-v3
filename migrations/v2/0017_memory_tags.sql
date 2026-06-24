-- Adiciona coluna tags (array de texto) nas 3 tabelas de memória cumulativa.
-- Tags usam namespace estruturado: #avatar/, #dor/, #mecanismo/, #mercado/, #formato/, #canal/, #fase/
-- Índices GIN permitem buscas eficientes por tag: WHERE '#avatar/mulher-madura' = ANY(tags)

ALTER TABLE execution_learnings
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE learning_patterns
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_execution_learnings_tags  ON execution_learnings  USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_tags    ON learning_patterns    USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_insights_tags             ON insights             USING GIN(tags);
