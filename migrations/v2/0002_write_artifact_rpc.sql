-- v2/0002_write_artifact_rpc.sql
-- Funções PL/pgSQL para a knowledge layer.
-- Executa atomicamente dentro de uma única transação Postgres.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. write_artifact
--    Supersede artifact anterior, insere novo, faz merge em pipeline.state,
--    e enfileira embedding (row com embedding IS NULL para o worker processar).
--    Regra 15: chamada obrigatória após cada agente completar.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION write_artifact(
  p_product_id        uuid,
  p_product_version   integer,
  p_artifact_type     text,
  p_artifact_data     jsonb,
  p_source_pipeline_id uuid,
  p_source_task_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id        uuid := gen_random_uuid();
  v_embedding_id  uuid := gen_random_uuid();
  v_record        jsonb;
BEGIN
  -- 1. Supersede todos os artifacts frescos do mesmo tipo para este produto
  UPDATE product_knowledge
  SET
    status        = 'superseded',
    superseded_at = NOW(),
    superseded_by = v_new_id
  WHERE
    product_id    = p_product_id
    AND artifact_type = p_artifact_type
    AND status    = 'fresh';

  -- 2. Inserir novo artifact
  INSERT INTO product_knowledge (
    id, product_id, product_version, artifact_type, artifact_data,
    source_pipeline_id, source_task_id, status, created_at
  ) VALUES (
    v_new_id, p_product_id, p_product_version, p_artifact_type, p_artifact_data,
    p_source_pipeline_id, p_source_task_id, 'fresh', NOW()
  );

  -- 3. Merge em pipeline.state — chave = artifact_type (nunca substituição total)
  UPDATE pipelines
  SET
    state      = COALESCE(state, '{}'::jsonb) || jsonb_build_object(p_artifact_type, p_artifact_data),
    updated_at = NOW()
  WHERE id = p_source_pipeline_id;

  -- 4. Enfileira embedding (embedding IS NULL = pendente de geração pelo worker)
  INSERT INTO embeddings (id, source_table, source_id, model, created_at)
  VALUES (v_embedding_id, 'product_knowledge', v_new_id, 'gemini-embedding-001', NOW());

  SELECT to_jsonb(pk.*) INTO v_record
  FROM product_knowledge pk
  WHERE pk.id = v_new_id;

  RETURN v_record;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. find_nearest_niche
--    Retorna o niche_id mais próximo via cosine distance no pgvector.
--    Usado pelo cadastro de produto para classificação automática.
--    Retorna NULL se não houver nicho com embedding pré-computado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_nearest_niche(
  query_embedding  vector(768),
  match_threshold  float DEFAULT 0.75,
  match_count      integer DEFAULT 1
)
RETURNS TABLE (
  niche_id   uuid,
  niche_name text,
  distance   float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id                                  AS niche_id,
    n.name                                AS niche_name,
    (e.embedding <=> query_embedding)::float AS distance
  FROM niches n
  JOIN embeddings e
    ON e.source_table = 'niches'
    AND e.source_id   = n.id
    AND e.embedding IS NOT NULL
  WHERE (e.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY e.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
