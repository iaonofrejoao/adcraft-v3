// Pre-processador de mensagens do chat: resolve @SKU, @nome e /ação.
// Skill: knowledge-layer.md — "Reference resolver"
// PRD seção 3.2 — MentionPicker e referências inline
//
// @ABCD   → busca exata por sku em `products`
// @nome   → busca fuzzy por name usando trigram (pg_trgm)
// /ação   → mapeia para GoalName do GOAL_TO_DELIVERABLE

import { createClient } from '../supabase';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Falls back to service-role client — never the anon key — to avoid silent RLS failures.
function getServiceClient(): ReturnType<typeof createClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createSupabaseClient(url, key) as unknown as ReturnType<typeof createClient>;
}
import type { GoalName } from '../agent-registry';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface ProductRef {
  id: string;
  name: string;
  sku: string;
  slug: string | null;
}

export interface ResolvedMention {
  raw: string;           // token original, ex: "@ABCD" ou "/copy"
  type: 'product' | 'goal';
  resolved: ProductRef | GoalName | null;
  ambiguous: boolean;
  candidates?: ProductRef[];  // preenchido quando ambiguous=true
}

export interface ResolveResult {
  message: string;            // mensagem original sem alteração
  mentions: ResolvedMention[];
  hasAmbiguity: boolean;
}

// ── Mapeamento /ação → GoalName ───────────────────────────────────────────────
// Aceita variantes em PT e EN.

const ACTION_TO_GOAL: Record<string, GoalName> = {
  avatar:    'avatar_only',
  avatares:  'avatar_only',
  mercado:   'market_only',
  market:    'market_only',
  angulos:   'angles_only',
  angles:    'angles_only',
  ângulos:   'angles_only',
  copy:      'copy_only',
  copies:    'copy_only',
  criativo:  'creative_full',
  criativos: 'creative_full',
  creative:  'creative_full',
  full:      'creative_full',
  video:     'creative_full',
  vídeo:     'creative_full',
};

// ── Parser de tokens ──────────────────────────────────────────────────────────

interface ParsedToken {
  raw: string;
  type: 'product_sku' | 'product_name' | 'goal';
  value: string;  // SKU (4 chars, uppercase) | nome fuzzy | slug de ação
}

const SKU_RE = /^[A-Z0-9]{4}$/;

function parseTokens(message: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];

  // @MENTION — produto
  for (const match of message.matchAll(/@([\w\u00C0-\u017F-]+)/g)) {
    const raw = match[0];
    const value = match[1];
    const isSkuLike = SKU_RE.test(value.toUpperCase());
    tokens.push({
      raw,
      type: isSkuLike ? 'product_sku' : 'product_name',
      value: isSkuLike ? value.toUpperCase() : value,
    });
  }

  // /AÇÃO — goal
  for (const match of message.matchAll(/\/([\w\u00C0-\u017F]+)/g)) {
    tokens.push({
      raw: match[0],
      type: 'goal',
      value: match[1].toLowerCase(),
    });
  }

  return tokens;
}

// ── Resolução de produto ──────────────────────────────────────────────────────

async function resolveProductBySku(
  sku: string,
  client: ReturnType<typeof createClient>
): Promise<ProductRef | null> {
  const { data } = await client
    .from('products')
    .select('id, name, sku, slug')
    .eq('sku', sku)
    .is('deleted_at', null)
    .maybeSingle();

  return data as ProductRef | null;
}

/**
 * Busca fuzzy por nome usando ILIKE (degradado de trigram).
 * O banco deve ter `pg_trgm` habilitado para performance em tabelas grandes.
 */
async function resolveProductByName(
  name: string,
  client: ReturnType<typeof createClient>
): Promise<{ product: ProductRef | null; candidates: ProductRef[] }> {
  const { data } = await client
    .from('products')
    .select('id, name, sku, slug')
    .ilike('name', `%${name}%`)
    .is('deleted_at', null)
    .limit(5);

  if (!data || data.length === 0) return { product: null, candidates: [] };
  if (data.length === 1) return { product: data[0] as ProductRef, candidates: [] };

  // Múltiplos resultados → ambíguo
  return { product: null, candidates: data as ProductRef[] };
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Resolve todos os @mentions e /ações em uma mensagem do chat.
 *
 * Se um produto for ambíguo (múltiplos matches), `ResolvedMention.ambiguous=true`
 * e Jarvis deve exibir um MentionPicker para o usuário escolher.
 *
 * @param message       - Texto da mensagem bruta do usuário
 * @param supabaseClient - Injeção para testes (opcional)
 */
export async function resolveReferences(
  message: string,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<ResolveResult> {
  const client = supabaseClient ?? getServiceClient();
  const tokens = parseTokens(message);

  if (tokens.length === 0) {
    return { message, mentions: [], hasAmbiguity: false };
  }

  const mentions = await Promise.all(
    tokens.map(async (token): Promise<ResolvedMention> => {
      if (token.type === 'goal') {
        const goal = ACTION_TO_GOAL[token.value] ?? null;
        return {
          raw: token.raw,
          type: 'goal',
          resolved: goal,
          ambiguous: false,
        };
      }

      if (token.type === 'product_sku') {
        const product = await resolveProductBySku(token.value, client);
        return {
          raw: token.raw,
          type: 'product',
          resolved: product,
          ambiguous: false,
        };
      }

      // product_name — fuzzy
      const { product, candidates } = await resolveProductByName(token.value, client);
      const ambiguous = candidates.length > 1;
      return {
        raw: token.raw,
        type: 'product',
        resolved: ambiguous ? null : product,
        ambiguous,
        candidates: ambiguous ? candidates : undefined,
      };
    })
  );

  return {
    message,
    mentions,
    hasAmbiguity: mentions.some((m) => m.ambiguous),
  };
}

// ── Helper de extração tipada ─────────────────────────────────────────────────

/** Retorna o primeiro produto resolvido sem ambiguidade, ou null. */
export function extractProduct(result: ResolveResult): ProductRef | null {
  const m = result.mentions.find((m) => m.type === 'product' && !m.ambiguous && m.resolved);
  return m ? (m.resolved as ProductRef) : null;
}

/** Retorna o goal resolvido, ou null. */
export function extractGoal(result: ResolveResult): GoalName | null {
  const m = result.mentions.find((m) => m.type === 'goal' && m.resolved);
  return m ? (m.resolved as GoalName) : null;
}
