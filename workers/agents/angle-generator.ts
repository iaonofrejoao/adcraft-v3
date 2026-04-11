import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { pipelines, products } from '../../frontend/lib/schema/index';
import { buildContext, serializeContext } from '../lib/context-builder';
import { callAgent } from '../lib/llm/gemini-client';
import { saveArtifact } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';

/**
 * Agente 3.6 — Angle Generator
 * Define o posicionamento e o "Mecanismo Único" (USP).
 */
export async function runAngleGenerator(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id is required for angle_generator');

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
        'angle_generator',
        product.id as string,
        pipelineId,
        {
            niche_id: product.niche_id as string,
            niche_slug: (product as any).slug || 'global'
        }
    );

    // 3. User Message (portado de angle_strategist.py)
    const product_context = ctx.context_json.product as any || {};
    const persona_context = ctx.context_json.avatar as any || {};
    const market_context = ctx.context_json.market as any || {};

    const dynamicInput = `Posicione e crie o ângulo campeão para este produto: "${product.name}"

[Contexto do Produto]:
Promessa: ${product_context.main_promise || 'N/A'}
Objeções quebradas internamente: ${JSON.stringify(product_context.objections_broken || [])}

[Contexto de Mercado]:
Nível de competição: ${market_context.competition_level || 'medium'}
Anúncios rodando: ${market_context.ads_running_count || 0}

[Contexto da Persona]:
Resumo: ${persona_context.summary || ''}
Dor principal: "${persona_context.psychographic?.primary_pain || ''}"
Objeções: ${JSON.stringify(persona_context.psychographic?.objections || [])}
Expressões Reais: ${JSON.stringify(persona_context.verbatim_expressions || [])}

${serializeContext(ctx)}

Encontre O mecanismo ou ângulo de fora para dentro de alta conversão. Formule 3 bons hooks iniciais em formato de script de fala conforme JSON requerido.`;

    // 4. Chamada LLM
    const result = await callAgent({
        agent_name: 'angle_generator',
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
        artifact_type: 'angles',
        artifact_data: output,
        source_pipeline_id: pipelineId,
        source_task_id: task.id,
    });

    return output;
}
