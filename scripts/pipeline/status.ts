/**
 * scripts/pipeline/status.ts
 * Mostra o status atual de todas as tasks de um pipeline.
 *
 * Uso:
 *   npx tsx scripts/pipeline/status.ts --pipeline-id <uuid>
 *
 * Output: tabela de tasks com status, agente, duração e erros
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { db } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { 'pipeline-id': { type: 'string' } },
  });

  const pipelineId = values['pipeline-id'];
  if (!pipelineId) {
    console.error('Erro: --pipeline-id é obrigatório');
    process.exit(1);
  }

  const rows = await db.execute(sql`
    SELECT
      t.agent_name,
      t.status,
      t.retry_count,
      t.started_at,
      t.completed_at,
      CASE
        WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at))::int || 's'
        WHEN t.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - t.started_at))::int || 's (running)'
        ELSE '-'
      END AS duration,
      t.error,
      t.id AS task_id
    FROM tasks t
    WHERE t.pipeline_id = ${pipelineId}
    ORDER BY t.created_at
  `);

  const pipeline = await db.execute(sql`
    SELECT status, goal, product_id, created_at, completed_at
    FROM pipelines WHERE id = ${pipelineId}
  `);

  const p = (pipeline as any[])[0];
  if (!p) {
    console.error(`Pipeline ${pipelineId} não encontrado`);
    process.exit(1);
  }

  console.log('\n═══ PIPELINE STATUS ═══════════════════════════════════════');
  console.log(`ID:        ${pipelineId}`);
  console.log(`Status:    ${p.status}`);
  console.log(`Tipo:      ${p.goal}`);
  console.log(`Criado em: ${p.created_at}`);
  if (p.completed_at) console.log(`Concluído: ${p.completed_at}`);
  console.log('');
  console.log('AGENTE                    STATUS       DURAÇÃO  RETRIES  TASK_ID');
  console.log('─'.repeat(95));

  for (const row of rows as any[]) {
    const statusIcon = {
      completed: '✅',
      failed:    '❌',
      running:   '🔄',
      pending:   '⏳',
      waiting:   '🔒',
      skipped:   '⏭️',
    }[row.status] ?? '❓';

    const agentPadded = row.agent_name.padEnd(25);
    const statusPadded = `${statusIcon} ${row.status}`.padEnd(14);
    const durationPadded = String(row.duration).padEnd(8);
    const retries = String(row.retry_count).padEnd(8);
    console.log(`${agentPadded} ${statusPadded} ${durationPadded} ${retries} ${row.task_id}`);

    if (row.error) {
      console.log(`  ↳ Erro: ${row.error}`);
    }
  }

  const total = (rows as any[]).length;
  const done = (rows as any[]).filter(r => r.status === 'completed' || r.status === 'skipped').length;
  const failed = (rows as any[]).filter(r => r.status === 'failed').length;
  console.log('─'.repeat(95));
  console.log(`Total: ${done}/${total} concluídos${failed > 0 ? `, ${failed} com falha` : ''}`);
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('[pipeline-status] erro:', err);
  process.exit(1);
});
