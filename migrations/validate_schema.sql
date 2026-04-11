-- =============================================================
-- SCRIPT DE VALIDAÇÃO DO SCHEMA — AdCraft
-- Created: 2026-04-05
-- Description: Verifica se todas as tabelas, colunas, tipos enum,
--              índices, triggers, funções e RLS policies foram criados
--              corretamente pelas migrations 001 a 013.
-- Usage: Execute no SQL Editor do Supabase. Todos os resultados
--        devem retornar status = 'OK'. Qualquer 'MISSING' indica
--        que a migration correspondente não foi aplicada.
-- =============================================================

-- -------------------------------------------------------------
-- SEÇÃO 1 — TIPOS ENUM (migration 001)
-- -------------------------------------------------------------

SELECT
  'ENUM' AS category,
  t.typname AS object_name,
  CASE WHEN t.typname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('execution_status'),
    ('asset_type'),
    ('approval_status'),
    ('notification_type'),
    ('knowledge_status'),
    ('orchestrator_behavior')
) AS expected(typname)
LEFT JOIN pg_type t
  ON t.typname = expected.typname
  AND t.typtype = 'e'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 2 — VALORES DOS ENUMS
-- -------------------------------------------------------------

SELECT
  'ENUM_VALUE' AS category,
  t.typname || '.' || e.enumlabel AS object_name,
  'OK' AS status
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname IN (
  'execution_status', 'asset_type', 'approval_status',
  'notification_type', 'knowledge_status', 'orchestrator_behavior'
)

UNION ALL

-- Verifica valores esperados que estão faltando
SELECT
  'ENUM_VALUE' AS category,
  expected.type_name || '.' || expected.val AS object_name,
  CASE WHEN e.enumlabel IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('execution_status',     'pending'),
    ('execution_status',     'running'),
    ('execution_status',     'paused_for_approval'),
    ('execution_status',     'completed'),
    ('execution_status',     'failed'),
    ('execution_status',     'cancelled'),
    ('asset_type',           'character'),
    ('asset_type',           'keyframe'),
    ('asset_type',           'video_clip'),
    ('asset_type',           'final_video'),
    ('asset_type',           'script'),
    ('asset_type',           'copy'),
    ('asset_type',           'hook'),
    ('asset_type',           'audio_narration'),
    ('approval_status',      'pending'),
    ('approval_status',      'approved'),
    ('approval_status',      'rejected'),
    ('approval_status',      'approved_with_feedback'),
    ('notification_type',    'failure'),
    ('notification_type',    'completion'),
    ('knowledge_status',     'pending_approval'),
    ('knowledge_status',     'approved'),
    ('knowledge_status',     'rejected'),
    ('orchestrator_behavior','stop'),
    ('orchestrator_behavior','continue'),
    ('orchestrator_behavior','agent_decides')
) AS expected(type_name, val)
LEFT JOIN pg_enum e
  ON e.enumlabel = expected.val
LEFT JOIN pg_type t
  ON t.oid = e.enumtypid
  AND t.typname = expected.type_name
WHERE e.enumlabel IS NULL
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 3 — FUNÇÃO update_updated_at (migration 002)
-- -------------------------------------------------------------

SELECT
  'FUNCTION' AS category,
  p.proname AS object_name,
  CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (VALUES ('update_updated_at')) AS expected(proname)
LEFT JOIN pg_proc p
  ON p.proname = expected.proname
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 4 — TABELAS (migrations 003 a 013)
-- -------------------------------------------------------------

SELECT
  'TABLE' AS category,
  expected.tablename AS object_name,
  CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('users'),
    ('user_credentials'),
    ('niches'),
    ('niche_memory'),
    ('pattern_intelligence'),
    ('products'),
    ('templates'),
    ('projects'),
    ('executions'),
    ('assets'),
    ('campaigns'),
    ('performance_snapshots'),
    ('notifications'),
    ('knowledge_approval_queue')
) AS expected(tablename)
LEFT JOIN pg_tables t
  ON t.tablename = expected.tablename
  AND t.schemaname = 'public'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 5 — COLUNAS CRÍTICAS POR TABELA
-- -------------------------------------------------------------

SELECT
  'COLUMN' AS category,
  expected.tablename || '.' || expected.colname AS object_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    -- users
    ('users',                    'id'),
    ('users',                    'email'),
    ('users',                    'name'),
    ('users',                    'created_at'),
    ('users',                    'updated_at'),
    -- user_credentials
    ('user_credentials',         'id'),
    ('user_credentials',         'user_id'),
    ('user_credentials',         'key_name'),
    ('user_credentials',         'service'),
    ('user_credentials',         'encrypted_value'),
    -- niches
    ('niches',                   'id'),
    ('niches',                   'name'),
    ('niches',                   'slug'),
    ('niches',                   'status'),
    ('niches',                   'trained_at'),
    -- niche_memory
    ('niche_memory',             'id'),
    ('niche_memory',             'niche_id'),
    ('niche_memory',             'memory_type'),
    ('niche_memory',             'content'),
    ('niche_memory',             'confidence_score'),
    ('niche_memory',             'knowledge_status'),
    ('niche_memory',             'times_validated'),
    ('niche_memory',             'times_invalidated'),
    ('niche_memory',             'approved_by_user_id'),
    -- pattern_intelligence
    ('pattern_intelligence',     'id'),
    ('pattern_intelligence',     'pattern_type'),
    ('pattern_intelligence',     'pattern_value'),
    ('pattern_intelligence',     'applicable_niches'),
    ('pattern_intelligence',     'avg_roas'),
    ('pattern_intelligence',     'sample_size'),
    ('pattern_intelligence',     'confidence_score'),
    -- products
    ('products',                 'id'),
    ('products',                 'user_id'),
    ('products',                 'niche_id'),
    ('products',                 'name'),
    ('products',                 'platform'),
    ('products',                 'product_url'),
    ('products',                 'affiliate_link'),
    ('products',                 'vsl_url'),
    ('products',                 'commission_percent'),
    ('products',                 'ticket_price'),
    ('products',                 'target_country'),
    ('products',                 'target_language'),
    ('products',                 'vsl_transcript'),
    ('products',                 'deleted_at'),
    -- templates
    ('templates',                'id'),
    ('templates',                'user_id'),
    ('templates',                'name'),
    ('templates',                'description'),
    ('templates',                'flow_schema'),
    ('templates',                'is_active'),
    -- projects
    ('projects',                 'id'),
    ('projects',                 'user_id'),
    ('projects',                 'product_id'),
    ('projects',                 'template_id'),
    ('projects',                 'name'),
    ('projects',                 'ad_account_facebook'),
    ('projects',                 'ad_account_google'),
    ('projects',                 'budget_for_test'),
    ('projects',                 'orchestrator_behavior_on_failure'),
    ('projects',                 'deleted_at'),
    -- executions
    ('executions',               'id'),
    ('executions',               'project_id'),
    ('executions',               'user_id'),
    ('executions',               'source_execution_ids'),
    ('executions',               'template_snapshot'),
    ('executions',               'shared_state'),
    ('executions',               'node_statuses'),
    ('executions',               'node_config'),
    ('executions',               'status'),
    ('executions',               'total_cost_usd'),
    ('executions',               'total_tokens'),
    ('executions',               'celery_task_id'),
    ('executions',               'started_at'),
    ('executions',               'completed_at'),
    -- assets
    ('assets',                   'id'),
    ('assets',                   'user_id'),
    ('assets',                   'project_id'),
    ('assets',                   'product_id'),
    ('assets',                   'execution_id'),
    ('assets',                   'asset_type'),
    ('assets',                   'file_url'),
    ('assets',                   'file_extension'),
    ('assets',                   'file_size_bytes'),
    ('assets',                   'approval_status'),
    ('assets',                   'approved_at'),
    ('assets',                   'feedback_history'),
    ('assets',                   'marketing_metadata'),
    ('assets',                   'integrity_status'),
    ('assets',                   'deleted_at'),
    -- campaigns
    ('campaigns',                'id'),
    ('campaigns',                'user_id'),
    ('campaigns',                'project_id'),
    ('campaigns',                'source_execution_id'),
    ('campaigns',                'platform'),
    ('campaigns',                'name'),
    ('campaigns',                'external_campaign_id'),
    ('campaigns',                'status'),
    ('campaigns',                'daily_budget_brl'),
    ('campaigns',                'launched_at'),
    ('campaigns',                'paused_at'),
    -- performance_snapshots
    ('performance_snapshots',    'id'),
    ('performance_snapshots',    'campaign_id'),
    ('performance_snapshots',    'project_id'),
    ('performance_snapshots',    'snapshot_date'),
    ('performance_snapshots',    'spend_brl'),
    ('performance_snapshots',    'impressions'),
    ('performance_snapshots',    'clicks'),
    ('performance_snapshots',    'ctr'),
    ('performance_snapshots',    'cpc_brl'),
    ('performance_snapshots',    'cpm_brl'),
    ('performance_snapshots',    'conversions'),
    ('performance_snapshots',    'roas'),
    ('performance_snapshots',    'cpa_brl'),
    ('performance_snapshots',    'diagnosis'),
    -- notifications
    ('notifications',            'id'),
    ('notifications',            'user_id'),
    ('notifications',            'execution_id'),
    ('notifications',            'type'),
    ('notifications',            'title'),
    ('notifications',            'message'),
    ('notifications',            'read'),
    ('notifications',            'created_at'),
    -- knowledge_approval_queue
    ('knowledge_approval_queue', 'id'),
    ('knowledge_approval_queue', 'niche_id'),
    ('knowledge_approval_queue', 'execution_id'),
    ('knowledge_approval_queue', 'reviewed_by'),
    ('knowledge_approval_queue', 'memory_type'),
    ('knowledge_approval_queue', 'content'),
    ('knowledge_approval_queue', 'source_url'),
    ('knowledge_approval_queue', 'auto_score'),
    ('knowledge_approval_queue', 'auto_score_rationale'),
    ('knowledge_approval_queue', 'status'),
    ('knowledge_approval_queue', 'reviewed_at'),
    ('knowledge_approval_queue', 'created_at')
) AS expected(tablename, colname)
LEFT JOIN information_schema.columns c
  ON c.table_name   = expected.tablename
  AND c.column_name = expected.colname
  AND c.table_schema = 'public'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 6 — ÍNDICES
-- -------------------------------------------------------------

SELECT
  'INDEX' AS category,
  expected.indexname AS object_name,
  CASE WHEN i.indexname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('idx_user_credentials_user_id'),
    ('idx_user_credentials_service'),
    ('idx_niche_memory_niche_type'),
    ('idx_niche_memory_approved'),
    ('idx_niche_memory_confidence'),
    ('idx_pattern_intelligence_type_value'),
    ('idx_pattern_intelligence_confidence'),
    ('idx_products_user_id'),
    ('idx_products_niche_id'),
    ('idx_products_platform'),
    ('idx_templates_user_id'),
    ('idx_projects_user_id'),
    ('idx_projects_product_id'),
    ('idx_projects_updated_at'),
    ('idx_executions_project_id'),
    ('idx_executions_user_id'),
    ('idx_executions_status'),
    ('idx_executions_created_at'),
    ('idx_assets_project_id'),
    ('idx_assets_product_id'),
    ('idx_assets_execution_id'),
    ('idx_assets_type'),
    ('idx_assets_approved'),
    ('idx_assets_product_type_approved'),
    ('idx_campaigns_project_id'),
    ('idx_campaigns_user_id'),
    ('idx_campaigns_status'),
    ('idx_campaigns_platform'),
    ('idx_performance_campaign_date'),
    ('idx_performance_project_date'),
    ('idx_notifications_user_unread'),
    ('idx_notifications_user_all'),
    ('idx_knowledge_queue_niche_status'),
    ('idx_knowledge_queue_niche_score'),
    ('idx_knowledge_queue_execution')
) AS expected(indexname)
LEFT JOIN pg_indexes i
  ON i.indexname   = expected.indexname
  AND i.schemaname = 'public'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 7 — TRIGGERS
-- -------------------------------------------------------------

SELECT
  'TRIGGER' AS category,
  expected.tgname AS object_name,
  CASE WHEN t.tgname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('set_users_updated_at'),
    ('set_user_credentials_updated_at'),
    ('set_niches_updated_at'),
    ('set_niche_memory_updated_at'),
    ('set_pattern_intelligence_updated_at'),
    ('set_products_updated_at'),
    ('set_templates_updated_at'),
    ('set_projects_updated_at'),
    ('set_executions_updated_at'),
    ('set_assets_updated_at'),
    ('set_campaigns_updated_at')
) AS expected(tgname)
LEFT JOIN pg_trigger t
  ON t.tgname = expected.tgname
  AND NOT t.tgisinternal
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 8 — ROW LEVEL SECURITY (RLS habilitado)
-- -------------------------------------------------------------

SELECT
  'RLS_ENABLED' AS category,
  expected.tablename AS object_name,
  CASE WHEN c.relrowsecurity = TRUE THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('user_credentials'),
    ('niche_memory'),
    ('pattern_intelligence'),
    ('products'),
    ('templates'),
    ('projects'),
    ('executions'),
    ('assets'),
    ('campaigns'),
    ('notifications'),
    ('knowledge_approval_queue')
) AS expected(tablename)
LEFT JOIN pg_class c
  ON c.relname = expected.tablename
  AND c.relkind = 'r'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 9 — RLS POLICIES (nome das policies)
-- -------------------------------------------------------------

SELECT
  'RLS_POLICY' AS category,
  expected.policyname AS object_name,
  CASE WHEN p.policyname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('users_own_user_credentials'),
    ('authenticated_read_niche_memory'),
    ('service_role_write_niche_memory'),
    ('authenticated_read_pattern_intelligence'),
    ('service_role_write_pattern_intelligence'),
    ('users_own_products'),
    ('users_own_templates'),
    ('users_own_projects'),
    ('users_own_executions'),
    ('users_own_assets'),
    ('users_own_campaigns'),
    ('users_own_notifications'),
    ('authenticated_manage_knowledge_queue')
) AS expected(policyname)
LEFT JOIN pg_policies p
  ON p.policyname  = expected.policyname
  AND p.schemaname = 'public'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 10 — CONSTRAINTS UNIQUE CRÍTICAS
-- -------------------------------------------------------------

SELECT
  'UNIQUE_CONSTRAINT' AS category,
  expected.conname AS object_name,
  CASE WHEN c.conname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('users_email_key'),                         -- users.email UNIQUE
    ('user_credentials_user_id_key_name_key'),   -- UNIQUE(user_id, key_name)
    ('niches_name_key'),                         -- niches.name UNIQUE
    ('niches_slug_key'),                         -- niches.slug UNIQUE
    ('performance_snapshots_campaign_id_snapshot_date_key') -- UNIQUE(campaign_id, snapshot_date)
) AS expected(conname)
LEFT JOIN pg_constraint c
  ON c.conname = expected.conname
  AND c.contype = 'u'
ORDER BY object_name;


-- -------------------------------------------------------------
-- SEÇÃO 11 — RESUMO FINAL
-- -------------------------------------------------------------

WITH all_checks AS (
  -- Enums
  SELECT CASE WHEN t.typname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
  FROM (VALUES ('execution_status'),('asset_type'),('approval_status'),
               ('notification_type'),('knowledge_status'),('orchestrator_behavior')) AS e(typname)
  LEFT JOIN pg_type t ON t.typname = e.typname AND t.typtype = 'e'

  UNION ALL

  -- Tabelas
  SELECT CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END
  FROM (VALUES ('users'),('user_credentials'),('niches'),('niche_memory'),
               ('pattern_intelligence'),('products'),('templates'),('projects'),
               ('executions'),('assets'),('campaigns'),('performance_snapshots'),
               ('notifications'),('knowledge_approval_queue')) AS e(tablename)
  LEFT JOIN pg_tables t ON t.tablename = e.tablename AND t.schemaname = 'public'

  UNION ALL

  -- Função
  SELECT CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END
  FROM (VALUES ('update_updated_at')) AS e(proname)
  LEFT JOIN pg_proc p ON p.proname = e.proname
)
SELECT
  COUNT(*) FILTER (WHERE status = 'OK')      AS checks_passed,
  COUNT(*) FILTER (WHERE status = 'MISSING') AS checks_failed,
  COUNT(*)                                   AS total_checks,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'MISSING') = 0
    THEN '✓ Schema válido — todas as migrations aplicadas com sucesso'
    ELSE '✗ Schema incompleto — execute as migrations com status MISSING'
  END AS summary
FROM all_checks;
