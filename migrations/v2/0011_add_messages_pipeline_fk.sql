-- Migration: 0011_add_messages_pipeline_fk.sql
-- Adiciona FK messages.pipeline_id → pipelines(id).
-- Limpa referências órfãs antes de criar a constraint.

-- 1. Anula pipeline_id em messages que apontam para pipelines inexistentes
UPDATE messages
SET pipeline_id = NULL
WHERE pipeline_id IS NOT NULL
  AND pipeline_id NOT IN (SELECT id FROM pipelines);

-- 2. Adiciona o FK constraint
ALTER TABLE messages
  ADD CONSTRAINT messages_pipeline_id_fkey
  FOREIGN KEY (pipeline_id)
  REFERENCES pipelines(id)
  ON DELETE SET NULL;
