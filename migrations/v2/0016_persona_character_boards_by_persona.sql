-- 0016_persona_character_boards_by_persona.sql
-- Adiciona mapeamento de imagens de referência por persona_id em persona_assets.
-- Permite vídeos com múltiplas personas, cada uma com sua própria imagem de referência.

ALTER TABLE persona_assets
  ADD COLUMN IF NOT EXISTS character_boards_by_persona JSONB;

COMMENT ON COLUMN persona_assets.character_boards_by_persona IS
  'Mapa de persona_id → { image_url, prompt, generated_at }. '
  'Cada persona do storyboard tem sua imagem de referência gerada uma única vez e reutilizada em todas as cenas.';
