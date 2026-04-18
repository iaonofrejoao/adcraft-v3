#!/usr/bin/env tsx
/**
 * Dispara um ciclo do batchEmbeddingsWorker manualmente.
 * Processa até 100 linhas pendentes na tabela `embeddings` (embedding IS NULL).
 *
 * Uso: npx tsx scripts/embeddings/run-batch.ts [--loops N]
 *   --loops N  número de ciclos a executar (default: 1, use 0 para rodar até esvaziar a fila)
 */
import { batchEmbeddingsWorker } from '../../workers/lib/embeddings/gemini-embeddings';

const args   = process.argv.slice(2);
const loops  = parseInt(args[args.indexOf('--loops') + 1] ?? '1', 10);
const runAll = loops === 0;

async function main() {
  let cycle = 0;
  let total = 0;

  while (true) {
    cycle++;
    console.log(`\n[cycle ${cycle}] Iniciando batch de embeddings…`);
    const written = await batchEmbeddingsWorker();
    total += written;
    console.log(`[cycle ${cycle}] ${written} embeddings gerados (total: ${total})`);

    if (written === 0) {
      console.log('[done] Fila vazia.');
      break;
    }

    if (!runAll && cycle >= loops) {
      console.log(`[done] ${loops} ciclo(s) executado(s).`);
      break;
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
