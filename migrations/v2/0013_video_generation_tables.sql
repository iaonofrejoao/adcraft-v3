-- Migration: 0013_video_generation_tables.sql
-- Tabelas para o sistema de geração de vídeo AdCraft v3.
-- Sprint 1 — Fundação de dados e UGC.

-- ── persona_assets ────────────────────────────────────────────────────────────
-- Setup visual/vocal da persona. Criado 1× por produto, reutilizado em todos os vídeos.
CREATE TABLE IF NOT EXISTS persona_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID REFERENCES products(id) ON DELETE CASCADE,
  pipeline_id         UUID REFERENCES pipelines(id),
  photos              JSONB,                        -- array de URLs das 6 fotos (Flux 1.1 Pro)
  heygen_avatar_id    TEXT,                         -- ID do avatar criado no HeyGen
  elevenlabs_voice_id TEXT,                         -- ID da voz escolhida no ElevenLabs
  status              TEXT NOT NULL DEFAULT 'creating', -- creating | ready | failed
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,

  CONSTRAINT persona_assets_status_check
    CHECK (status IN ('creating', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS persona_assets_product_idx ON persona_assets (product_id);

-- ── tiktok_videos ─────────────────────────────────────────────────────────────
-- Vídeos UGC coletados via yt-dlp, pontuados por Gemini Vision, aprovados/rejeitados
-- manualmente pelo usuário antes de entrar na composição final.
CREATE TABLE IF NOT EXISTS tiktok_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID REFERENCES products(id) ON DELETE CASCADE,
  tiktok_url       TEXT NOT NULL,
  tiktok_video_id  TEXT,
  author_handle    TEXT,
  description      TEXT,
  views_count      INTEGER,
  likes_count      INTEGER,
  relevance_score  DECIMAL(3,2),                   -- score Gemini Vision 0.00–1.00
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  local_path       TEXT,                           -- caminho do arquivo baixado localmente
  thumbnail_url    TEXT,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,

  CONSTRAINT tiktok_videos_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT tiktok_videos_score_check
    CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1))
);

CREATE INDEX IF NOT EXISTS tiktok_videos_product_idx ON tiktok_videos (product_id);
CREATE INDEX IF NOT EXISTS tiktok_videos_status_idx  ON tiktok_videos (product_id, status);

-- ── final_videos ──────────────────────────────────────────────────────────────
-- Vídeos finais gerados por combinação de copy (hook + body + cta).
-- Progresso rastreado em tempo real via Supabase Realtime.
CREATE TABLE IF NOT EXISTS final_videos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID REFERENCES products(id) ON DELETE CASCADE,
  pipeline_id          UUID REFERENCES pipelines(id),
  copy_combination_id  UUID NOT NULL,              -- referência a copy_combinations.id
  status               TEXT NOT NULL DEFAULT 'queued',
    -- queued | generating_persona | generating_scenes
    -- | processing_ugc | composing | adding_captions | ready | failed
  progress_step        TEXT,                       -- label exibido na barra de progresso
  video_url            TEXT,                       -- URL pública do .mp4 final
  thumbnail_url        TEXT,
  duration_seconds     DECIMAL(5,2),
  composition_config   JSONB,                      -- ordem de cenas, clipes UGC usados, pacing
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,

  CONSTRAINT final_videos_status_check
    CHECK (status IN (
      'queued', 'generating_persona', 'generating_scenes',
      'processing_ugc', 'composing', 'adding_captions', 'ready', 'failed'
    ))
);

CREATE INDEX IF NOT EXISTS final_videos_product_idx     ON final_videos (product_id);
CREATE INDEX IF NOT EXISTS final_videos_status_idx      ON final_videos (product_id, status);
CREATE INDEX IF NOT EXISTS final_videos_combination_idx ON final_videos (copy_combination_id);
