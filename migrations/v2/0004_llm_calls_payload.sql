-- v2/0004_llm_calls_payload.sql
-- Adiciona coluna payload jsonb em llm_calls para rastreamento fino de custo.
-- Uso principal: embeddings armazenam { source_table, source_id } para correlação.

ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS payload jsonb;
COMMENT ON COLUMN llm_calls.payload IS 'Metadados adicionais de rastreamento — ex: {source_table, source_id} para embeddings';
