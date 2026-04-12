// Polling loop principal dos workers.
// Regra 7: usa FOR UPDATE SKIP LOCKED para evitar concorrência entre instâncias.
// Regra 8: falha com retries esgotados → pipeline 'failed' + notificação.
// Fase 3.1

import * as dotenv from 'dotenv';
import * as path from 'path';
import { eq, sql } from 'drizzle-orm';
import { db } from './lib/db';
import { tasks, pipelines } from '../frontend/lib/schema/index';
import { seedNextTasks, isPipelineComplete, hasPipelineFailed } from './lib/seed-next-task';
import { BudgetExceededError } from './lib/llm/gemini-client';

// Agentes
import { runAvatarResearch }     from './agents/avatar-research';
import { runMarketResearch }     from './agents/market-research';
import { runAngleGenerator }     from './agents/angle-generator';
import { runCopyHookGenerator }  from './agents/copy-hook-generator';
import { runAnvisaCompliance }   from './agents/anvisa-compliance';
import { runNicheCurator }       from './agents/niche-curator';
import { runVideoMaker }         from './agents/video-maker';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Configuração ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;    // 5 segundos
const MAX_RETRIES      = 3;

type AgentName =
  | 'avatar_research'
  | 'market_research'
  | 'angle_generator'
  | 'copy_hook_generator'
  | 'anvisa_compliance'
  | 'video_maker'
  | 'niche_curator';

type AgentRunner = (task: TaskRow) => Promise<Record<string, unknown>>;

const AGENT_ROUTER: Record<AgentName, AgentRunner> = {
  avatar_research:     runAvatarResearch,
  market_research:     runMarketResearch,
  angle_generator:     runAngleGenerator,
  copy_hook_generator: runCopyHookGenerator,
  anvisa_compliance:   runAnvisaCompliance,
  niche_curator:       runNicheCurator,
  video_maker:         runVideoMaker,
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TaskRow {
  id:            string;
  pipeline_id:   string | null;
  agent_name:    string;
  mode:          string | null;
  depends_on:    string[];
  status:        string;
  input_context: Record<string, unknown> | null;
  output:        Record<string, unknown> | null;
  error:         string | null;
  retry_count:         number;
  started_at:          Date | null;
  completed_at:        Date | null;
  created_at:          Date;
  confirmed_oversized: boolean | null;
}

// ── Execução de task ──────────────────────────────────────────────────────────

async function executeTask(task: TaskRow): Promise<void> {
  const agentName = task.agent_name as AgentName;
  const runner    = AGENT_ROUTER[agentName];

  if (!runner) {
    throw new Error(`No runner found for agent: ${agentName}`);
  }

  const output = await runner(task);
  return output as any; // runner é responsável por persistir via writeArtifact
}

// ── Fluxo de uma iteração ─────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  // Captura o ID da task reclamada dentro da transação para evitar corrida entre workers.
  // O padrão anterior buscava "a task running mais recente", o que podia retornar a task
  // de outro worker quando dois processos iniciavam ao mesmo tempo.
  let claimedTaskId: string | null = null;

  await db.transaction(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT *
      FROM   tasks t
      WHERE  t.status = 'pending'
        AND  NOT EXISTS (
               SELECT 1 FROM tasks dep
               WHERE  dep.id::text = ANY(t.depends_on)
                 AND  dep.status  != 'completed'
             )
      ORDER BY t.created_at
      LIMIT  1
      FOR UPDATE SKIP LOCKED
    `);

    const task = (rows as unknown as TaskRow[])[0];
    if (!task) return; // Nada a fazer

    claimedTaskId = task.id;

    // Marca como running
    await tx
      .update(tasks)
      .set({ status: 'running', started_at: new Date() })
      .where(eq(tasks.id, task.id));
  });

  if (!claimedTaskId) return;

  // Busca a task específica que este worker reclamou (por ID, sem ambiguidade)
  const runningRows = await db.execute(sql`
    SELECT * FROM tasks WHERE id = ${claimedTaskId}
  `);
  const runningTask = (runningRows as unknown as TaskRow[])[0] ?? null;

  if (!runningTask) return;

  try {
    await executeTask(runningTask);

    // Sucesso: marca completed
    await db
      .update(tasks)
      .set({ status: 'completed', completed_at: new Date() })
      .where(eq(tasks.id, runningTask.id));


    // Propaga para tasks dependentes
    await seedNextTasks(runningTask.id, runningTask.pipeline_id);

    // Verifica se o pipeline inteiro foi concluído
    if (runningTask.pipeline_id) {
      const done   = await isPipelineComplete(runningTask.pipeline_id);
      const failed = await hasPipelineFailed(runningTask.pipeline_id);

      if (done) {
        await db
          .update(pipelines)
          .set({ status: 'completed', completed_at: new Date() })
          .where(eq(pipelines.id, runningTask.pipeline_id));
        console.info(`[task-runner] pipeline ${runningTask.pipeline_id} COMPLETED`);
      } else if (failed) {
        await db
          .update(pipelines)
          .set({ status: 'failed' })
          .where(eq(pipelines.id, runningTask.pipeline_id));
        console.info(`[task-runner] pipeline ${runningTask.pipeline_id} FAILED`);
      }
    }

  } catch (err: unknown) {
    const isRetriable = !(err instanceof BudgetExceededError);
    const retries     = (runningTask.retry_count ?? 0) + 1;
    const exhausted   = retries >= MAX_RETRIES;

    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[task-runner] task ${runningTask.id} failed (retry ${retries}/${MAX_RETRIES}): ${errMsg}`,
    );

    if (exhausted || !isRetriable) {
      // Falha definitiva
      await db
        .update(tasks)
        .set({
          status:      'failed',
          error:       errMsg,
          retry_count: retries,
          completed_at: new Date(),
        })
        .where(eq(tasks.id, runningTask.id));

      // Marca pipeline como failed
      if (runningTask.pipeline_id) {
        await db
          .update(pipelines)
          .set({ status: 'failed' })
          .where(eq(pipelines.id, runningTask.pipeline_id));
      }
    } else {
      // Volta para pending para retry
      await db
        .update(tasks)
        .set({
          status:      'pending',
          error:       errMsg,
          retry_count: retries,
          started_at:  null,
        })
        .where(eq(tasks.id, runningTask.id));
    }
  }
}

// ── Loop principal ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('[task-runner] starting — poll every', POLL_INTERVAL_MS, 'ms');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (err) {
      console.error('[task-runner] unhandled error in runOnce:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('[task-runner] fatal error:', err);
  process.exit(1);
});
