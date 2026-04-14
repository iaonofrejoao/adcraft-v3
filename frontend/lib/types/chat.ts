import type { PipelinePlan } from '@/lib/jarvis/planner'

export interface ChatMessage {
  id:             string
  role:           'user' | 'assistant'
  content:        string
  statusMessage?: string
  planPreview?:   { plan: PipelinePlan; pipeline_id: string; pipeline_status?: string }
  pipelineStatus?: Record<string, unknown>
}
