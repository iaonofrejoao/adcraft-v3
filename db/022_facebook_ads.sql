-- Migration 022: Tabela para anúncios do Facebook Ads Library
-- Coletados via Apify. Score de relevância baseado em dias no ar (proxy de performance).

CREATE TABLE IF NOT EXISTS facebook_ads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fb_ad_id         TEXT        NOT NULL,
  page_name        TEXT,
  page_id          TEXT,
  ad_copy          TEXT,
  headline         TEXT,
  cta_text         TEXT,
  destination_url  TEXT,
  media_type       TEXT,
  video_url        TEXT,
  image_url        TEXT,
  platforms        TEXT[],
  started_at       TIMESTAMPTZ,
  stopped_at       TIMESTAMPTZ,
  days_running     INTEGER,
  relevance_score  NUMERIC(4,2),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  UNIQUE (product_id, fb_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_facebook_ads_product_status ON facebook_ads(product_id, status);
CREATE INDEX IF NOT EXISTS idx_facebook_ads_product_score  ON facebook_ads(product_id, relevance_score DESC NULLS LAST);

ALTER TABLE facebook_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_manage_facebook_ads ON facebook_ads
  FOR ALL USING (auth.role() = 'authenticated');
