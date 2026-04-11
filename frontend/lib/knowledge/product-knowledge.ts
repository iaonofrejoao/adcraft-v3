// Camada de acesso à memória persistente de produto.
// Escrita: via RPC `write_artifact` (transação atômica no Postgres — Regra 15).
// Leitura: via Supabase client (anon ou service role).
// Skill: knowledge-layer.md | PRD seção 5.1

import { createClient as createAnonClient } from '../supabase';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getFreshnessCutoff } from './freshness';
import type { ArtifactType } from '../agent-registry';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface WriteArtifactParams {
  product_id: string;
  product_version: number;
  artifact_type: ArtifactType;
  artifact_data: Record<string, unknown>;
  source_pipeline_id: string;
  source_task_id: string;
}

export interface KnowledgeRecord {
  id: string;
  product_id: string;
  product_version: number;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  source_pipeline_id: string;
  source_task_id: string;
  status: 'fresh' | 'superseded';
  created_at: string;
  superseded_at: string | null;
  superseded_by: string | null;
}

// ── Cliente de serviço (escreve, bypassa RLS) ─────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key not configured (SUPABASE_SERVICE_KEY)');
  }
  return createSupabaseClient(url, key);
}

// ── Escrita atômica ───────────────────────────────────────────────────────────

/**
 * Escreve artifact em product_knowledge atomicamente via RPC:
 *   1. Supersede artifact anterior do mesmo tipo
 *   2. Insere novo artifact com status='fresh'
 *   3. Faz merge em pipelines.state (JSONB || patch)
 *   4. Enfileira embedding (embeddings row com vetor NULL)
 *
 * Regra 15: deve ser chamada após CADA agente completar, antes de marcar task como done.
 */
export async function writeArtifact(
  params: WriteArtifactParams,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<KnowledgeRecord> {
  const client = supabaseClient ?? getServiceClient();

  const { data, error } = await client.rpc('write_artifact', {
    p_product_id:         params.product_id,
    p_product_version:    params.product_version,
    p_artifact_type:      params.artifact_type,
    p_artifact_data:      params.artifact_data,
    p_source_pipeline_id: params.source_pipeline_id,
    p_source_task_id:     params.source_task_id,
  });

  if (error) {
    throw new Error(`write_artifact RPC failed: ${error.message}`);
  }

  return data as KnowledgeRecord;
}

// ── Leituras ─────────────────────────────────────────────────────────────────

/**
 * Retorna o artifact mais recente e fresco para um produto + tipo.
 * Aplica a política de frescor do freshness.ts.
 * Retorna null se não houver artifact fresco ou se tiver expirado.
 */
export async function getFreshArtifact(
  product_id: string,
  artifact_type: ArtifactType,
  supabaseClient?: ReturnType<typeof createAnonClient>
): Promise<KnowledgeRecord | null> {
  const client = supabaseClient ?? createAnonClient();
  const cutoff = getFreshnessCutoff(artifact_type);

  // Tipo não-cacheável → nunca há artifact fresco a reaproveitar
  if (cutoff === null && artifact_type !== 'product') return null;

  let query = client
    .from('product_knowledge')
    .select('*')
    .eq('product_id', product_id)
    .eq('artifact_type', artifact_type)
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1);

  if (cutoff) {
    query = query.gte('created_at', cutoff.toISOString());
  }

  const { data } = await query.maybeSingle();
  return (data as KnowledgeRecord) ?? null;
}

/**
 * Retorna todos os artifacts frescos de um produto, agrupados por tipo.
 * Aplica filtro de frescor por tipo individualmente.
 */
export async function getAllFreshArtifacts(
  product_id: string,
  supabaseClient?: ReturnType<typeof createAnonClient>
): Promise<Record<string, KnowledgeRecord>> {
  const client = supabaseClient ?? createAnonClient();

  const { data } = await client
    .from('product_knowledge')
    .select('*')
    .eq('product_id', product_id)
    .eq('status', 'fresh')
    .order('created_at', { ascending: false });

  if (!data) return {};

  const result: Record<string, KnowledgeRecord> = {};

  for (const row of data as KnowledgeRecord[]) {
    // Já temos o mais recente por tipo (ORDER BY created_at DESC)
    if (result[row.artifact_type]) continue;

    const cutoff = getFreshnessCutoff(row.artifact_type);

    // Tipo não-cacheável: nunca retorna como fresco (exceto 'product')
    if (cutoff === null && row.artifact_type !== 'product') continue;

    // Dentro da janela de frescor?
    if (cutoff && new Date(row.created_at) < cutoff) continue;

    result[row.artifact_type] = row;
  }

  return result;
}

/**
 * Força o status de um artifact antigo para 'superseded', apontando para o novo.
 * Usado quando force_refresh=true e o planner já criou nova task sobre um artifact existente.
 */
export async function supersedeArtifact(
  old_id: string,
  new_id: string,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<void> {
  const client = supabaseClient ?? getServiceClient();

  const { error } = await client
    .from('product_knowledge')
    .update({
      status: 'superseded',
      superseded_at: new Date().toISOString(),
      superseded_by: new_id,
    })
    .eq('id', old_id);

  if (error) {
    throw new Error(`supersedeArtifact failed: ${error.message}`);
  }
}
