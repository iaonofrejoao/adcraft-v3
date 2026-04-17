import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { pipelines, products } from '../../frontend/lib/schema/index';
import { buildContext, serializeContext } from '../lib/context-builder';
import { callAgent } from '../lib/llm/gemini-client';
import { saveArtifact } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';

/**
 * Agente 3.4 — Avatar Research
 * Constrói a persona e psicografia profunda.
 */
export async function runAvatarResearch(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id is required for avatar_research');

    // 1. Busca meta-dados do pipeline e produto
    const pipeline = await (db.query as any).pipelines.findFirst({
        where: eq(pipelines.id, pipelineId),
        with: {
            // Drizzle relations se configuradas, caso contrário fazemos manual
        }
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const product = await (db.query as any).products.findFirst({
        where: eq(products.id, pipeline.product_id as string)
    });
    if (!product) throw new Error(`Product ${pipeline.product_id} not found`);

    // 2. Build Context
    const ctx = await buildContext(
        'avatar_research',
        product.id as string,
        pipelineId,
        {
            niche_id: product.niche_id as string,
            niche_slug: (product as any).slug || 'global'
        }
    );

    // 3. User Message (portado de persona_builder.py)
    const product_context = ctx.context_json.product as any || {};
    const market_context = ctx.context_json.market as any || {};

    const dynamicInput = `O produto chama-se "${product.name}" (Nicho: ${product.niche_id}).
País alvo: ${(product as any).target_country || 'BR'}
Idioma: ${product.target_language || 'pt-BR'}
Promessa Principal detectada: "${product_context.main_promise || 'Sem promessa'}"
Descrição inicial: "${product_context.avatar_description || ''}"
Dores listadas: ${JSON.stringify(product_context.pain_points_identified || [])}
Nível de competição: ${market_context.competition_level || 'medium'}

${serializeContext(ctx)}

Realize buscas via ferramenta para cavar o psicológico da persona. Sintetize quem é conforme o formato JSON requerido.
IMPORTANTE: A persona deve ser construída com referências culturais, expressões, dores e aspirações específicas do país "${(product as any).target_country || 'BR'}" no idioma "${product.target_language || 'pt-BR'}".`;

    // 4. Chamada LLM
    const result = await callAgent({
        agent_name: 'avatar_research',
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
        artifact_type: 'avatar',
        artifact_data: output,
        source_pipeline_id: pipelineId,
        source_task_id: task.id,
    });

    return output;
}
