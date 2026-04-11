import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { pipelines, products } from '../../frontend/lib/schema/index';
import { buildContext, serializeContext } from '../lib/context-builder';
import { callAgent } from '../lib/llm/gemini-client';
import { saveArtifact } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';

/**
 * Agente 3.5 — Market Research
 * Avalia a viabilidade do produto no mercado.
 */
export async function runMarketResearch(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id is required for market_research');

    // 1. Busca meta-dados
    const pipeline = await (db.query as any).pipelines.findFirst({
        where: eq(pipelines.id, pipelineId)
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const product = await (db.query as any).products.findFirst({
        where: eq(products.id, pipeline.product_id as string)
    });
    if (!product) throw new Error(`Product ${pipeline.product_id} not found`);

    // 2. Build Context
    const ctx = await buildContext(
        'market_research',
        product.id as string,
        pipelineId,
        {
            niche_id: product.niche_id as string,
            niche_slug: (product as any).slug || 'global'
        }
    );

    // 3. User Message (portado de market_researcher.py)
    const product_context = ctx.context_json.product as any || {};

    const dynamicInput = `Faça a pesquisa de mercado para este produto e gere o laudo de viabilidade.
Produto: ${product.name}
Nicho Principal: ${product.niche_id}
Ticket de Venda Estimado: R$${product.ticket_price || 0.0}
Comissão: ${product.commission_percent || 0.0}%
Promessa Principal identificada antes: "${product_context.main_promise || 'Promessa não identificada'}"

${serializeContext(ctx)}

Calcule a margem e busque o volume de concorrências. Se a margem for baixa ou a concorrência esmagadora, considere not_viable. Redija o JSON requerido.`;

    // 4. Chamada LLM
    const result = await callAgent({
        agent_name: 'market_research',
        pipeline_id: pipelineId,
        product_id: product.id as string,
        niche_id: product.niche_id as string,
        niche_slug: (product as any).slug || 'global',
        dynamic_input: dynamicInput,
    });

    // 5. Persistência
    const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;

    await saveArtifact({
        product_id: product.id as string,
        product_version: pipeline.product_version,
        artifact_type: 'market',
        artifact_data: output,
        source_pipeline_id: pipelineId,
        source_task_id: task.id,
    });

    return output;
}
