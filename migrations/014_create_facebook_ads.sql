-- Migration: 014_create_facebook_ads
-- Created: 2026-06-08
-- Description: Tabela para armazenar anúncios do Facebook Ads Library coletados via Apify.
--              Análogo a tiktok_videos, mas com proxy de performance por dias_no_ar.
-- Depends on: 007_create_products

BEGIN;

-- ============================================================
-- TABLE: facebook_ads
-- Purpose: Anúncios concorrentes coletados do Facebook Ads Library via Apify.
--          Usados como referência criativa e de posicionamento nos agentes de pipeline.
-- Written by: scripts/video/scrape-fb-ads.ts (via Apify facebook-ads-library-scraper)
-- Read by: Aba "Anúncios FB" em /products/[sku]/facebook-ads;
--          Agentes Benchmark Intelligence e Angle Generator (busca vetorial em product_knowledge)
-- ============================================================

CREATE TABLE facebook_ads (
  -- Primary key
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key
  product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Identificação do anúncio na Meta Ads Library
  fb_ad_id         TEXT        NOT NULL,

  -- Anunciante
  page_name        TEXT,
  page_id          TEXT,

  -- Criativo
  ad_copy          TEXT,         -- corpo principal do anúncio
  headline         TEXT,         -- título / manchete
  cta_text         TEXT,         -- texto do botão de CTA
  destination_url  TEXT,         -- URL de destino (landing page)

  -- Mídia
  media_type       TEXT,         -- 'video' | 'image' | 'carousel' | 'unknown'
  video_url        TEXT,         -- URL do vídeo (se media_type = video)
  image_url        TEXT,         -- URL da imagem (thumbnail ou creative)

  -- Distribuição
  platforms        TEXT[],       -- ex: ['facebook', 'instagram', 'audience_network']

  -- Temporalidade (proxy de performance: quanto mais tempo rodando, mais converte)
  started_at       TIMESTAMPTZ,  -- quando o anúncio começou a rodar
  stopped_at       TIMESTAMPTZ,  -- NULL = ainda ativo
  days_running     INTEGER,      -- dias em ar no momento do scraping (calculado)

  -- Score de relevância local (0.00–1.00)
  -- 60% dias_no_ar + 30% relevância por keywords + 10% bônus de vídeo
  relevance_score  NUMERIC(4,2),

  -- Estado de revisão humana
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,

  -- Unicidade: evita duplicatas do mesmo anúncio no mesmo produto
  UNIQUE (product_id, fb_ad_id)
);

-- Índices
CREATE INDEX idx_facebook_ads_product_status
  ON facebook_ads(product_id, status);

CREATE INDEX idx_facebook_ads_product_score
  ON facebook_ads(product_id, relevance_score DESC NULLS LAST);

-- RLS — qualquer usuário autenticado pode ler/escrever (mesmo escopo que tiktok_videos)
ALTER TABLE facebook_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_facebook_ads" ON facebook_ads
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Comentários
COMMENT ON TABLE facebook_ads IS
'Anúncios do Facebook Ads Library coletados via Apify para servir como referência '
'criativa nos agentes de pipeline. Sem métricas reais de performance — usa dias_no_ar '
'como proxy: anúncios ativos por 30+ dias são fortes sinais de conversão. '
'Anúncios aprovados são salvos como artefatos ugc_reference em product_knowledge '
'e enfileirados para embedding vetorial.';

COMMENT ON COLUMN facebook_ads.fb_ad_id IS
'ID do anúncio no Facebook Ads Library (adArchiveID). '
'Único por produto — upsert evita duplicatas entre scrapes.';

COMMENT ON COLUMN facebook_ads.days_running IS
'Dias que o anúncio está/estava no ar no momento do scraping. '
'Calculado como: DATEDIFF(day, started_at, COALESCE(stopped_at, NOW())). '
'Principal sinal de performance: 30+ dias = provável conversão.';

COMMENT ON COLUMN facebook_ads.relevance_score IS
'Score local 0.00–1.00 calculado sem custo de API: '
'60% longevidade (days_running, capped em 90 dias); '
'30% relevância por keywords do produto/nicho; '
'10% bônus de mídia (vídeo > carousel > imagem).';

COMMENT ON COLUMN facebook_ads.status IS
'Estado de revisão: pending = aguardando análise humana; '
'approved = aprovado, análise Gemini disparada em background; '
'rejected = descartado.';

COMMIT;
