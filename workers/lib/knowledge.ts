import { randomUUID } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from './db';
import {
    productKnowledge,
    copyComponents,
    embeddings,
    nicheLearnings
} from '../../frontend/lib/schema/index';
import { type ArtifactType } from '../../frontend/lib/agent-registry';

/**
 * Salva um artifact no product_knowledge e cria uma entrada pendente na fila de embeddings.
 */
export async function saveArtifact(params: {
    product_id: string;
    product_version: number;
    artifact_type: ArtifactType;
    artifact_data: Record<string, unknown>;
    source_pipeline_id: string | null;
    source_task_id: string;
}) {
    const artifactId = randomUUID();

    await db.transaction(async (tx) => {
        // 1. Marca versões anteriores do mesmo artifact_type como 'superseded'
        await tx.execute(sql`
      UPDATE product_knowledge
      SET status = 'superseded', 
          superseded_at = NOW(),
          superseded_by = ${artifactId}
      WHERE product_id = ${params.product_id}
        AND artifact_type = ${params.artifact_type}
        AND status = 'fresh'
    `);

        // 2. Insere o novo artifact
        await tx.insert(productKnowledge).values({
            id: artifactId,
            product_id: params.product_id as any,
            product_version: params.product_version,
            artifact_type: params.artifact_type,
            artifact_data: params.artifact_data,
            source_pipeline_id: params.source_pipeline_id as any,
            source_task_id: params.source_task_id as any,
            status: 'fresh',
        });

        // 3. Enfileira para geração de embedding
        await tx.insert(embeddings).values({
            id: randomUUID(),
            source_table: 'product_knowledge',
            source_id: artifactId as any,
            model: 'gemini-embedding-001',
        });
    });

    return artifactId;
}

export interface CopyComponentInput {
    component_type: 'hook' | 'body' | 'cta';
    slot_number: number;
    tag: string;
    content: string;
    rationale?: string;
    register?: string;
    structure?: string;
    intensity?: string;
}

/**
 * Salva múltiplos componentes de copy na tabela copy_components.
 */
export async function saveCopyComponents(params: {
    product_id: string;
    product_version: number;
    pipeline_id: string | null;
    components: CopyComponentInput[];
}) {
    const values = params.components.map(c => ({
        id: randomUUID(),
        product_id: params.product_id as any,
        product_version: params.product_version,
        pipeline_id: params.pipeline_id as any,
        ...c,
        compliance_status: 'pending',
        approval_status: 'pending',
    }));

    if (values.length > 0) {
        await db.insert(copyComponents).values(values as any);
    }
}

/**
 * Atualiza o status de compliance de múltiplos componentes.
 */
export async function updateComplianceStatus(params: {
    results: Array<{
        tag: string;
        status: 'approved' | 'rejected';
        violations: any;
    }>;
}) {
    for (const res of params.results) {
        await db
            .update(copyComponents)
            .set({
                compliance_status: res.status,
                compliance_violations: res.violations,
            } as any)
            .where(eq(copyComponents.tag, res.tag));
    }
}

/**
 * Executa as operações decididas pelo niche_curator.
 */
export async function executeCuratorOperations(params: {
    niche_id: string;
    ops: Array<{
        op: 'create' | 'reinforce' | 'deprecate';
        learning?: { title?: string; type: string; content: string; evidence: string[]; confidence: number };
        learning_id?: string;
        new_evidence?: string[];
        reason?: string;
    }>;
}) {
    for (const op of params.ops) {
        if (op.op === 'create' && op.learning) {
            await db.insert(nicheLearnings).values({
                id: randomUUID(),
                niche_id: params.niche_id as any,
                learning_type: op.learning.type,
                content: op.learning.content,
                evidence: op.learning.evidence,
                confidence: op.learning.confidence.toString(),
                occurrences: op.learning.evidence.length,
                status: 'active',
            });
        } else if (op.op === 'reinforce' && op.learning_id) {
            await db.execute(sql`
        UPDATE niche_learnings
        SET occurrences = occurrences + ${op.new_evidence?.length || 0},
            evidence    = evidence || ${JSON.stringify(op.new_evidence || [])}::jsonb,
            last_reinforced_at = NOW(),
            confidence  = LEAST(1.0, confidence::float + (${(op.new_evidence?.length || 0) * 0.1}))::text
        WHERE id = ${op.learning_id}
      `);
        } else if (op.op === 'deprecate' && op.learning_id) {
            await db.update(nicheLearnings)
                .set({ status: 'deprecated' } as any)
                .where(eq(nicheLearnings.id, op.learning_id as any));
        }
    }
}
