// Carrega histórico de mensagens de uma conversa.
// Duas versões de formato: Gemini (legado) e Anthropic (Claude agent).
// Filtra markers internos (ex: [plan_preview]) em ambas as versões.

import type { SupabaseClient } from '@supabase/supabase-js';
import type Anthropic           from '@anthropic-ai/sdk';

// ── Formato Gemini (legado — callJarvisGemini) ────────────────────────────────

export interface GeminiContent {
  role:  'user' | 'model';
  parts: { text: string }[];
}

export async function loadConversationHistory(
  conversationId: string,
  supabase:        SupabaseClient,
  limit:           number = 20,
): Promise<GeminiContent[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .neq('content', '[plan_preview]')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data
    .reverse()
    .map((m) => ({
      role:  m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content as string }],
    }));
}

// ── Formato Anthropic (Claude agent — callJarvisClaude) ───────────────────────

export async function loadConversationHistoryClaude(
  conversationId: string,
  supabase:        SupabaseClient,
  limit:           number = 50,
): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .neq('content', '[plan_preview]')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Claude espera mensagens em ordem cronológica (mais antiga primeiro)
  // e alternância estrita user/assistant — garante isso colapsando consecutivos
  const ordered = data.reverse();
  const result: Anthropic.MessageParam[] = [];

  for (const m of ordered) {
    const role: 'user' | 'assistant' =
      m.role === 'assistant' ? 'assistant' : 'user';
    const content = (m.content as string).trim();
    if (!content) continue;

    // Garante alternância: se o último é o mesmo role, concatena
    const last = result[result.length - 1];
    if (last && last.role === role) {
      last.content =
        typeof last.content === 'string'
          ? `${last.content}\n\n${content}`
          : content;
    } else {
      result.push({ role, content });
    }
  }

  // Claude exige que a sequência comece com 'user'
  while (result.length > 0 && result[0].role !== 'user') {
    result.shift();
  }

  return result;
}
