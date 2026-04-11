import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { promptCaches } from '../../../frontend/lib/schema/index';
import { eq } from 'drizzle-orm';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Busca por um prompt em buffer ou gera uma nova sessão cacheada Gemini 
 * expirando dentro de 1 hora conforme instrução do PRD "Cost Optimization"
 */
export async function getOrCreateCache(agentName: string, nicheId: string, systemPromptText: string) {
  const key = `${agentName}_${nicheId}`;
  
  const existing = await db.query.promptCaches.findFirst({
    where: eq(promptCaches.cache_key, key)
  });
  
  if (existing && existing.expires_at && existing.expires_at > new Date()) {
    return existing.gemini_cache_name;
  }

  // TODO: Invocar api nativa de cache ContextCaches do GoogleGenAI
  // Utilizarei um mock placeholder, pois dependeria dos bytes finais gerados pelo prompt.
  const cacheName = `cac_${Date.now()}_${key.substring(0,10)}`;
  
  await db.insert(promptCaches).values({
    id: randomUUID(),
    cache_key: key,
    gemini_cache_name: cacheName,
    expires_at: new Date(Date.now() + 60 * 60 * 1000), // Expira em 1 hora
  }).onConflictDoUpdate({
    target: promptCaches.cache_key,
    set: {
      gemini_cache_name: cacheName,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return cacheName;
}
