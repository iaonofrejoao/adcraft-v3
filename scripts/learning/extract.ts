/**
 * scripts/learning/extract.ts
 * Dispara o learning-extractor para um pipeline concluído.
 * Chamado pelo orquestrador após o pipeline completo.
 *
 * Uso:
 *   npx tsx scripts/learning/extract.ts --pipeline-id <uuid>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { extractLearningsAsync } from '../../workers/agents/learning-extractor';

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

  console.log(`[learning-extract] iniciando extração para pipeline ${pipelineId}...`);
  await extractLearningsAsync(pipelineId);
  console.log(`[learning-extract] concluído`);
  process.exit(0);
}

main().catch(err => {
  console.error('[learning-extract] erro:', err);
  process.exit(1);
});
