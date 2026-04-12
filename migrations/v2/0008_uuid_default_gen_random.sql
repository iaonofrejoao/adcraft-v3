-- Migration: 0008_uuid_default_gen_random.sql
-- Todas as tabelas v2 foram criadas com "id" uuid PRIMARY KEY NOT NULL
-- sem DEFAULT gen_random_uuid(). Inserts via Supabase JS client que não
-- fornecem id explícito falham com null-constraint silenciosamente.
-- Este migration adiciona DEFAULT gen_random_uuid() a todas elas.
-- Inserts que já passam id explícito não são afetados.

ALTER TABLE embeddings       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE llm_calls        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE approvals        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE conversations    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE copy_combinations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE copy_components  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE messages         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE niche_learnings  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pipelines        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE product_knowledge ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE prompt_caches    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tasks             ALTER COLUMN id SET DEFAULT gen_random_uuid();
