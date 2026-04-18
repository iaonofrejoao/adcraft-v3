/**
 * scripts/artifact/save.ts
 * Salva um artefato em product_knowledge e enfileira embedding.
 *
 * Uso:
 *   npx tsx scripts/artifact/save.ts \
 *     --pipeline-id <uuid> \
 *     --task-id <uuid> \
 *     --type <artifact_type> \
 *     --data '<json>'
 *
 * Output (stdout): artifact_id (UUID)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from '../../workers/lib/db';
import { pipelines } from '../../frontend/lib/schema/index';
import { saveArtifact } from '../../workers/lib/knowledge';
import type { ArtifactType } from '../../frontend/lib/agent-registry';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'pipeline-id': { type: 'string' },
      'task-id':     { type: 'string' },
      'type':        { type: 'string' },
      'data':        { type: 'string' },
    },
  });

  const pipelineId = values['pipeline-id'];
  const taskId     = values['task-id'];
  const type       = values['type'] as ArtifactType;
  const dataStr    = values['data'];

  if (!pipelineId || !taskId || !type || !dataStr) {
    console.error('Erro: --pipeline-id, --task-id, --type e --data são obrigatórios');
    process.exit(1);
  }

  let artifactData: Record<string, unknown>;
  try {
    artifactData = JSON.parse(dataStr);
  } catch {
    console.error('Erro: --data deve ser um JSON válido');
    process.exit(1);
  }

  // Busca versão do produto a partir do pipeline
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId as any));
  if (!pipeline) {
    console.error(`Pipeline ${pipelineId} não encontrado`);
    process.exit(1);
  }

  const artifactId = await saveArtifact({
    product_id:        pipeline.product_id as string,
    product_version:   pipeline.product_version,
    artifact_type:     type,
    artifact_data:     artifactData,
    source_pipeline_id: pipelineId,
    source_task_id:    taskId,
  });

  console.log(artifactId);
  process.exit(0);
}

main().catch(err => {
  console.error('[save-artifact] erro:', err);
  process.exit(1);
});
