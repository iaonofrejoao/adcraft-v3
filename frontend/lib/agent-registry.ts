// Canonical capability map — fonte de verdade para o planner e os workers.
// PRD seção 4.1. Regra 14: nenhum lugar do código tem sequência fixa.
// Regra 17: model assignment sempre vem daqui.

export type ArtifactType =
  | 'product'
  | 'avatar'
  | 'market'
  | 'angles'
  | 'copy_components'
  | 'compliance_results'
  | 'copy_combinations_selected'
  | 'video_assets';

export type AgentName =
  | 'avatar_research'
  | 'market_research'
  | 'angle_generator'
  | 'copy_hook_generator'
  | 'anvisa_compliance'
  | 'video_maker';

export type CopyMode = 'full' | 'hooks_only' | 'bodies_only' | 'ctas_only';

export interface AgentCapability {
  requires: ArtifactType[];
  produces: ArtifactType[];
  cacheable: boolean;
  freshness_days?: number; // só presente quando cacheable=true
  model: string;
  max_input_tokens: number;
  modes?: CopyMode[]; // apenas copy_hook_generator
}

export const AGENT_REGISTRY: Record<AgentName, AgentCapability> = {
  avatar_research: {
    requires: ['product'],
    produces: ['avatar'],
    cacheable: true,
    freshness_days: 60,
    model: 'gemini-2.5-pro',
    max_input_tokens: 4000,
  },
  market_research: {
    requires: ['product'],
    produces: ['market'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',
    max_input_tokens: 4000,
  },
  angle_generator: {
    requires: ['product', 'avatar', 'market'],
    produces: ['angles'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',
    max_input_tokens: 8000,
  },
  copy_hook_generator: {
    requires: ['product', 'avatar', 'angles'],
    produces: ['copy_components'],
    cacheable: false,
    model: 'gemini-2.5-pro',
    max_input_tokens: 10000,
    modes: ['full', 'hooks_only', 'bodies_only', 'ctas_only'],
  },
  anvisa_compliance: {
    requires: ['copy_components'],
    produces: ['compliance_results'],
    cacheable: false,
    model: 'gemini-2.5-flash',
    max_input_tokens: 6000,
  },
  video_maker: {
    requires: ['copy_combinations_selected', 'product'],
    produces: ['video_assets'],
    cacheable: false,
    model: 'gemini-2.5-flash',
    max_input_tokens: 4000,
  },
};

export type GoalName =
  | 'avatar_only'
  | 'market_only'
  | 'angles_only'
  | 'copy_only'
  | 'creative_full';

// Mapa goal → artifact que o planner deve produzir como deliverable final
export const GOAL_TO_DELIVERABLE: Record<GoalName, ArtifactType> = {
  avatar_only: 'avatar',
  market_only: 'market',
  angles_only: 'angles',
  copy_only: 'compliance_results',  // PRD 4.2: copy_only inclui anvisa_compliance
  creative_full: 'video_assets',
};

// Modelo do Jarvis (framework, não agente rastreável — regra 17 nota)
// Centralizado aqui para facilitar rastreabilidade de modelo.
export const JARVIS_MODEL = 'gemini-2.5-flash';

// Budgets padrão por goal (PRD seção 10)
export const GOAL_BUDGET_DEFAULTS: Record<GoalName, number> = {
  avatar_only: 0.30,
  market_only: 0.30,
  angles_only: 1.00,
  copy_only: 2.00,
  creative_full: 8.00,
};
