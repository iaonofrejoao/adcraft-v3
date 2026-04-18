/**
 * scripts/artifact/save-from-file.ts
 * Salva um artefato lendo o JSON de um arquivo (evita limitação de tamanho do CLI).
 *
 * Uso:
 *   npx tsx scripts/artifact/save-from-file.ts \
 *     --pipeline-id <uuid> \
 *     --task-id <uuid> \
 *     --type <artifact_type> \
 *     --file <path_to_json_file>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
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
      'file':        { type: 'string' },
    },
  });

  const pipelineId = values['pipeline-id'];
  const taskId     = values['task-id'];
  const type       = values['type'] as ArtifactType;
  const filePath   = values['file'];

  if (!pipelineId || !taskId || !type || !filePath) {
    console.error('Erro: --pipeline-id, --task-id, --type e --file são obrigatórios');
    process.exit(1);
  }

  let artifactData: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    artifactData = JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler/parsear arquivo JSON:', e);
    process.exit(1);
  }

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
  console.error('[save-artifact-from-file] erro:', err);
  process.exit(1);
});
