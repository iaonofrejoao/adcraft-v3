-- 0015_persona_assets_v2.sql
-- Migra persona_assets para o novo fluxo Nano Banana + Veo 3.
-- Remove dependência de HeyGen e ElevenLabs da geração de vídeo.
-- Adiciona character board do Nano Banana.
-- Atualiza final_videos para o novo modelo (clips por cena no Drive, sem MP4 composto).

-- ── persona_assets: adicionar suporte ao Nano Banana ─────────────────────────

ALTER TABLE persona_assets
  ADD COLUMN IF NOT EXISTS nano_banana_character_board JSONB;

COMMENT ON COLUMN persona_assets.nano_banana_character_board IS
  'Array de URLs das imagens do character board gerado pelo Nano Banana. '
  'Reutilizado em todas as cenas persona do mesmo pipeline.';

-- heygen_avatar_id e elevenlabs_voice_id permanecem nullable para manter histórico.
-- Não são mais populados para novos pipelines.

-- ── final_videos: adaptar para clips individuais no Drive ────────────────────

-- Renomear video_url → drive_folder_url (link para pasta do Drive com os clips)
ALTER TABLE final_videos
  RENAME COLUMN video_url TO drive_folder_url;

COMMENT ON COLUMN final_videos.drive_folder_url IS
  'URL da pasta no Google Drive contendo os clips individuais de cada cena. '
  'Substituiu video_url (MP4 composto) no fluxo Nano Banana + Veo 3.';

-- thumbnail_url passa a ser opcional (não há mais MP4 final montado localmente)
-- Manter a coluna para uso futuro (ex: thumbnail extraída do primeiro clip).

-- Atualizar enum de status
ALTER TABLE final_videos DROP CONSTRAINT IF EXISTS final_videos_status_check;
ALTER TABLE final_videos ADD CONSTRAINT final_videos_status_check
  CHECK (status IN (
    'queued',
    'generating_character_board',
    'generating_scenes',
    'saving_to_drive',
    'ready',
    'failed',
    -- status legados (mantidos para registros históricos)
    'generating_persona',
    'processing_ugc',
    'composing',
    'adding_captions'
  ));

COMMENT ON COLUMN final_videos.status IS
  'Status do pipeline de geração. '
  'Fluxo novo: queued → generating_character_board → generating_scenes → saving_to_drive → ready | failed. '
  'Status legados (generating_persona, processing_ugc, composing, adding_captions) mantidos para histórico.';
