-- 017_product_vsl_fields.sql
-- Adiciona campos VSL, viability_score e status ao produto

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS vsl_url            TEXT,
  ADD COLUMN IF NOT EXISTS vsl_source         TEXT CHECK (vsl_source IN ('upload', 'external')),
  ADD COLUMN IF NOT EXISTS vsl_uploaded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vsl_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS vsl_file_size_bytes  BIGINT,
  ADD COLUMN IF NOT EXISTS viability_score    NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived'));
