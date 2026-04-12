-- Migration: 0010_copy_components_approval_flow.sql
-- Adiciona colunas faltantes para o fluxo de aprovação por componente.
--
-- CONTEXTO (QA v3 bug final):
--   A tabela copy_components foi criada em 0000 com approval_status e approved_at,
--   mas sem slot_number, rejected_at, rejection_reason, e sem CHECK constraints.
--   As rotas /approve e /reject já selecionam slot_number e esperam rejected_at.
--
-- COLUNAS ADICIONADAS:
--   slot_number    integer  — posição ordinal dentro do tipo (hook 1, hook 2, hook 3...)
--   rejected_at    timestamptz — timestamp de rejeição
--   rejection_reason text   — motivo da rejeição (obrigatório se rejected_at não é null)
--
-- CONSTRAINTS ADICIONADAS:
--   CHECK approval_status IN ('pending','approved','rejected')
--   CHECK consistência rejection: rejected_at null ↔ rejection_reason null
--
-- BACKFILLS:
--   approved_at IS NOT NULL → approval_status = 'approved' (devia já estar assim)
--   slot_number preenchido por ROW_NUMBER OVER (PARTITION BY product_id, pipeline_id, component_type ORDER BY created_at)

BEGIN;

-- ============================================================
-- 1. Adicionar colunas faltantes
-- ============================================================

ALTER TABLE copy_components
  ADD COLUMN IF NOT EXISTS slot_number integer;
  -- Nota: será NOT NULL após backfill (ver passo 4)

ALTER TABLE copy_components
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE copy_components
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ============================================================
-- 2. CHECK constraint em approval_status
--    approval_status já existe (criado em 0000). Só faltava o guard.
-- ============================================================

-- Guard: aborta se houver valores que violam a constraint antes de criá-la
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM copy_components
  WHERE approval_status NOT IN ('pending', 'approved', 'rejected');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Migration bloqueada: % copy_component(s) com approval_status inválido. '
      'Corrija os registros antes de aplicar a migration.',
      bad_count;
  END IF;
END;
$$;

ALTER TABLE copy_components
  ADD CONSTRAINT copy_components_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- ============================================================
-- 3. Backfill: approval_status baseado em approved_at
--    Seguro: só atualiza quem está 'pending' mas tem approved_at preenchido
-- ============================================================

UPDATE copy_components
SET approval_status = 'approved'
WHERE approved_at IS NOT NULL
  AND approval_status = 'pending';

-- ============================================================
-- 4. Backfill: slot_number por ordem de criação dentro do grupo
-- ============================================================

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, pipeline_id, component_type
      ORDER BY created_at
    ) AS computed_slot
  FROM copy_components
)
UPDATE copy_components
SET slot_number = ordered.computed_slot
FROM ordered
WHERE copy_components.id = ordered.id
  AND copy_components.slot_number IS NULL;

-- Após backfill, garantir NOT NULL
ALTER TABLE copy_components
  ALTER COLUMN slot_number SET NOT NULL;

-- ============================================================
-- 5. CHECK: consistência de rejeição
--    Se rejected_at existe → rejection_reason deve existir (e vice-versa)
-- ============================================================

ALTER TABLE copy_components
  ADD CONSTRAINT copy_components_rejection_consistency
  CHECK (
    (rejected_at IS NULL AND rejection_reason IS NULL) OR
    (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
  );

COMMIT;
