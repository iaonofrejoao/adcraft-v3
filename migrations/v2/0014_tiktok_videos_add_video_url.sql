-- Migration: 0014_tiktok_videos_add_video_url.sql
-- Adiciona coluna video_url à tabela tiktok_videos para armazenar
-- a URL direta do CDN retornada pelo Apify (campo videoUrl / downloadAddr).
-- Permite exibir um player de vídeo nativo no frontend sem depender do embed TikTok.

ALTER TABLE tiktok_videos ADD COLUMN IF NOT EXISTS video_url TEXT;
