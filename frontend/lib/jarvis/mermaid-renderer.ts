// Renderiza um PlannedTask[] como string Mermaid.
// Reused = verde (#1a5f3f), pending = azul (#3b82f6).
// Spec do skill jarvis-planner.md.

import { AgentName } from '../agent-registry';
import { PlannedTask } from './dag-builder';

const AGENT_LABELS: Record<AgentName, string> = {
  // Legado
  avatar_research:      'Avatar',
  market_research:      'Market',
  angle_generator:      'Angles',
  copy_hook_generator:  'Copy',
  anvisa_compliance:    'Compliance',
  video_maker:          'Video',
  niche_curator:        'Niche Curator',
  // Pipeline Ultron
  benchmark_intelligence: 'Benchmark',
  campaign_strategy:      'Campanha',
  script_writer:          'Roteiro',
  character_generator:    'Personagem',
  keyframe_generator:     'Keyframes',
  creative_director:      'Dir. Criativo',
  utm_builder:            'UTMs',
  facebook_ads:           'Facebook Ads',
  google_ads:             'Google Ads',
  performance_analysis:   'Performance',
  scaling_strategy:       'Escala',
};

const COLOR_REUSED = '#1a5f3f';
const COLOR_PENDING = '#3b82f6';

/**
 * Gera diagrama Mermaid LR com nós coloridos por status.
 * IDs de nó são N0, N1, ... (sem espaços) para evitar problemas de parsing.
 */
export function renderMermaid(tasks: PlannedTask[]): string {
  if (tasks.length === 0) return 'graph LR\n  empty["Nenhuma task"]';

  const agentToIdx = new Map<AgentName, number>(tasks.map((t, i) => [t.agent, i]));
  const nodeId = (agent: AgentName) => `N${agentToIdx.get(agent)}`;

  const lines: string[] = ['graph LR'];
  const styles: string[] = [];

  // Declaração dos nós
  for (const task of tasks) {
    const id = nodeId(task.agent);
    const label = AGENT_LABELS[task.agent] ?? task.agent;
    const suffix = task.status === 'reused' ? ' ✓ reused' : ' NEW';
    lines.push(`  ${id}["${label}${suffix}"]`);
  }

  // Arestas
  for (const task of tasks) {
    const toId = nodeId(task.agent);
    for (const dep of task.depends_on) {
      const fromId = nodeId(dep);
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  // Estilos por status
  for (const task of tasks) {
    const id = nodeId(task.agent);
    const color = task.status === 'reused' ? COLOR_REUSED : COLOR_PENDING;
    styles.push(`  style ${id} fill:${color},color:#fff`);
  }

  return [...lines, ...styles].join('\n');
}
