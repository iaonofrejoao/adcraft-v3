/**
 * scripts/artifact/get.ts
 * Busca o artefato 'fresh' mais recente de um produto pelo tipo.
 *
 * Uso:
 *   npx tsx scripts/artifact/get.ts --pipeline-id <uuid> --type <artifact_type>
 *
 * Output (stdout): JSON do artifact_data
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
    options: {
      'pipeline-id': { type: 'string' },
      'type':        { type: 'string' },
    },
  });

  const pipelineId = values['pipeline-id'];
  const type       = values['type'];

  if (!pipelineId || !type) {
    console.error('Erro: --pipeline-id e --type são obrigatórios');
    process.exit(1);
  }

  const rows = await db.execute(sql`
    SELECT pk.artifact_data
    FROM   product_knowledge pk
    JOIN   pipelines p ON p.product_id = pk.product_id
    WHERE  p.id            = ${pipelineId}
      AND  pk.artifact_type = ${type}
      AND  pk.status        = 'fresh'
    ORDER BY pk.created_at DESC
    LIMIT 1
  `);

  const row = (rows as any[])[0];
  if (!row) {
    console.error(`Artefato '${type}' não encontrado para o pipeline ${pipelineId}`);
    process.exit(1);
  }

  console.log(JSON.stringify(row.artifact_data, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('[get-artifact] erro:', err);
  process.exit(1);
});
