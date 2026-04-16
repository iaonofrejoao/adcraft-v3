-- Migration 014 — Sistema de Memória Cumulativa (Fase E)
-- Tabelas: execution_learnings, learning_patterns, insights
--
-- Decisões de design:
--   • Embeddings ficam na tabela `embeddings` existente (queue system, 768d Gemini)
--     para não duplicar infraestrutura. A trigger de embedding é feita via INSERT
--     na fila da tabela `embeddings` (source_table='execution_learnings').
--   • `execution_learnings` referencia `pipelines` (nosso equivalente de executions)
--   • `learning_patterns` é derivada — gerada pelo aggregator, não pelo usuário
--   • `insights` é curadoria humana/LLM de alto nível

-- ── execution_learnings ────────────────────────────────────────────────────────
-- Aprendizados atômicos extraídos após cada pipeline concluído.
CREATE TABLE IF NOT EXISTS execution_learnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id)  ON DELETE SET NULL,
  niche_id        UUID REFERENCES niches(id)    ON DELETE SET NULL,

  -- Classificação do aprendizado
  category        TEXT NOT NULL CHECK (category IN (
                    'angle', 'copy', 'persona', 'creative', 'targeting', 'compliance', 'other'
                  )),

  -- Conteúdo
  observation     TEXT NOT NULL,  -- ex: "Ângulo de medo gerou 2× mais cliques que autoridade"
  evidence        JSONB,          -- { metric: "CTR", value: 3.2, baseline: 1.6, source: "..." }
  confidence      NUMERIC(3,2) DEFAULT 0.50 CHECK (confidence BETWEEN 0 AND 1),

  -- Feedback do usuário
  validated_by_user   BOOLEAN,    -- NULL = não revisado, TRUE = válido, FALSE = inválido
  invalidation_reason TEXT,

  -- Controle
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'superseded')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_exec_learnings_pipeline  ON execution_learnings(pipeline_id);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_product   ON execution_learnings(product_id);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_niche     ON execution_learnings(niche_id);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_category  ON execution_learnings(category);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_status    ON execution_learnings(status);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_created   ON execution_learnings(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_exec_learnings_validated ON execution_learnings(validated_by_user)
  WHERE validated_by_user IS NOT NULL;

-- ── learning_patterns ─────────────────────────────────────────────────────────
-- Padrões agregados derivados de múltiplos learnings (gerados pelo aggregator diário).
CREATE TABLE IF NOT EXISTS learning_patterns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_text         TEXT NOT NULL,  -- "Produtos de saúde performam 40% melhor com ângulo de medo"
  category             TEXT CHECK (category IN (
                         'angle', 'copy', 'persona', 'creative', 'targeting', 'compliance', 'other'
                       )),
  niche_id             UUID REFERENCES niches(id) ON DELETE SET NULL,
  supporting_learning_ids UUID[],  -- IDs dos execution_learnings que suportam este padrão
  supporting_count     INTEGER DEFAULT 0,
  confidence           NUMERIC(3,2) DEFAULT 0.50 CHECK (confidence BETWEEN 0 AND 1),
  status               TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_patterns_niche      ON learning_patterns(niche_id);
CREATE INDEX IF NOT EXISTS ix_patterns_category   ON learning_patterns(category);
CREATE INDEX IF NOT EXISTS ix_patterns_confidence ON learning_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS ix_patterns_status     ON learning_patterns(status);

-- ── insights ──────────────────────────────────────────────────────────────────
-- Insights curados de alto nível — gerados pelo aggregator ou pelo usuário.
CREATE TABLE IF NOT EXISTS insights (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  importance         INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source             TEXT DEFAULT 'aggregator' CHECK (source IN ('aggregator', 'user', 'jarvis')),
  pattern_ids        UUID[],    -- IDs de learning_patterns relacionados
  validated_by_user  BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_insights_importance ON insights(importance DESC);
CREATE INDEX IF NOT EXISTS ix_insights_validated  ON insights(validated_by_user);
CREATE INDEX IF NOT EXISTS ix_insights_created    ON insights(created_at DESC);

-- ── Full-text search ──────────────────────────────────────────────────────────
-- GIN index para busca textual em learnings e patterns sem precisar de extensão extra.
CREATE INDEX IF NOT EXISTS ix_exec_learnings_fts ON execution_learnings
  USING GIN (to_tsvector('portuguese', coalesce(observation, '')));

CREATE INDEX IF NOT EXISTS ix_patterns_fts ON learning_patterns
  USING GIN (to_tsvector('portuguese', coalesce(pattern_text, '')));

-- ── RLS (Row Level Security) ──────────────────────────────────────────────────
-- Ligado mas permissivo para uso com service key — ajustar quando multi-tenant.
ALTER TABLE execution_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_patterns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access_learnings"
  ON execution_learnings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_patterns"
  ON learning_patterns FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_insights"
  ON insights FOR ALL USING (true) WITH CHECK (true);
