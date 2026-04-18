/**
 * scripts/pipeline/create.ts
 * Cria um pipeline + tasks no banco para um produto.
 *
 * Uso:
 *   npx tsx scripts/pipeline/create.ts --product-id <uuid> [--type full|pesquisa|criativo|lancamento]
 *
 * Output (stdout): pipeline_id (UUID)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { db } from '../../workers/lib/db';
import { pipelines, tasks, products } from '../../frontend/lib/schema/index';
import { eq } from 'drizzle-orm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// DAG completo do pipeline (espelha full-pipeline.yaml)
const FULL_DAG: Array<{ id: string; depends_on: string[] }> = [
  // Fase 1 — Pesquisa
  { id: 'vsl_analysis',         depends_on: [] },
  { id: 'market_research',      depends_on: [] },
  { id: 'avatar_research',      depends_on: [] },
  { id: 'benchmark_intelligence', depends_on: ['market_research'] },
  { id: 'angle_generator',      depends_on: ['vsl_analysis', 'market_research', 'avatar_research'] },
  { id: 'campaign_strategy',    depends_on: ['market_research', 'avatar_research', 'angle_generator', 'benchmark_intelligence'] },
  // Fase 2 — Criativo
  { id: 'script_writer',        depends_on: ['angle_generator', 'campaign_strategy'] },
  { id: 'copywriting',          depends_on: ['avatar_research', 'angle_generator', 'campaign_strategy'] },
  { id: 'character_generator',  depends_on: ['avatar_research'] },
  { id: 'keyframe_generator',   depends_on: ['script_writer', 'character_generator'] },
  { id: 'video_maker',          depends_on: ['script_writer', 'copywriting', 'keyframe_generator'] },
  { id: 'creative_director',    depends_on: ['copywriting', 'video_maker'] },
  // Fase 3 — Lançamento
  { id: 'compliance_check',     depends_on: ['copywriting', 'creative_director'] },
  { id: 'utm_builder',          depends_on: ['campaign_strategy'] },
  { id: 'facebook_ads',         depends_on: ['compliance_check', 'utm_builder'] },
  { id: 'google_ads',           depends_on: ['compliance_check', 'utm_builder'] },
  { id: 'performance_analysis', depends_on: ['facebook_ads', 'google_ads'] },
  { id: 'scaling_strategy',     depends_on: ['performance_analysis'] },
];

const PHASE_AGENTS: Record<string, string[]> = {
  pesquisa:  ['vsl_analysis', 'market_research', 'avatar_research', 'benchmark_intelligence', 'angle_generator', 'campaign_strategy'],
  criativo:  ['script_writer', 'copywriting', 'character_generator', 'keyframe_generator', 'video_maker', 'creative_director'],
  lancamento: ['compliance_check', 'utm_builder', 'facebook_ads', 'google_ads', 'performance_analysis', 'scaling_strategy'],
};

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id': { type: 'string' },
      'type':       { type: 'string', default: 'full' },
    },
  });

  const productId = values['product-id'];
  const pipelineType = (values['type'] as string) || 'full';

  if (!productId) {
    console.error('Erro: --product-id é obrigatório');
    process.exit(1);
  }

  // Busca o produto para obter version, niche_id e budget
  const [product] = await db.select().from(products).where(eq(products.id, productId as any));
  if (!product) {
    console.error(`Erro: produto ${productId} não encontrado`);
    process.exit(1);
  }

  // Determina quais agentes incluir
  let agentIds: string[];
  if (pipelineType === 'full') {
    agentIds = FULL_DAG.map(a => a.id);
  } else if (PHASE_AGENTS[pipelineType]) {
    agentIds = PHASE_AGENTS[pipelineType];
  } else {
    console.error(`Tipo inválido: ${pipelineType}. Use: full | pesquisa | criativo | lancamento`);
    process.exit(1);
  }

  const pipelineId = randomUUID();

  // Cria tasks com UUIDs conhecidos para resolver depends_on
  const taskIdMap: Record<string, string> = {};
  for (const agent of agentIds) {
    taskIdMap[agent] = randomUUID();
  }

  await db.transaction(async (tx) => {
    // Cria pipeline
    await tx.insert(pipelines).values({
      id: pipelineId as any,
      user_id: (product as any).user_id,
      product_id: productId as any,
      goal: pipelineType as any,
      deliverable_agent: agentIds[agentIds.length - 1],
      plan: { type: pipelineType, agents: agentIds } as any,
      status: 'pending',
      product_version: (product as any).version ?? 1,
      budget_usd: 0,
    });

    // Cria tasks
    for (const agentId of agentIds) {
      const taskDef = FULL_DAG.find(a => a.id === agentId)!;
      // Filtra depends_on para apenas os agentes incluídos neste pipeline
      const resolvedDeps = taskDef.depends_on
        .filter(dep => agentIds.includes(dep))
        .map(dep => taskIdMap[dep]);

      const status = resolvedDeps.length === 0 ? 'pending' : 'waiting';

      await tx.insert(tasks).values({
        id: taskIdMap[agentId] as any,
        pipeline_id: pipelineId as any,
        agent_name: agentId,
        depends_on: resolvedDeps,
        status,
        retry_count: 0,
      });
    }
  });

  // Retorna o pipeline_id para uso do orquestrador
  console.log(pipelineId);
  process.exit(0);
}

main().catch(err => {
  console.error('[create-pipeline] erro:', err);
  process.exit(1);
});
