-- Migration: 0009_schema_integrity_fixes.sql
-- QA Grupo Z — 3 schema integrity fixes
-- FAIL #1: SKU gerado com md5 (hex 0-9A-F) → puro A-Z
-- FAIL #6: budget_usd sem CHECK constraint
-- FAIL #7: tasks.pipeline_id sem FK para pipelines

-- ============================================================
-- FAIL #1 — Corrige generate_random_sku() para A-Z puro
-- ============================================================
-- Substitui a lógica de md5/upper por chr(65..90).
-- chr(65) = 'A', chr(90) = 'Z' — 26 letras, sem dígitos.
-- SKUs existentes NÃO são alterados (trigger só dispara em INSERT).
CREATE OR REPLACE FUNCTION generate_random_sku()
RETURNS TRIGGER AS $$
DECLARE
    new_sku char(4);
    is_unique boolean := false;
BEGIN
    WHILE NOT is_unique LOOP
        new_sku :=
            chr(65 + floor(random() * 26)::int) ||
            chr(65 + floor(random() * 26)::int) ||
            chr(65 + floor(random() * 26)::int) ||
            chr(65 + floor(random() * 26)::int);
        SELECT NOT EXISTS (
            SELECT 1 FROM products WHERE sku = new_sku
        ) INTO is_unique;
    END LOOP;

    NEW.sku := new_sku; -- já A-Z, upper() desnecessário
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger continua igual; apenas a função foi substituída acima.
-- O DROP/CREATE abaixo garante que o trigger aponte para a versão nova.
DROP TRIGGER IF EXISTS trigger_generate_sku ON products;
CREATE TRIGGER trigger_generate_sku
BEFORE INSERT ON products
FOR EACH ROW
WHEN (NEW.sku IS NULL)
EXECUTE FUNCTION generate_random_sku();

-- ============================================================
-- FAIL #6 — CHECK constraint budget_usd > 0
-- ============================================================
-- Guard: aborta a migration se houver pipeline com budget_usd <= 0.
-- Corrige a constraint apenas se o banco estiver limpo.
DO $$
DECLARE
    bad_count integer;
BEGIN
    SELECT COUNT(*) INTO bad_count
    FROM pipelines
    WHERE budget_usd IS NOT NULL AND budget_usd <= 0;

    IF bad_count > 0 THEN
        RAISE EXCEPTION
            'FAIL #6 bloqueado: % pipeline(s) com budget_usd <= 0 encontrado(s). '
            'Limpe esses registros antes de aplicar a constraint.',
            bad_count;
    END IF;
END;
$$;

ALTER TABLE pipelines
    ADD CONSTRAINT pipelines_budget_positive CHECK (budget_usd > 0);

-- ============================================================
-- FAIL #7 — FK tasks.pipeline_id → pipelines(id)
-- ============================================================
-- Guard: aborta se existirem tasks com pipeline_id órfão.
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM tasks t
    LEFT JOIN pipelines p ON p.id = t.pipeline_id
    WHERE p.id IS NULL
      AND t.pipeline_id IS NOT NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
            'FAIL #7 bloqueado: % task(s) com pipeline_id órfão encontrada(s). '
            'Execute: SELECT t.id, t.pipeline_id, t.agent_name FROM tasks t '
            'LEFT JOIN pipelines p ON p.id = t.pipeline_id WHERE p.id IS NULL AND t.pipeline_id IS NOT NULL; '
            'Limpe esses registros antes de aplicar a FK.',
            orphan_count;
    END IF;
END;
$$;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_pipeline_id_fk
    FOREIGN KEY (pipeline_id)
    REFERENCES pipelines(id)
    ON DELETE CASCADE;
