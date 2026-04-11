// Gemini Context Caching via REST API (fetch puro — sem SDK).
// Regra 18: único ponto de cache — chamado por gemini-client.ts dentro de callAgent.
// Endpoint: https://generativelanguage.googleapis.com/v1beta/cachedContents
//
// Funções exportadas:
//   createOrGetCache  — busca cache válido ou cria novo (TTL padrão 1h)
//   invalidateCache   — remove cache da tabela e opcionalmente do Gemini

import { randomUUID } from 'crypto';
import { db } from '../db';
import { promptCaches } from '../../../frontend/lib/schema/index';
import { eq, and, gt } from 'drizzle-orm';

const GEMINI_CACHE_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MIN_TOKENS_FOR_CACHE = 4096;

/**
 * Retorna um cache Gemini válido ou cria um novo.
 * Retorna null se o conteúdo não atingir o mínimo de tokens necessários
 * ou se a API rejeitar a criação.
 */
export async function createOrGetCache(params: {
  cache_key: string;
  content: string;
  model: string;
  ttl_seconds?: number;
}): Promise<{ cache_name: string; cached_tokens: number } | null> {
  const { cache_key, content, model, ttl_seconds = 3600 } = params;

  // a) Cache válido já existe na tabela?
  const existing = await db.query.promptCaches.findFirst({
    where: and(
      eq(promptCaches.cache_key, cache_key),
      gt(promptCaches.expires_at, new Date()),
    ),
  });

  if (existing?.gemini_cache_name) {
    const cached_tokens = Math.ceil(content.length / 4);
    return { cache_name: existing.gemini_cache_name, cached_tokens };
  }

  // b) Estimativa de tokens — abaixo de 4096 não vale a pena cachear
  const estimatedTokens = Math.ceil(content.length / 4);
  if (estimatedTokens < MIN_TOKENS_FOR_CACHE) {
    return null;
  }

  // c) Cria cache via REST POST /v1beta/cachedContents
  let res: Response;
  try {
    res = await fetch(`${GEMINI_CACHE_BASE}/cachedContents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        contents: [{ role: 'user', parts: [{ text: content }] }],
        ttl: `${ttl_seconds}s`,
      }),
    });
  } catch (err) {
    console.error('[prompt-cache] fetch network error:', err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text();
    // HTTP 400 do Gemini geralmente indica tokens insuficientes — silencioso
    if (res.status === 400) {
      return null;
    }
    console.error(`[prompt-cache] API error ${res.status}: ${body}`);
    return null;
  }

  const data = (await res.json()) as { name?: string };
  const cache_name = data.name;
  if (!cache_name) {
    console.error('[prompt-cache] Response missing name field:', data);
    return null;
  }

  // d) Persiste em prompt_caches (UPSERT — race condition safe)
  const expiresAt = new Date(Date.now() + ttl_seconds * 1000);
  await db
    .insert(promptCaches)
    .values({
      id:                randomUUID(),
      cache_key,
      gemini_cache_name: cache_name,
      expires_at:        expiresAt,
    })
    .onConflictDoUpdate({
      target: promptCaches.cache_key,
      set: {
        gemini_cache_name: cache_name,
        expires_at:        expiresAt,
      },
    });

  // e) Retorna { cache_name, cached_tokens }
  return { cache_name, cached_tokens: estimatedTokens };
}

/**
 * Remove cache da tabela local e tenta deletar no Gemini (best-effort).
 */
export async function invalidateCache(cache_key: string): Promise<void> {
  const existing = await db.query.promptCaches.findFirst({
    where: eq(promptCaches.cache_key, cache_key),
  });

  await db.delete(promptCaches).where(eq(promptCaches.cache_key, cache_key));

  if (existing?.gemini_cache_name) {
    try {
      await fetch(`${GEMINI_CACHE_BASE}/${existing.gemini_cache_name}`, {
        method: 'DELETE',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      });
    } catch {
      // Silencioso: deleção no Gemini é best-effort
    }
  }
}
