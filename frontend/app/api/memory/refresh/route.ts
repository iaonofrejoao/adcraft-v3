// POST /api/memory/refresh
// Dispara manualmente o ciclo de embeddings + aggregation de learnings.
// Usado pelo botão "Processar Memória" na tela /insights.
//
// Retorna:
//   { embeddingsGenerated, patternsUpdated, insightsGenerated, groupsProcessed }

import { NextResponse } from 'next/server';
import { batchEmbeddingsWorker } from '../../../../../workers/lib/embeddings/gemini-embeddings';
import { runLearningAggregator }  from '../../../../../workers/lib/learning-aggregator';

export async function POST() {
  try {
    // 1. Processa fila de embeddings pendentes
    const embeddingsGenerated = await batchEmbeddingsWorker();

    // 2. Roda aggregation (patterns + insights)
    const { patternsUpdated, insightsGenerated, groupsProcessed } =
      await runLearningAggregator();

    return NextResponse.json({
      ok: true,
      embeddingsGenerated,
      patternsUpdated,
      insightsGenerated,
      groupsProcessed,
    });
  } catch (err) {
    console.error('[POST /api/memory/refresh]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
