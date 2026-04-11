-- Migration v2/0005 — Adiciona coluna confirmed_oversized na tabela tasks
-- Usada pelo video_maker para permitir que o usuário confirme geração acima do cap de 5 vídeos

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS confirmed_oversized boolean DEFAULT false; -- usuário confirmou execução acima do cap econômico
