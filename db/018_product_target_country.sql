-- 018_product_target_country.sql
-- Adiciona target_country ao produto para geração de materiais com adaptações culturais

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS target_country TEXT NOT NULL DEFAULT 'BR'
    CHECK (target_country IN ('BR','US','PT','ES','MX','AR','CO','CL','PE','FR','DE','IT','GB'));
