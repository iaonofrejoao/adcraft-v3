import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { pipelines, products } from '../../frontend/lib/schema/index';
import { buildContext, serializeContext } from '../lib/context-builder';
import { callAgent } from '../lib/llm/gemini-client';
import { saveCopyComponents, type CopyComponentInput } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';
import { type CopyMode } from '../../frontend/lib/agent-registry';
import { buildHookTag, buildBodyTag, buildCtaTag } from '../lib/tagging';

/**
 * Agente 3.7 — Copy Hook Generator
 * Gera 3 variações de Hooks, Bodies e CTAs.
 */
export async function runCopyHookGenerator(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id is required for copy_hook_generator');

    // 1. Busca meta-dados
    const pipeline = await (db.query as any).pipelines.findFirst({
        where: eq(pipelines.id, pipelineId)
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const product = await (db.query as any).products.findFirst({
        where: eq(products.id, pipeline.product_id as string)
    });
    if (!product) throw new Error(`Product ${pipeline.product_id} not found`);

    const sku = (product as any).sku || 'XXXX';
    const version = pipeline.product_version;
    const mode = (task.mode as CopyMode) || 'full';

    // 2. Build Context
    const ctx = await buildContext(
        'copy_hook_generator',
        product.id as string,
        pipelineId,
        {
            niche_id: product.niche_id as string,
            niche_slug: (product as any).slug || 'global'
        }
    );

    // 3. User Message
    const product_context = ctx.context_json.product as any || {};
    const persona_context = ctx.context_json.avatar as any || {};
    const angle_context = ctx.context_json.angles as any || {};

    const dynamicInput = `Produza as variações de Copy para rodar conforme as diretrizes abaixo.

[MODO ATIVO]: ${mode}

[Contexto do Produto]:
Produto: ${product.name}
País alvo: ${(product as any).target_country || 'BR'}
Língua: ${product.target_language || 'pt-BR'}
Ângulo a seguir: ${angle_context.primary_angle || 'N/A'}

[Contexto da Persona]:
Resumo: ${persona_context.summary || ''}
Expressões do Publico (OBRIGATÓRIO USAR NAS BODIES): ${JSON.stringify(persona_context.verbatim_expressions || [])}

${serializeContext(ctx)}

Crie variações esmagadoras e textos instintivos. Retorne o JSON seguindo exatamente a estrutura para o modo "${mode}".`;

    // 4. Chamada LLM
    const result = await callAgent({
        agent_name: 'copy_hook_generator',
        pipeline_id: pipelineId,
        product_id: product.id as string,
        niche_id: product.niche_id as string,
        niche_slug: (product as any).slug || 'global',
        dynamic_input: dynamicInput,
        mode: mode,
    });

    // 5. Mapeamento e Persistência
    const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
    const components: CopyComponentInput[] = [];

    // Hooks
    if (output.hooks && Array.isArray(output.hooks)) {
        output.hooks.forEach((h: any, i: number) => {
            const slot = i + 1;
            components.push({
                component_type: 'hook',
                slot_number: slot,
                tag: buildHookTag(sku, version, slot),
                content: h.hook_text,
                rationale: h.rationale,
                register: h.hook_type,
            });
        });
    }

    // Bodies
    if (output.bodies && Array.isArray(output.bodies)) {
        output.bodies.forEach((b: any, i: number) => {
            const slot = i + 1;
            components.push({
                component_type: 'body',
                slot_number: slot,
                tag: buildBodyTag(sku, version, slot),
                content: b.body_long,
                rationale: b.rationale,
                structure: b.body_short,
            });
        });
    }

    // CTAs
    if (output.ctas && Array.isArray(output.ctas)) {
        output.ctas.forEach((c: any, i: number) => {
            const slot = i + 1;
            components.push({
                component_type: 'cta',
                slot_number: slot,
                tag: buildCtaTag(sku, version, slot),
                content: c.cta_text,
                rationale: c.rationale,
            });
        });
    }

    await saveCopyComponents({
        product_id: product.id as string,
        product_version: version,
        pipeline_id: pipelineId,
        components,
    });

    return output;
}
