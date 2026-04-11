-- Migration: 002_create_functions
-- Created: 2026-04-05
-- Description: Cria funções utilitárias reutilizáveis por todas as tabelas do projeto
-- Depends on: 001_create_enums

BEGIN;

-- ============================================================
-- FUNÇÃO: update_updated_at
-- Purpose: Atualiza automaticamente o campo updated_at para NOW()
--          sempre que uma linha for modificada via UPDATE.
-- Used by: Trigger set_updated_at criado em cada tabela que
--          possui a coluna updated_at (todas as tabelas do projeto).
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at() IS
'Função de trigger reutilizável que define updated_at = NOW() antes de cada UPDATE. '
'Deve ser associada via trigger BEFORE UPDATE em toda tabela que possui a coluna updated_at. '
'Padrão de uso: '
'  CREATE TRIGGER set_{tabela}_updated_at '
'  BEFORE UPDATE ON {tabela} '
'  FOR EACH ROW EXECUTE FUNCTION update_updated_at();';

COMMIT;
