/**
 * scripts/pipeline/complete-task.ts
 * Marca uma task como completed e propaga para tasks dependentes.
 *
 * Uso:
 *   npx tsx scripts/pipeline/complete-task.ts --task-id <uuid> [--output '<json>']
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from '../../workers/lib/db';
import { tasks } from '../../frontend/lib/schema/index';
import { seedNextTasks } from '../../workers/lib/seed-next-task';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'task-id': { type: 'string' },
      'output':  { type: 'string' },
    },
  });

  const taskId = values['task-id'];
  if (!taskId) {
    console.error('Erro: --task-id é obrigatório');
    process.exit(1);
  }

  const output = values['output'] ? JSON.parse(values['output']) : null;

  // Busca a task para obter pipeline_id
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId as any));
  if (!task) {
    console.error(`Task ${taskId} não encontrada`);
    process.exit(1);
  }

  // Marca como completed
  await db.update(tasks).set({
    status: 'completed',
    completed_at: new Date(),
    ...(output ? { output } : {}),
  }).where(eq(tasks.id, taskId as any));

  // Propaga para tasks dependentes
  const promoted = await seedNextTasks(taskId, task.pipeline_id);

  console.log(`✅ Task ${task.agent_name} marcada como completed`);
  if (promoted.length > 0) {
    console.log(`   → ${promoted.length} task(s) desbloqueada(s): ${promoted.join(', ')}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[complete-task] erro:', err);
  process.exit(1);
});
