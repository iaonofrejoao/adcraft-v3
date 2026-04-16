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
  | 'video_maker'
  | 'niche_curator';

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
  // ── Agentes migrados para Anthropic Claude ────────────────────────────────
  avatar_research: {
    requires: ['product'],
    produces: ['avatar'],
    cacheable: true,
    freshness_days: 60,
    model: 'claude-opus-4-6',   // Fase A: persona + profundidade criativa
    max_input_tokens: 4000,
  },
  market_research: {
    requires: ['product'],
    produces: ['market'],
    cacheable: true,
    freshness_days: 30,
    model: 'claude-opus-4-6',   // Fase A: decisão crítica de viabilidade
    max_input_tokens: 4000,
  },
  angle_generator: {
    requires: ['product', 'avatar', 'market'],
    produces: ['angles'],
    cacheable: true,
    freshness_days: 30,
    model: 'claude-opus-4-6',   // Fase A: alto impacto no resultado criativo
    max_input_tokens: 8000,
  },
  copy_hook_generator: {
    requires: ['product', 'avatar', 'angles'],
    produces: ['copy_components'],
    cacheable: false,
    model: 'claude-opus-4-6',   // Fase A: qualidade de escrita crítica
    max_input_tokens: 10000,
    modes: ['full', 'hooks_only', 'bodies_only', 'ctas_only'],
  },
  anvisa_compliance: {
    requires: ['copy_components'],
    produces: ['compliance_results'],
    cacheable: false,
    model: 'claude-sonnet-4-6', // Fase A: análise baseada em regras, custo-benefício
    max_input_tokens: 6000,
  },
  niche_curator: {
    requires: [],
    produces: [],
    cacheable: false,
    model: 'claude-sonnet-4-6', // Fase A: curadoria repetitiva, volume alto
    max_input_tokens: 16000,
  },
  // ── Agentes que permanecem no Gemini (Veo 3 / lógica pura) ───────────────
  // Agente de manutenção (cron) — sem pipeline, sem artifacts de pipeline.
  // Não é selecionável pelo planner (requires/produces vazios).
  video_maker: {
    requires: ['copy_combinations_selected', 'product'],
    produces: ['video_assets'],
    cacheable: false,
    model: 'gemini-2.5-flash',  // Mantém: integração Veo 3 (Fase A fora de escopo)
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
// Fase B: migrado para Claude Opus 4.6 com tool use (PLANO_EXECUCAO_V2 Fase B).
export const JARVIS_MODEL = 'claude-opus-4-6';

// Budgets padrão por goal (PRD seção 10)
export const GOAL_BUDGET_DEFAULTS: Record<GoalName, number> = {
  avatar_only: 0.30,
  market_only: 0.30,
  angles_only: 1.00,
  copy_only: 2.00,
  creative_full: 8.00,
};
