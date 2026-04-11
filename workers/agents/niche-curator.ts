import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { copyComponents, nicheLearnings } from '../../frontend/lib/schema/index';
import { callAgent } from '../lib/llm/gemini-client';
import { executeCuratorOperations } from '../lib/knowledge';
import { type TaskRow } from '../task-runner';

/**
 * Agente 3.9 — Niche Curator
 * Consolida sinais de aprovação/rejeição em aprendizados de nicho.
 */
export async function runNicheCurator(task: TaskRow): Promise<Record<string, unknown>> {
    const input = task.input_context as any;
    const nicheId = input?.niche_id;
    if (!nicheId) throw new Error('niche_id is required in input_context for niche_curator');

    const lookbackHours = input?.signal_lookback_hours || 48;

    // 1. Busca componentes pendentes ou recém aprovados para este nicho
    const components = await (db.query as any).copyComponents.findMany({
        where: and(
            eq(copyComponents.approval_status, sql`ANY(ARRAY['approved', 'rejected']::text[])`),
            sql`approved_at >= NOW() - INTERVAL '${sql.raw(String(lookbackHours))} hours'`
            // Idealmente filtraríamos por produtos do nicho, mas aqui pegamos geral ou filtramos por niche se houver relação direta
        )
    });

    // Nota: o cron já filtra por nichos que têm sinais, mas aqui precisamos garantir que pegamos os sinais do nicho certo.
    // Como copy_components não tem niche_id, precisamos dar join com products.
    const nicheSignals = await db.execute(sql`
    SELECT cc.*
    FROM copy_components cc
    JOIN products p ON p.id = cc.product_id
    WHERE p.niche_id = ${nicheId}
      AND cc.approval_status IN ('approved', 'rejected')
      AND cc.approved_at >= NOW() - INTERVAL '${sql.raw(String(lookbackHours))} hours'
  `);

    if (nicheSignals.length === 0) {
        return { status: 'skipped', reason: 'No signals found for this niche in the lookback period' };
    }

    // 2. Busca learnings existentes do nicho
    const existingLearnings = await (db.query as any).nicheLearnings.findMany({
        where: and(
            eq(nicheLearnings.niche_id, nicheId),
            eq(nicheLearnings.status, 'active')
        )
    });

    // 3. Prepara Input para o LLM
    const dynamicInput = JSON.stringify({
        niche: { id: nicheId, name: input.niche_name || 'Nicho Desconhecido' },
        signals: nicheSignals.map((s: any) => ({
            component_tag: s.tag,
            component_type: s.component_type,
            register: s.register,
            content: s.content,
            rationale: s.rationale,
            human_action: s.approval_status,
            compliance_status: s.compliance_status,
        })),
        existing_learnings: existingLearnings.map((l: any) => ({
            id: l.id,
            type: l.learning_type,
            content: l.content,
            confidence: parseFloat(l.confidence || '0'),
        })),
    }, null, 2);

    // 4. Chamada LLM
    const result = await callAgent({
        agent_name: 'niche_curator',
        pipeline_id: null, // Maintenance task
        niche_id: nicheId,
        dynamic_input: dynamicInput,
    });

    // 5. Executa Operações
    const ops = Array.isArray(result.output) ? result.output : (result.output as any).ops || [];

    if (ops.length > 0) {
        await executeCuratorOperations({
            niche_id: nicheId,
            ops: ops,
        });
    }

    return {
        processed_signals: nicheSignals.length,
        operations_executed: ops.length,
        ops
    };
}
