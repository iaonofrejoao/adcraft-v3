-- Migration: 0007_fix_find_nearest_niche_type.sql
-- Fix: RETURNS TABLE declara niche_name text, mas niches.name é varchar(255).
-- PostgreSQL 42804: tipo retornado não bate com o declarado.
-- Solução: CAST explícito de n.name para text no SELECT (não altera a coluna).

DROP FUNCTION IF EXISTS find_nearest_niche(vector(768), float, integer);

CREATE FUNCTION find_nearest_niche(
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
    n.id                                     AS niche_id,
    n.name::text                             AS niche_name,
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
