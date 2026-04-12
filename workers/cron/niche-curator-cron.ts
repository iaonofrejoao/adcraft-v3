// Cron diário do niche_curator.
// Executa uma vez quando invocado; agendar via OS cron ou scheduler externo:
//   0 2 * * *  node /app/workers/dist/cron/niche-curator-cron.js
//
// Lógica:
//   1. Encontra nichos com sinais de aprovação/rejeição recentes (últimas 48h)
//      OU que nunca tiveram curadoria rodada
//   2. Para cada nicho elegível, insere task `niche_curator` na tabela `tasks`
//      (pipeline_id = NULL — maintenance task, sem pipeline)
//   3. O task-runner (Fase 3.1) pega e executa o agente niche_curator
//
// PRD seção 7.2 | Fase 2.7.4

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Janela de lookback para sinais recentes
const SIGNAL_LOOKBACK_HOURS = 48;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface EligibleNiche {
  niche_id: string;
  niche_name: string;
  recent_signals: number;
  last_curated_at: string | null;
}

// ── Busca nichos elegíveis ────────────────────────────────────────────────────

/**
 * Retorna nichos que têm sinais de aprovação/rejeição recentes e ainda não
 * têm uma task de niche_curator pendente ou em progresso para o mesmo niche.
 */
async function findEligibleNiches(): Promise<EligibleNiche[]> {
  const rows = await db.execute(sql`
    SELECT
      p.niche_id,
      n.name AS niche_name,
      COUNT(cc.id)::int AS recent_signals,
      MAX(nl.last_reinforced_at)::text AS last_curated_at
    FROM products p
    JOIN niches n ON n.id = p.niche_id
    JOIN pipelines pip ON pip.product_id = p.id
    JOIN copy_components cc ON cc.pipeline_id = pip.id
    LEFT JOIN niche_learnings nl
      ON nl.niche_id = p.niche_id AND nl.status = 'active'
    WHERE
      cc.approval_status IN ('approved', 'rejected')
      AND cc.approved_at >= NOW() - INTERVAL '${sql.raw(String(SIGNAL_LOOKBACK_HOURS))} hours'
      -- Não enfileirar se já há task pendente/em progresso para este nicho
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.agent_name = 'niche_curator'
          AND t.status IN ('pending', 'running')
          AND t.input_context->>'niche_id' = p.niche_id::text
      )
    GROUP BY p.niche_id, n.name
    HAVING COUNT(cc.id) > 0
  `);

  return rows as unknown as EligibleNiche[];
}

// ── Enfileira task de curadoria ───────────────────────────────────────────────

/**
 * Insere uma task `niche_curator` para o nicho informado.
 * pipeline_id = NULL porque é uma maintenance task fora de pipeline de produto.
 */
async function enqueueCuratorTask(niche: EligibleNiche): Promise<string> {
  const taskId = randomUUID();

  await db.execute(sql`
    INSERT INTO tasks (
      id, pipeline_id, agent_name, mode, depends_on,
      status, input_context, created_at
    ) VALUES (
      ${taskId},
      NULL,
      'niche_curator',
      'daily_curation',
      '{}',
      'pending',
      ${JSON.stringify({
        niche_id:        niche.niche_id,
        niche_name:      niche.niche_name,
        triggered_by:    'daily_cron',
        signal_lookback_hours: SIGNAL_LOOKBACK_HOURS,
        recent_signals:  niche.recent_signals,
        last_curated_at: niche.last_curated_at,
      })}::jsonb,
      NOW()
    )
  `);

  return taskId;
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.info(`[niche-curator-cron] starting — ${new Date().toISOString()}`);

  let niches: EligibleNiche[];
  try {
    niches = await findEligibleNiches();
  } catch (err) {
    console.error('[niche-curator-cron] failed to query eligible niches:', err);
    process.exit(1);
  }

  if (niches.length === 0) {
    process.exit(0);
  }

  let enqueued = 0;
  for (const niche of niches) {
    try {
      await enqueueCuratorTask(niche);
      enqueued++;
    } catch (err) {
      console.error(`[niche-curator-cron] failed to enqueue task for niche ${niche.niche_id}:`, err);
    }
  }

  console.info(`[niche-curator-cron] done — ${enqueued}/${niches.length} tasks enqueued`);
  process.exit(0);
}

run();
