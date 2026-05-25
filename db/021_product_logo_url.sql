-- Migration 021: adiciona logo_url na tabela products
-- Permite exibir a foto/logo do produto nos cards da listagem.

ALTER TABLE products ADD COLUMN IF NOT EXISTS logo_url TEXT;
