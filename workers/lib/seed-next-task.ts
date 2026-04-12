// Promove tarefas 'waiting' → 'pending' quando todas as suas dependências
// estão com status 'completed'.
// Chamado pelo task-runner após cada task concluída.
// Fase 3.3

import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { tasks } from '../../frontend/lib/schema/index';

/**
 * Após a conclusão de uma task, verifica quais tarefas do mesmo pipeline
 * estavam esperando por ela (depends_on contém completedTaskId).
 *
 * Para cada candidata, verifica se TODAS as suas deps estão completed.
 * Se sim, promove o status de 'waiting' para 'pending'.
 *
 * @param completedTaskId  - UUID da task recém-concluída (string)
 * @param pipelineId       - UUID do pipeline (null para maintenance tasks)
 */
export async function seedNextTasks(
  completedTaskId: string,
  pipelineId: string | null,
): Promise<string[]> {
  if (!pipelineId) {
    // Tasks de manutenção (ex: niche_curator) não têm pipeline — nada a propagar
    return [];
  }

  // Usa SQL raw para a lógica de array PostgreSQL de forma eficiente
  const promoted = await db.execute<{ id: string }>(sql`
    UPDATE tasks
    SET status = 'pending'
    WHERE pipeline_id    = ${pipelineId}
      AND status         = 'waiting'
      AND ${completedTaskId} = ANY(depends_on)
      -- Só promove se TODAS as dependências estão completed
      AND NOT EXISTS (
        SELECT 1
        FROM   tasks dep
        WHERE  dep.id::text = ANY(tasks.depends_on)
          AND  dep.status  != 'completed'
      )
    RETURNING id
  `);

  const ids = (promoted as Array<{ id: string }>).map((r) => r.id);
  return ids;
}

/**
 * Verifica se todas as tasks de um pipeline estão completed.
 * Usado pelo task-runner para marcar o pipeline como concluído.
 */
export async function isPipelineComplete(pipelineId: string): Promise<boolean> {
  const rows = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text AS cnt
    FROM   tasks
    WHERE  pipeline_id = ${pipelineId}
      AND  status     != 'completed'
  `);
  const cnt = parseInt((rows as Array<{ cnt: string }>)[0]?.cnt ?? '0', 10);
  return cnt === 0;
}

/**
 * Verifica se o pipeline falhou definitivamente (alguma task em 'failed'
 * que não tem mais retries disponíveis).
 */
export async function hasPipelineFailed(pipelineId: string): Promise<boolean> {
  const rows = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text AS cnt
    FROM   tasks
    WHERE  pipeline_id = ${pipelineId}
      AND  status      = 'failed'
  `);
  const cnt = parseInt((rows as Array<{ cnt: string }>)[0]?.cnt ?? '0', 10);
  return cnt > 0;
}
