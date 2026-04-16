import type { PipelinePlan } from '@/lib/jarvis/planner'

export interface ToolCallRecord {
  name:      string
  input:     Record<string, unknown>
  output?:   unknown
  is_error?: boolean
}

export interface ChatMessage {
  id:             string
  role:           'user' | 'assistant'
  content:        string
  statusMessage?: string
  planPreview?:   { plan: PipelinePlan; pipeline_id: string; pipeline_status?: string }
  pipelineStatus?: Record<string, unknown>
  /** Tool calls feitas pelo Claude agent durante este turno */
  toolCalls?:     ToolCallRecord[]
}
