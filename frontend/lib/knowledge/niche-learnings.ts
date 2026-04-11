// Camada de leitura/escrita/reforço de niche_learnings.
// Escrita: via RPC `write_niche_learning` (transação atômica com enqueue de embedding).
// Reforço: via RPC `reinforce_niche_learning` (atualiza confidence + occurrences).
// Leitura: query direta via Supabase client.
// PRD seção 7.2 | Fase 2.7.1

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type LearningType =
  | 'angle_winner'
  | 'angle_loser'
  | 'hook_pattern'
  | 'creative_format'
  | 'objection'
  | 'language_pattern'
  | 'avatar_insight'
  | 'compliance_violation';

export type LearningStatus = 'active' | 'inactive';

export interface NicheLearning {
  id: string;
  niche_id: string;
  learning_type: LearningType;
  content: string;
  evidence: Record<string, unknown>[];
  confidence: number;
  occurrences: number;
  status: LearningStatus;
  created_at: string;
  last_reinforced_at: string;
}

export interface WriteLearningParams {
  niche_id: string;
  learning_type: LearningType;
  content: string;
  evidence?: Record<string, unknown>;
  confidence?: number; // default 0.3
}

export interface ReinforceLearningParams {
  id: string;
  extra_evidence?: Record<string, unknown>;
  delta?: number; // número de novos sinais, default 1
}

// ── Cliente de serviço ────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role key not configured');
  }
  return createSupabaseClient(url, key);
}

// ── Escrita ───────────────────────────────────────────────────────────────────

/**
 * Cria novo learning para um nicho.
 * Atomicamente:
 *   1. Insere em niche_learnings
 *   2. Enfileira embedding em `embeddings` (embedding IS NULL) se confidence >= 0.5
 *
 * Usa RPC write_niche_learning (migrations/v2/0003_niche_intelligence_rpcs.sql).
 */
export async function writeLearning(
  params: WriteLearningParams,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<NicheLearning> {
  const client = supabaseClient ?? getServiceClient();

  const { data, error } = await client.rpc('write_niche_learning', {
    p_niche_id:      params.niche_id,
    p_learning_type: params.learning_type,
    p_content:       params.content,
    p_evidence:      params.evidence ?? {},
    p_confidence:    params.confidence ?? 0.3,
  });

  if (error) {
    throw new Error(`write_niche_learning RPC failed: ${error.message}`);
  }

  return data as NicheLearning;
}

// ── Reforço ───────────────────────────────────────────────────────────────────

/**
 * Reforça um learning existente: incrementa occurrences, sobe confidence.
 * Se confidence cruzar 0.5 para cima, o RPC enfileira embedding automaticamente.
 *
 * Usa RPC reinforce_niche_learning.
 */
export async function reinforceLearning(
  params: ReinforceLearningParams,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<NicheLearning> {
  const client = supabaseClient ?? getServiceClient();

  const { data, error } = await client.rpc('reinforce_niche_learning', {
    p_id:             params.id,
    p_extra_evidence: params.extra_evidence ?? null,
    p_delta:          params.delta ?? 1,
  });

  if (error) {
    throw new Error(`reinforce_niche_learning RPC failed: ${error.message}`);
  }

  return data as NicheLearning;
}

// ── Leituras ──────────────────────────────────────────────────────────────────

/**
 * Retorna learnings ativos de um nicho, filtrados por tipos.
 * Ordena por confidence desc. Para busca semântica, usar learning-injector.ts.
 */
export async function getActiveLearnings(
  niche_id: string,
  types: LearningType[],
  limit = 50,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<NicheLearning[]> {
  const client = supabaseClient ?? getServiceClient();

  const { data, error } = await client
    .from('niche_learnings')
    .select('*')
    .eq('niche_id', niche_id)
    .in('learning_type', types)
    .eq('status', 'active')
    .order('confidence', { ascending: false })
    .order('occurrences', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`getActiveLearnings failed: ${error.message}`);
  }

  return (data ?? []) as NicheLearning[];
}

/**
 * Retorna todos os learnings ativos de um nicho (todos os tipos).
 */
export async function getAllActiveLearnings(
  niche_id: string,
  limit = 100,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<NicheLearning[]> {
  const client = supabaseClient ?? getServiceClient();

  const { data, error } = await client
    .from('niche_learnings')
    .select('*')
    .eq('niche_id', niche_id)
    .eq('status', 'active')
    .order('confidence', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`getAllActiveLearnings failed: ${error.message}`);
  }

  return (data ?? []) as NicheLearning[];
}

/**
 * Busca learning por id.
 */
export async function getLearningById(
  id: string,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<NicheLearning | null> {
  const client = supabaseClient ?? getServiceClient();

  const { data } = await client
    .from('niche_learnings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return (data as NicheLearning) ?? null;
}

// ── Gestão de status ──────────────────────────────────────────────────────────

/**
 * Marca learning como inativo (soft delete).
 * Usado quando o niche_curator decide que o learning foi superado.
 */
export async function deprecateLearning(
  id: string,
  supabaseClient?: ReturnType<typeof createSupabaseClient>
): Promise<void> {
  const client = supabaseClient ?? getServiceClient();

  const { error } = await client
    .from('niche_learnings')
    .update({ status: 'inactive' })
    .eq('id', id);

  if (error) {
    throw new Error(`deprecateLearning failed: ${error.message}`);
  }
}
