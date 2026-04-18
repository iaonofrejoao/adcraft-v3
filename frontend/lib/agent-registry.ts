// Canonical capability map — fonte de verdade para o planner e os workers.
// PRD seção 4.1. Regra 14: nenhum lugar do código tem sequência fixa.
// Regra 17: model assignment sempre vem daqui.

export type ArtifactType =
  // ── Legado (7 agentes Gemini) ─────────────────────────────────────────────
  | 'product'
  | 'avatar'
  | 'market'
  | 'angles'
  | 'copy_components'
  | 'compliance_results'
  | 'copy_combinations_selected'
  | 'video_assets'
  // ── Pipeline Ultron (11 novos agentes Claude Code) ─────────────────────────
  | 'benchmark'
  | 'campaign_strategy'
  | 'script'
  | 'character'
  | 'keyframes'
  | 'creative_brief'
  | 'utms'
  | 'facebook_ads'
  | 'google_ads'
  | 'performance_report'
  | 'scaling_plan';

export type AgentName =
  // ── Legado (7 agentes Gemini) ─────────────────────────────────────────────
  | 'avatar_research'
  | 'market_research'
  | 'angle_generator'
  | 'copy_hook_generator'
  | 'anvisa_compliance'
  | 'video_maker'
  | 'niche_curator'
  // ── Pipeline Ultron (11 novos agentes Claude Code) ─────────────────────────
  | 'benchmark_intelligence'
  | 'campaign_strategy'
  | 'script_writer'
  | 'character_generator'
  | 'keyframe_generator'
  | 'creative_director'
  | 'utm_builder'
  | 'facebook_ads'
  | 'google_ads'
  | 'performance_analysis'
  | 'scaling_strategy';

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
  // ── Agentes Gemini — provider padrão (revertido da Fase A) ───────────────
  avatar_research: {
    requires: ['product'],
    produces: ['avatar'],
    cacheable: true,
    freshness_days: 60,
    model: 'gemini-2.5-pro',    // crítico: persona + profundidade criativa
    max_input_tokens: 4000,
  },
  market_research: {
    requires: ['product'],
    produces: ['market'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',    // crítico: decisão de viabilidade de mercado
    max_input_tokens: 4000,
  },
  angle_generator: {
    requires: ['product', 'avatar', 'market'],
    produces: ['angles'],
    cacheable: true,
    freshness_days: 30,
    model: 'gemini-2.5-pro',    // crítico: alto impacto no resultado criativo
    max_input_tokens: 8000,
  },
  copy_hook_generator: {
    requires: ['product', 'avatar', 'angles'],
    produces: ['copy_components'],
    cacheable: false,
    model: 'gemini-2.5-pro',    // crítico: qualidade de escrita
    max_input_tokens: 10000,
    modes: ['full', 'hooks_only', 'bodies_only', 'ctas_only'],
  },
  anvisa_compliance: {
    requires: ['copy_components'],
    produces: ['compliance_results'],
    cacheable: false,
    model: 'gemini-2.5-flash',  // secundário: análise baseada em regras
    max_input_tokens: 6000,
  },
  niche_curator: {
    requires: [],
    produces: [],
    cacheable: false,
    model: 'gemini-2.5-flash',  // secundário: curadoria repetitiva, volume alto
    max_input_tokens: 16000,
  },
  // ── Agentes Gemini (Veo 3 / lógica pura — nunca mudaram) ─────────────────
  // Agente de vídeo (cron) — sem pipeline, sem artifacts de pipeline.
  // Não é selecionável pelo planner (requires/produces vazios).
  video_maker: {
    requires: ['copy_combinations_selected', 'product'],
    produces: ['video_assets'],
    cacheable: false,
    model: 'gemini-2.5-flash',  // Veo 3 — mantido sempre no Gemini
    max_input_tokens: 4000,
  },

  // ── Pipeline Ultron — 11 agentes Claude Code ───────────────────────────────
  // Executados via Agent tool (subagentes), não via workers Node.js.
  // Skill em .claude/skills/agents/<agente>.md
  benchmark_intelligence: {
    requires: ['market', 'product'],
    produces: ['benchmark'],
    cacheable: true,
    freshness_days: 30,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 6000,
  },
  campaign_strategy: {
    requires: ['product', 'market', 'avatar', 'angles', 'benchmark'],
    produces: ['campaign_strategy'],
    cacheable: true,
    freshness_days: 30,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 10000,
  },
  script_writer: {
    requires: ['angles', 'campaign_strategy', 'avatar', 'product'],
    produces: ['script'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 8000,
  },
  character_generator: {
    requires: ['avatar', 'product', 'angles'],
    produces: ['character'],
    cacheable: true,
    freshness_days: 60,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 6000,
  },
  keyframe_generator: {
    requires: ['script', 'character', 'campaign_strategy'],
    produces: ['keyframes'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 8000,
  },
  creative_director: {
    requires: ['angles', 'copy_components', 'script', 'character', 'keyframes', 'avatar', 'campaign_strategy'],
    produces: ['creative_brief'],
    cacheable: false,
    model: 'claude-sonnet-4-6',   // crítico: decisão de aprovação com contexto amplo
    max_input_tokens: 14000,
  },
  utm_builder: {
    requires: ['campaign_strategy', 'creative_brief', 'product'],
    produces: ['utms'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 6000,
  },
  facebook_ads: {
    requires: ['compliance_results', 'utms', 'campaign_strategy', 'creative_brief', 'copy_components'],
    produces: ['facebook_ads'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 10000,
  },
  google_ads: {
    requires: ['compliance_results', 'utms', 'campaign_strategy', 'market', 'product'],
    produces: ['google_ads'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 8000,
  },
  performance_analysis: {
    requires: ['facebook_ads', 'google_ads', 'campaign_strategy', 'creative_brief'],
    produces: ['performance_report'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 10000,
  },
  scaling_strategy: {
    requires: ['performance_report', 'campaign_strategy', 'avatar', 'benchmark'],
    produces: ['scaling_plan'],
    cacheable: false,
    model: 'claude-sonnet-4-6',
    max_input_tokens: 8000,
  },
};

export type GoalName =
  // ── Legado (7 agentes Gemini) ─────────────────────────────────────────────
  | 'avatar_only'
  | 'market_only'
  | 'angles_only'
  | 'copy_only'
  | 'creative_full'
  // ── Pipeline Ultron ───────────────────────────────────────────────────────
  | 'pesquisa'
  | 'criativo'
  | 'lancamento'
  | 'full';

// Mapa goal → artifact que o planner deve produzir como deliverable final
export const GOAL_TO_DELIVERABLE: Record<GoalName, ArtifactType> = {
  avatar_only: 'avatar',
  market_only: 'market',
  angles_only: 'angles',
  copy_only: 'compliance_results',  // PRD 4.2: copy_only inclui anvisa_compliance
  creative_full: 'video_assets',
  pesquisa:    'benchmark',
  criativo:    'creative_brief',
  lancamento:  'facebook_ads',
  full:        'scaling_plan',
};

// Modelo do Jarvis (framework, não agente rastreável — regra 17 nota)
// Centralizado aqui para facilitar rastreabilidade de modelo.
export const JARVIS_MODEL = 'gemini-2.5-flash';

// Budgets padrão por goal (PRD seção 10)
export const GOAL_BUDGET_DEFAULTS: Record<GoalName, number> = {
  avatar_only: 0.30,
  market_only: 0.30,
  angles_only: 1.00,
  copy_only:   2.00,
  creative_full: 8.00,
  pesquisa:    2.00,
  criativo:    5.00,
  lancamento:  8.00,
  full:        15.00,
};
