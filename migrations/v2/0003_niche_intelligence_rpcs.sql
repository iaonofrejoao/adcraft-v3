-- v2/0003_niche_intelligence_rpcs.sql
-- Funções PL/pgSQL para Niche Intelligence (Fase 2.7).
-- PRD seção 7.2 — niche_learnings write/reinforce/query.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. write_niche_learning
--    Insere novo learning e enfileira embedding se confidence >= 0.5.
--    Regra 15 equivalente para niche layer.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION write_niche_learning(
  p_niche_id      uuid,
  p_learning_type text,
  p_content       text,
  p_evidence      jsonb DEFAULT '{}',
  p_confidence    float DEFAULT 0.3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid := gen_random_uuid();
  v_record jsonb;
BEGIN
  INSERT INTO niche_learnings (
    id, niche_id, learning_type, content, evidence,
    confidence, occurrences, status, created_at, last_reinforced_at
  ) VALUES (
    v_new_id, p_niche_id, p_learning_type, p_content, p_evidence,
    p_confidence, 1, 'active', NOW(), NOW()
  );

  -- Enfileira embedding apenas se confidence >= 0.5 (lazy generation — Regra skill pgvector-search)
  IF p_confidence >= 0.5 THEN
    INSERT INTO embeddings (id, source_table, source_id, model, created_at)
    VALUES (gen_random_uuid(), 'niche_learnings', v_new_id, 'gemini-embedding-001', NOW());
  END IF;

  SELECT to_jsonb(nl.*) INTO v_record
  FROM niche_learnings nl
  WHERE nl.id = v_new_id;

  RETURN v_record;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. reinforce_niche_learning
--    Incrementa occurrences, sobe confidence (min 1.0), atualiza last_reinforced_at.
--    Se confidence cruzar 0.5 para cima: enfileira embedding (se ainda não existir).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reinforce_niche_learning(
  p_id              uuid,
  p_extra_evidence  jsonb DEFAULT NULL,
  p_delta           int   DEFAULT 1        -- quantos novos sinais chegaram
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_confidence  float;
  v_new_confidence  float;
  v_record          jsonb;
  v_embedding_exists boolean;
BEGIN
  SELECT confidence INTO v_old_confidence
  FROM niche_learnings
  WHERE id = p_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'niche_learning % not found or inactive', p_id;
  END IF;

  -- Cada sinal sobe em 0.1, teto em 1.0
  v_new_confidence := LEAST(1.0, v_old_confidence + (0.1 * p_delta));

  UPDATE niche_learnings
  SET
    occurrences       = occurrences + p_delta,
    confidence        = v_new_confidence,
    last_reinforced_at = NOW(),
    evidence          = CASE
                          WHEN p_extra_evidence IS NOT NULL
                          THEN COALESCE(evidence, '[]'::jsonb) || p_extra_evidence
                          ELSE evidence
                        END
  WHERE id = p_id;

  -- Enfileira embedding se cruzou o threshold 0.5 e ainda não existe entry de embedding
  IF v_old_confidence < 0.5 AND v_new_confidence >= 0.5 THEN
    SELECT EXISTS(
      SELECT 1 FROM embeddings
      WHERE source_table = 'niche_learnings' AND source_id = p_id
    ) INTO v_embedding_exists;

    IF NOT v_embedding_exists THEN
      INSERT INTO embeddings (id, source_table, source_id, model, created_at)
      VALUES (gen_random_uuid(), 'niche_learnings', p_id, 'gemini-embedding-001', NOW());
    END IF;
  END IF;

  SELECT to_jsonb(nl.*) INTO v_record
  FROM niche_learnings nl
  WHERE nl.id = p_id;

  RETURN v_record;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. query_niche_learnings
--    Busca híbrida: filtro relacional + similaridade vetorial (pgvector).
--    p_query_vector NULL → ordena só por confidence (fallback sem embedding).
--    PRD seção 7.2 / Skill pgvector-search.md
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION query_niche_learnings(
  p_niche_id      uuid,
  p_types         text[],
  p_query_vector  vector(768) DEFAULT NULL,
  p_limit         int         DEFAULT 15
)
RETURNS TABLE (
  id              uuid,
  learning_type   text,
  content         text,
  confidence      float,
  occurrences     int,
  last_reinforced_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_query_vector IS NOT NULL THEN
    -- Busca híbrida: confidence desc + cosine distance asc (learnings com embedding)
    RETURN QUERY
      SELECT nl.id, nl.learning_type, nl.content,
             nl.confidence::float, nl.occurrences,
             nl.last_reinforced_at
      FROM niche_learnings nl
      JOIN embeddings e
        ON  e.source_table = 'niche_learnings'
        AND e.source_id    = nl.id
        AND e.embedding   IS NOT NULL
      WHERE nl.niche_id     = p_niche_id
        AND nl.learning_type = ANY(p_types)
        AND nl.status        = 'active'
      ORDER BY nl.confidence DESC, e.embedding <=> p_query_vector ASC
      LIMIT p_limit;
  ELSE
    -- Fallback: sem embedding disponível → ordena por confidence apenas
    RETURN QUERY
      SELECT nl.id, nl.learning_type, nl.content,
             nl.confidence::float, nl.occurrences,
             nl.last_reinforced_at
      FROM niche_learnings nl
      WHERE nl.niche_id     = p_niche_id
        AND nl.learning_type = ANY(p_types)
        AND nl.status        = 'active'
      ORDER BY nl.confidence DESC, nl.occurrences DESC
      LIMIT p_limit;
  END IF;
END;
$$;
