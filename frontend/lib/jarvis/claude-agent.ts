// Loop principal do Jarvis como agente Claude com tool use.
// Substitui callJarvisGemini para respostas de linguagem natural.
//
// Fluxo:
//   1. Carrega histórico da conversa (últimas 50 mensagens)
//   2. Constrói system prompt rico com contexto do usuário
//   3. Executa loop tool use (máximo 25 rounds)
//   4. Emite SSE events: tool_call, tool_result, message
//   5. Retorna texto final da resposta

import Anthropic                        from '@anthropic-ai/sdk';
import type { SupabaseClient }          from '@supabase/supabase-js';
import { buildJarvisSystemPrompt }      from './jarvis-system-prompt';
import { JARVIS_TOOL_DEFINITIONS, buildToolExecutor } from './tool-registry';
import { loadConversationHistoryClaude } from './loadConversationHistory';

// ── Constantes ────────────────────────────────────────────────────────────────

const MAX_ROUNDS = 25;
const JARVIS_CLAUDE_MODEL = 'claude-opus-4-6';

// Singleton do cliente Anthropic (reusado entre requests)
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface JarvisCallParams {
  userMessage:       string;
  conversationId:    string;
  supabase:          SupabaseClient;
  /** Função de emissão SSE — chamada durante tool calls e resposta final */
  emit:              (event: { type: string; [key: string]: unknown }) => void;
  /** Contexto extra injetado no system prompt (produto ativo, pipeline, etc.) */
  extraContext?:     string;
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Chama o Jarvis via Claude Opus com tool use loop completo.
 * Retorna o texto da resposta final (já emitido via emit({ type: 'message' })).
 */
export async function callJarvisClaude(params: JarvisCallParams): Promise<string> {
  const anthropic   = getAnthropic();
  const executeTool = buildToolExecutor(params.supabase, params.conversationId, params.emit);

  // 1. System prompt com contexto do banco
  const systemPrompt = await buildJarvisSystemPrompt(params.supabase, params.extraContext);

  // 2. Histórico da conversa em formato Anthropic (últimas 50 mensagens)
  const history = await loadConversationHistoryClaude(params.conversationId, params.supabase, 50);

  // 3. Monta messages array com histórico + mensagem atual
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: params.userMessage },
  ];

  let finalText = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model:      JARVIS_CLAUDE_MODEL,
      max_tokens: 4096,
      system: [
        {
          type:          'text',
          text:          systemPrompt,
          // Prompt caching: system prompt é cacheado entre requests da mesma sessão
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools:    JARVIS_TOOL_DEFINITIONS,
      messages,
    });

    // Adiciona resposta do modelo ao histórico da sessão
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      // Resposta final — extrai texto e emite
      const textBlock = response.content.find((b) => b.type === 'text');
      finalText = (textBlock && 'text' in textBlock ? textBlock.text : '') ?? '';
      break;
    }

    // Executa todas as tools solicitadas neste round
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        // Emite evento SSE: Claude está chamando uma tool
        params.emit({
          type:  'tool_call',
          name:  block.name,
          input: block.input,
        });

        try {
          const result = await executeTool(block.name, block.input as Record<string, unknown>);

          // Emite evento SSE: resultado da tool
          params.emit({
            type:     'tool_result',
            name:     block.name,
            output:   result,
            is_error: false,
          });

          return {
            type:        'tool_result' as const,
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);

          params.emit({
            type:     'tool_result',
            name:     block.name,
            output:   { error: errMsg },
            is_error: true,
          });

          return {
            type:        'tool_result' as const,
            tool_use_id: block.id,
            content:     JSON.stringify({ error: errMsg }),
            is_error:    true,
          };
        }
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  if (finalText) {
    params.emit({ type: 'message', content: finalText });
  }

  return finalText;
}
