/**
 * Testes do Planner — Fase 2.5.5
 * Cobre: 5 goals × 3 estados de cache (cold/parcial/full) + force_refresh + cycle detection
 *
 * Executar: npx tsx frontend/lib/jarvis/__tests__/planner.test.ts
 * (rodado a partir da raiz do projeto)
 */

import { planPipeline } from '../planner';
import {
  resolveAgentDependencies,
  topologicalSort,
  buildDependsOn,
} from '../dag-builder';
import {
  AGENT_REGISTRY,
  GOAL_TO_DELIVERABLE,
  AgentName,
  AgentCapability,
  ArtifactType,
} from '../../agent-registry';
import { renderMermaid } from '../mermaid-renderer';

// ── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FALHOU: ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// Supabase mock que simula diferentes estados de cache por artifact
function makeMockSupabase(freshArtifacts: ArtifactType[]): any {
  return {
    from: () => ({
      select: () => ({
        eq: function (..._args: any[]) { return this; },
        gte: function (..._args: any[]) { return this; },
        order: function (..._args: any[]) { return this; },
        limit: function (..._args: any[]) { return this; },
        maybeSingle: async () => {
          // O último .eq('artifact_type', X) determina o artifact consultado.
          // Simulamos retornando fresh apenas para os artifacts da lista.
          // Como não temos o contexto do artifact_type aqui, injetamos via closure abaixo.
          return { data: null, error: null };
        },
      }),
    }),
  };
}

// Mock com rastreamento de artifact_type
function makeFreshCheckMock(freshArtifacts: Set<ArtifactType>) {
  return {
    from: (_table: string) => {
      let capturedArtifactType: ArtifactType | null = null;
      const chain = {
        select: () => chain,
        eq: (col: string, val: any) => {
          if (col === 'artifact_type') capturedArtifactType = val as ArtifactType;
          return chain;
        },
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (capturedArtifactType && freshArtifacts.has(capturedArtifactType)) {
            return { data: { id: `mock-knowledge-${capturedArtifactType}` }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

const PRODUCT_ID = '00000000-0000-0000-0000-000000000001';

// ── Suite 1: dag-builder (funções puras) ────────────────────────────────────

section('dag-builder — resolveAgentDependencies');

{
  const agents = resolveAgentDependencies('avatar', AGENT_REGISTRY);
  assert(agents.includes('avatar_research'), 'avatar_only resolve avatar_research');
  assert(agents.length === 1, 'avatar_only resolve apenas 1 agente');
}

{
  const agents = resolveAgentDependencies('market', AGENT_REGISTRY);
  assert(agents.includes('market_research'), 'market_only resolve market_research');
  assert(agents.length === 1, 'market_only resolve apenas 1 agente');
}

{
  const agents = resolveAgentDependencies('angles', AGENT_REGISTRY);
  assert(agents.includes('angle_generator'), 'angles resolve angle_generator');
  assert(agents.includes('avatar_research'), 'angles resolve avatar_research transitivamente');
  assert(agents.includes('market_research'), 'angles resolve market_research transitivamente');
  assert(agents.length === 3, 'angles resolve exatamente 3 agentes');
}

{
  const agents = resolveAgentDependencies('copy_components', AGENT_REGISTRY);
  assert(agents.includes('copy_hook_generator'), 'copy resolve copy_hook_generator');
  assert(agents.includes('avatar_research'), 'copy resolve avatar_research');
  assert(agents.includes('angle_generator'), 'copy resolve angle_generator');
  // angle_generator requer market → copy_only também puxa market_research
  assert(agents.includes('market_research'), 'copy resolve market_research (via angle_generator)');
}

{
  // creative_full: video_maker requer copy_combinations_selected (external) + product (external)
  // Mas o planner não consegue produzir copy_combinations_selected via agente — é approval do usuário.
  // Portanto video_maker requer aprovação externa; o planner deve incluí-lo mesmo assim.
  const agents = resolveAgentDependencies('video_assets', AGENT_REGISTRY);
  assert(agents.includes('video_maker'), 'creative_full resolve video_maker');
  // copy_combinations_selected é EXTERNAL_INPUT, então copy_hook_generator + predecessores também entram
  assert(agents.includes('copy_hook_generator'), 'creative_full resolve copy_hook_generator');
  assert(agents.includes('anvisa_compliance'), 'creative_full resolve anvisa_compliance');
}

section('dag-builder — topologicalSort');

{
  const agents = resolveAgentDependencies('angles', AGENT_REGISTRY);
  const sorted = topologicalSort(agents, AGENT_REGISTRY);
  const avatarIdx = sorted.indexOf('avatar_research');
  const marketIdx = sorted.indexOf('market_research');
  const angleIdx = sorted.indexOf('angle_generator');
  assert(avatarIdx < angleIdx, 'avatar_research vem antes de angle_generator');
  assert(marketIdx < angleIdx, 'market_research vem antes de angle_generator');
}

{
  const agents = resolveAgentDependencies('copy_components', AGENT_REGISTRY);
  const sorted = topologicalSort(agents, AGENT_REGISTRY);
  const copyIdx = sorted.indexOf('copy_hook_generator');
  const avatarIdx = sorted.indexOf('avatar_research');
  const angleIdx = sorted.indexOf('angle_generator');
  assert(avatarIdx < angleIdx, 'copy: avatar antes de angle');
  assert(angleIdx < copyIdx, 'copy: angle antes de copy_hook_generator');
}

section('dag-builder — cycle detection');

{
  const cyclicRegistry: Record<AgentName, AgentCapability> = {
    ...AGENT_REGISTRY,
    avatar_research: {
      ...AGENT_REGISTRY.avatar_research,
      requires: ['angles'], // ciclo: avatar requer angles, angles requer avatar
    },
  };
  let threw = false;
  try {
    const agents: AgentName[] = ['avatar_research', 'angle_generator'];
    topologicalSort(agents, cyclicRegistry);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'topologicalSort lança erro ao detectar ciclo');
}

section('dag-builder — buildDependsOn');

{
  const allAgents = resolveAgentDependencies('copy_components', AGENT_REGISTRY);
  const sorted = topologicalSort(allAgents, AGENT_REGISTRY);
  const deps = buildDependsOn('copy_hook_generator', sorted, AGENT_REGISTRY);
  assert(deps.includes('avatar_research'), 'copy_hook_generator depende de avatar_research');
  assert(deps.includes('angle_generator'), 'copy_hook_generator depende de angle_generator');
  assert(!deps.includes('market_research'), 'copy_hook_generator não depende de market_research diretamente');
}

// ── Suite 2: mermaid-renderer ───────────────────────────────────────────────

section('mermaid-renderer');

{
  const tasks = [
    {
      agent: 'avatar_research' as AgentName,
      status: 'reused' as const,
      produces: ['avatar' as ArtifactType],
      requires: ['product' as ArtifactType],
      depends_on: [],
      estimated_cost_usd: 0,
    },
    {
      agent: 'angle_generator' as AgentName,
      status: 'pending' as const,
      produces: ['angles' as ArtifactType],
      requires: ['product' as ArtifactType, 'avatar' as ArtifactType, 'market' as ArtifactType],
      depends_on: ['avatar_research' as AgentName],
      estimated_cost_usd: 0.012,
    },
  ];
  const mermaid = renderMermaid(tasks);
  assert(mermaid.startsWith('graph LR'), 'começa com graph LR');
  assert(mermaid.includes('✓ reused'), 'nó reused tem label ✓ reused');
  assert(mermaid.includes('NEW'), 'nó pending tem label NEW');
  assert(mermaid.includes('#1a5f3f'), 'reused tem cor verde');
  assert(mermaid.includes('#3b82f6'), 'pending tem cor azul');
  assert(mermaid.includes('-->'), 'tem aresta de dependência');
}

{
  const mermaid = renderMermaid([]);
  assert(mermaid.includes('Nenhuma task'), 'lista vazia renderiza mensagem vazia');
}

// ── Suite 3: planPipeline — 5 goals × cold start ────────────────────────────

section('planPipeline — cold start (nenhum cache)');

const coldClient = makeFreshCheckMock(new Set([]));

async function testGoalCold(goal: Parameters<typeof planPipeline>[0]) {
  const plan = await planPipeline(goal, PRODUCT_ID, false, coldClient as any);
  const deliverable = GOAL_TO_DELIVERABLE[goal];
  assert(plan.goal === goal, `${goal}: goal correto`);
  assert(plan.deliverable === deliverable, `${goal}: deliverable correto`);
  assert(plan.tasks.length > 0, `${goal}: tem tasks`);
  assert(plan.tasks.every(t => t.status === 'pending'), `${goal}: cold → todas pending`);
  assert(plan.mermaid.startsWith('graph LR'), `${goal}: mermaid gerado`);
  assert(plan.estimated_cost_usd > 0, `${goal}: custo estimado > 0`);
  assert(plan.budget_usd > 0, `${goal}: budget definido`);
}

// ── Suite 4: planPipeline — cache parcial ───────────────────────────────────

section('planPipeline — cache parcial (avatar fresco, resto cold)');

async function testPartialCache() {
  const partialClient = makeFreshCheckMock(new Set<ArtifactType>(['avatar']));

  // angles_only: precisa avatar + market + angle_generator
  const plan = await planPipeline('angles_only', PRODUCT_ID, false, partialClient as any);

  const avatar = plan.tasks.find(t => t.agent === 'avatar_research');
  const market = plan.tasks.find(t => t.agent === 'market_research');
  const angle = plan.tasks.find(t => t.agent === 'angle_generator');

  assert(avatar?.status === 'reused', 'parcial: avatar_research reused');
  assert(market?.status === 'pending', 'parcial: market_research pending');
  assert(angle?.status === 'pending', 'parcial: angle_generator pending');
  assert(avatar?.source_knowledge_id?.startsWith('mock-knowledge-') ?? false, 'parcial: knowledge_id preenchido');
  assert(
    plan.estimated_cost_usd < (await planPipeline('angles_only', PRODUCT_ID, false, coldClient as any)).estimated_cost_usd,
    'parcial: custo menor que cold'
  );
}

// ── Suite 5: planPipeline — cache total ─────────────────────────────────────

section('planPipeline — cache full (todos artefatos cacheáveis frescos)');

async function testFullCache() {
  // angles_only tem 3 agentes, 2 cacheáveis (avatar e market — angle também é cacheável)
  const fullClient = makeFreshCheckMock(new Set<ArtifactType>(['avatar', 'market', 'angles']));

  const plan = await planPipeline('angles_only', PRODUCT_ID, false, fullClient as any);

  assert(
    plan.tasks.every(t => t.status === 'reused'),
    'full cache: todas as tasks reused'
  );
  assert(plan.estimated_cost_usd === 0, 'full cache: custo estimado = 0');
  assert(plan.mermaid.includes('#1a5f3f'), 'full cache: todos nós verdes');
  assert(!plan.mermaid.includes('#3b82f6'), 'full cache: nenhum nó azul');
}

// ── Suite 6: force_refresh ──────────────────────────────────────────────────

section('planPipeline — force_refresh ignora cache');

async function testForceRefresh() {
  const fullClient = makeFreshCheckMock(new Set<ArtifactType>(['avatar', 'market', 'angles']));

  const plan = await planPipeline('angles_only', PRODUCT_ID, true, fullClient as any);

  assert(
    plan.tasks.every(t => t.status === 'pending'),
    'force_refresh: todas pending mesmo com cache cheio'
  );
  assert(plan.estimated_cost_usd > 0, 'force_refresh: custo > 0');
}

// ── Suite 7: checkpoints ────────────────────────────────────────────────────

section('planPipeline — checkpoints por goal');

async function testCheckpoints() {
  const client = makeFreshCheckMock(new Set([]));

  const copyPlan = await planPipeline('copy_only', PRODUCT_ID, false, client as any);
  assert(copyPlan.checkpoints.length === 1, 'copy_only: 1 checkpoint');
  assert(copyPlan.checkpoints[0].type === 'component_approval', 'copy_only: checkpoint é component_approval');

  const creativePlan = await planPipeline('creative_full', PRODUCT_ID, false, client as any);
  assert(creativePlan.checkpoints.length === 2, 'creative_full: 2 checkpoints');

  const avatarPlan = await planPipeline('avatar_only', PRODUCT_ID, false, client as any);
  assert(avatarPlan.checkpoints.length === 0, 'avatar_only: sem checkpoints');
}

// ── Suite 8: depends_on correto no plano ────────────────────────────────────

section('planPipeline — depends_on nas tasks');

async function testDependsOn() {
  const client = makeFreshCheckMock(new Set([]));
  const plan = await planPipeline('copy_only', PRODUCT_ID, false, client as any);

  const copy = plan.tasks.find(t => t.agent === 'copy_hook_generator')!;
  assert(copy.depends_on.includes('avatar_research'), 'copy: depende de avatar_research');
  assert(copy.depends_on.includes('angle_generator'), 'copy: depende de angle_generator');

  const angle = plan.tasks.find(t => t.agent === 'angle_generator')!;
  assert(angle.depends_on.includes('avatar_research'), 'angle: depende de avatar_research');
  assert(angle.depends_on.includes('market_research'), 'angle: depende de market_research');

  const avatar = plan.tasks.find(t => t.agent === 'avatar_research')!;
  assert(avatar.depends_on.length === 0, 'avatar: sem dependências de agentes');
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  await testGoalCold('avatar_only');
  await testGoalCold('market_only');
  await testGoalCold('angles_only');
  await testGoalCold('copy_only');
  await testGoalCold('creative_full');

  await testPartialCache();
  await testFullCache();
  await testForceRefresh();
  await testCheckpoints();
  await testDependsOn();

  console.log(`\n═══════════════════════════════`);
  console.log(`Resultado: ${passed} passou, ${failed} falhou`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\nErro inesperado:', err);
  process.exit(1);
});
