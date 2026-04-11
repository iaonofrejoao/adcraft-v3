import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { pipelines, products, copyComponents } from '../../frontend/lib/schema/index';
import { buildContext, serializeContext } from '../lib/context-builder';
import { callAgent } from '../lib/llm/gemini-client';
import { updateComplianceStatus } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';

/**
 * Agente 3.8 — Anvisa Compliance
 * Audita as copies geradas contra políticas de banimento.
 */
export async function runAnvisaCompliance(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id is required for anvisa_compliance');

    // 1. Busca meta-dados
    const pipeline = await (db.query as any).pipelines.findFirst({
        where: eq(pipelines.id, pipelineId)
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const product = await (db.query as any).products.findFirst({
        where: eq(products.id, pipeline.product_id as string)
    });
    if (!product) throw new Error(`Product ${pipeline.product_id} not found`);

    // 2. Busca componentes gerados neste pipeline/versão
    const components = await (db.query as any).copyComponents.findMany({
        where: and(
            eq(copyComponents.product_id, product.id as string),
            eq(copyComponents.product_version, pipeline.product_version)
        )
    });

    if (components.length === 0) {
        return { status: 'skipped', reason: 'No components found for this version' };
    }

    // 3. Build Context
    const ctx = await buildContext(
        'anvisa_compliance',
        product.id as string,
        pipelineId
    );

    // 4. User Message
    const componentsStr = components.map((c: any) =>
        `Tag: ${c.tag}\nTipo: ${c.component_type}\nConteúdo: ${c.content}\nRationale: ${c.rationale}\n---`
    ).join('\n');

    const dynamicInput = `Verifique estes componentes de Copy com extremo critério de Compliance.

[Escopo do Produto]:
Nicho: ${product.niche_id}
Promessa Principal: "${(ctx.context_json.product as any)?.main_promise || ''}"

[Componentes para Auditoria]:
${componentsStr}

${serializeContext(ctx)}

Analise cada um. Se houver erro crítico em qualquer um, reporte no JSON e marque overall_approved como false.`;

    // 5. Chamada LLM
    const result = await callAgent({
        agent_name: 'anvisa_compliance',
        pipeline_id: pipelineId,
        product_id: product.id as string,
        dynamic_input: dynamicInput,
    });

    // 6. Atualização de status
    const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
    const issues = output.issues || [];

    // Mapeia resultados por tag
    // Regra: se a tag aparece nas issues com critical, ela é rejected. Se não, approved.
    const complianceResults = components.map((c: any) => {
        const componentIssues = issues.filter((i: any) => i.element.includes(c.tag) || (c.slot_number && i.element.includes(`${c.component_type} ${c.tag.split('_').pop()}`)));
        const hasCritical = componentIssues.some((i: any) => i.severity === 'critical');

        return {
            tag: c.tag,
            status: (hasCritical ? 'rejected' : 'approved') as 'approved' | 'rejected',
            violations: componentIssues,
        };
    });

    await updateComplianceStatus({ results: complianceResults });

    return output;
}
