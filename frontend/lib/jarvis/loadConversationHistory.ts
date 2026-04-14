// Carrega histórico de mensagens de uma conversa para envio ao Gemini.
// Filtra markers internos (ex: [plan_preview]) e devolve no formato
// multi-turn da Gemini API (role: 'user' | 'model', ordem cronológica).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function loadConversationHistory(
  conversationId: string,
  supabase: SupabaseClient,
  limit: number = 20,
): Promise<GeminiContent[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .neq('content', '[plan_preview]')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Inverte para ordem cronológica (Gemini espera mais antiga primeiro)
  return data
    .reverse()
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content as string }],
    }));
}
