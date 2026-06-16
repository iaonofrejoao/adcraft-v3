// Cron diário do aggregator de learnings — Fase E (Sistema de Memória Cumulativa)
//
// Executa uma vez quando invocado; agendar via OS cron ou scheduler externo:
//   0 3 * * *  node /app/workers/dist/cron/learning-aggregator-cron.js
//
// Toda a lógica vive em workers/lib/learning-aggregator.ts (também usada pela API).

import * as dotenv from 'dotenv';
import * as path from 'path';
import { runLearningAggregator } from '../lib/learning-aggregator';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

runLearningAggregator()
  .then((r) => {
    console.info(
      `[cron] aggregator concluído — ` +
      `${r.groupsProcessed} grupos, ${r.patternsUpdated} patterns, ${r.insightsGenerated} insights`,
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('[cron] aggregator FATAL:', err);
    process.exit(1);
  });
