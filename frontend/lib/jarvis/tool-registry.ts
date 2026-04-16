// Registry central de tools do Jarvis Claude agent.
// Consolida definições Anthropic + executores em um único objeto.
// Importado por claude-agent.ts.

import type { SupabaseClient }    from '@supabase/supabase-js';
import type Anthropic             from '@anthropic-ai/sdk';

import {
  QUERY_PRODUCTS_TOOL,   executeQueryProducts,
  QUERY_EXECUTIONS_TOOL, executeQueryExecutions,
  QUERY_AGENT_OUTPUT_TOOL, executeQueryAgentOutput,
  type ToolContext,
} from './tools/database-read';

import {
  READ_FILE_TOOL,       executeReadFile,
  LIST_FILES_TOOL,      executeListFiles,
  SEARCH_IN_FILES_TOOL, executeSearchInFiles,
} from './tools/files';

import {
  TRIGGER_AGENT_TOOL, executeTriggerAgent,
} from './tools/execution';

import {
  WEB_SEARCH_TOOL, executeSearchWeb,
} from '../tools/web-search';

// ── Adaptador: WEB_SEARCH_TOOL usa formato genérico, não Anthropic.Tool ──────

const WEB_SEARCH_ANTHROPIC_TOOL: Anthropic.Tool = {
  name:         WEB_SEARCH_TOOL.name,
  description:  WEB_SEARCH_TOOL.description,
  input_schema: WEB_SEARCH_TOOL.input_schema as Anthropic.Tool['input_schema'],
};

// ── Definições Anthropic (enviadas para o Claude) ─────────────────────────────

export const JARVIS_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // Banco de dados — leitura
  {
    name:         QUERY_PRODUCTS_TOOL.name,
    description:  QUERY_PRODUCTS_TOOL.description,
    input_schema: QUERY_PRODUCTS_TOOL.input_schema,
  },
  {
    name:         QUERY_EXECUTIONS_TOOL.name,
    description:  QUERY_EXECUTIONS_TOOL.description,
    input_schema: QUERY_EXECUTIONS_TOOL.input_schema,
  },
  {
    name:         QUERY_AGENT_OUTPUT_TOOL.name,
    description:  QUERY_AGENT_OUTPUT_TOOL.description,
    input_schema: QUERY_AGENT_OUTPUT_TOOL.input_schema,
  },
  // Execução
  {
    name:         TRIGGER_AGENT_TOOL.name,
    description:  TRIGGER_AGENT_TOOL.description,
    input_schema: TRIGGER_AGENT_TOOL.input_schema,
  },
  // Arquivos do projeto
  {
    name:         READ_FILE_TOOL.name,
    description:  READ_FILE_TOOL.description,
    input_schema: READ_FILE_TOOL.input_schema,
  },
  {
    name:         LIST_FILES_TOOL.name,
    description:  LIST_FILES_TOOL.description,
    input_schema: LIST_FILES_TOOL.input_schema,
  },
  {
    name:         SEARCH_IN_FILES_TOOL.name,
    description:  SEARCH_IN_FILES_TOOL.description,
    input_schema: SEARCH_IN_FILES_TOOL.input_schema,
  },
  // Web
  WEB_SEARCH_ANTHROPIC_TOOL,
];

// ── Executor central ─────────────────────────────────────────────────────────

export function buildToolExecutor(
  supabase:       SupabaseClient,
  conversationId: string,
  emit:           ToolContext['emit'],
) {
  const ctx: ToolContext = { supabase, conversationId, emit };

  return async function executeTool(
    name:  string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (name) {
      case 'query_products':      return executeQueryProducts(input, ctx);
      case 'query_executions':    return executeQueryExecutions(input, ctx);
      case 'query_agent_output':  return executeQueryAgentOutput(input, ctx);
      case 'trigger_agent':       return executeTriggerAgent(input, ctx);
      case 'read_file':           return executeReadFile(input);
      case 'list_files':          return executeListFiles(input);
      case 'search_in_files':     return executeSearchInFiles(input);
      case 'search_web':
        return executeSearchWeb(
          input.query as string,
          (input.num_results as number | undefined) ?? 5,
        );
      default:
        throw new Error(`Tool desconhecida: ${name}`);
    }
  };
}
