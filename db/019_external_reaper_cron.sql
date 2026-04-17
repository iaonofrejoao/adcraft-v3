-- Migration 019: Reaper externo via pg_cron
--
-- Problema: o reaper in-process (task-runner.ts) só roda quando o worker está UP.
-- Se o worker crasha (ex: erro de sintaxe em TypeScript, crash de processo, deploy),
-- tasks ficam presas em 'running' para sempre — "demandas zumbi".
--
-- Solução: instalar um pg_cron job no próprio Postgres que reap tasks stuck
-- independentemente do worker. Roda a cada 5 minutos, sem depender de nenhum processo.
--
-- Requisito: extensão pg_cron ativa no Supabase (habilitada por padrão nos planos pagos).
-- Para verificar: SELECT * FROM cron.job;
-- Para remover: SELECT cron.unschedule('adcraft-reap-stuck-tasks');

-- ── 1. Função de reaper ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reap_stuck_tasks()
RETURNS TABLE(reaped_task_id uuid, pipeline_id uuid, agent_name text, stuck_minutes numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reaper_interval INTERVAL := '15 minutes';
BEGIN
  -- Reap tasks stuck in 'running' for more than reaper_interval
  RETURN QUERY
  WITH reaped AS (
    UPDATE tasks t
    SET
      status       = 'failed',
      error        = 'Reaped by external pg_cron: running for more than 15 minutes without completion',
      completed_at = NOW()
    WHERE t.status     = 'running'
      AND t.started_at < NOW() - reaper_interval
    RETURNING t.id, t.pipeline_id, t.agent_name, t.started_at
  ),
  pipeline_update AS (
    -- Marca pipelines afetados como failed (só se ainda em pending/running)
    UPDATE pipelines p
    SET status = 'failed'
    FROM reaped r
    WHERE p.id     = r.pipeline_id
      AND p.status IN ('pending', 'running')
    RETURNING p.id
  )
  SELECT
    r.id                                           AS reaped_task_id,
    r.pipeline_id                                  AS pipeline_id,
    r.agent_name                                   AS agent_name,
    ROUND(EXTRACT(EPOCH FROM (NOW() - r.started_at)) / 60, 1) AS stuck_minutes
  FROM reaped r;
END;
$$;

-- ── 2. Agendar o pg_cron job ──────────────────────────────────────────────────
-- Roda a cada 5 minutos. O job é idempotente — execuções overlap não causam
-- duplo-reap porque o WHERE status='running' é exclusivo.

DO $$
BEGIN
  -- Remove job anterior se existir (permite re-run idempotente da migration)
  BEGIN
    PERFORM cron.unschedule('adcraft-reap-stuck-tasks');
  EXCEPTION WHEN OTHERS THEN
    -- cron.unschedule lança exceção se job não existe — ignorar
    NULL;
  END;

  -- Cria o job
  PERFORM cron.schedule(
    'adcraft-reap-stuck-tasks',
    '*/5 * * * *',
    $job$
      SELECT reaped_task_id, pipeline_id, agent_name, stuck_minutes
      FROM reap_stuck_tasks()
    $job$
  );
END;
$$;

-- ── 3. Comentário informativo ─────────────────────────────────────────────────

COMMENT ON FUNCTION reap_stuck_tasks() IS
  'Reaper externo: mata tasks presas em running por mais de 15 minutos. '
  'Chamado pelo pg_cron a cada 5 minutos independente do worker Node.js. '
  'Previne demandas zumbi quando o worker crasha.';
