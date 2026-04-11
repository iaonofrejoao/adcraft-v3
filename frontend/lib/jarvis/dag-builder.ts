// DAG builder: resolve dependências e ordena agentes topologicamente.
// Usado pelo planner para montar o plano sem sequência hardcoded (regra 14).

import { AgentName, ArtifactType, AgentCapability, AGENT_REGISTRY } from '../agent-registry';

export type TaskStatus = 'pending' | 'reused';

export interface PlannedTask {
  agent: AgentName;
  status: TaskStatus;
  produces: ArtifactType[];
  requires: ArtifactType[];
  depends_on: AgentName[]; // agentes que devem completar antes
  source_knowledge_id?: string; // preenchido quando status='reused'
  estimated_cost_usd?: number;
}

// Artifacts que são fornecidos como input externo — não produzidos por nenhum agente.
const EXTERNAL_INPUTS: Set<ArtifactType> = new Set<ArtifactType>(['product']);

/**
 * Artifacts produzidos por checkpoints humanos (não agentes), mas que dependem
 * de artifacts upstream para que o usuário possa selecioná-los.
 * Ex: o usuário só pode selecionar combinações depois que `compliance_results` existe.
 */
const CHECKPOINT_PREREQUISITES: Partial<Record<ArtifactType, ArtifactType[]>> = {
  copy_combinations_selected: ['compliance_results'],
};

/**
 * BFS reverso: a partir do deliverable, coleta todos os agentes necessários
 * transitivamente, seguindo as dependências declaradas no registry.
 */
export function resolveAgentDependencies(
  deliverable: ArtifactType,
  registry: Record<AgentName, AgentCapability> = AGENT_REGISTRY
): AgentName[] {
  const needed = new Set<AgentName>();
  const queue: ArtifactType[] = [deliverable];
  const visitedArtifacts = new Set<ArtifactType>();

  while (queue.length > 0) {
    const artifact = queue.shift()!;
    if (visitedArtifacts.has(artifact)) continue;
    visitedArtifacts.add(artifact);

    if (EXTERNAL_INPUTS.has(artifact)) continue;

    // Artifact de checkpoint humano: não tem agente produtor, mas tem pré-requisitos.
    const checkpointPrereqs = CHECKPOINT_PREREQUISITES[artifact];
    if (checkpointPrereqs) {
      for (const prereq of checkpointPrereqs) {
        if (!visitedArtifacts.has(prereq)) queue.push(prereq);
      }
      continue;
    }

    const entry = (Object.entries(registry) as [AgentName, AgentCapability][])
      .find(([, cap]) => cap.produces.includes(artifact));

    if (!entry) continue;

    const [agentName, capability] = entry;
    needed.add(agentName);

    for (const req of capability.requires) {
      if (!visitedArtifacts.has(req)) {
        queue.push(req);
      }
    }
  }

  return [...needed];
}

/**
 * Ordenação topológica via algoritmo de Kahn.
 * Lança erro se detectar ciclo no grafo.
 */
export function topologicalSort(
  agents: AgentName[],
  registry: Record<AgentName, AgentCapability> = AGENT_REGISTRY
): AgentName[] {
  const agentSet = new Set(agents);

  // artifact → agente que o produz (dentro do conjunto)
  const producerOf = new Map<ArtifactType, AgentName>();
  for (const name of agents) {
    for (const artifact of registry[name].produces) {
      producerOf.set(artifact, name);
    }
  }

  // Grafo de dependências: from (produtor) → [to (consumidor)]
  const edges = new Map<AgentName, AgentName[]>(agents.map(a => [a, []]));
  const inDegree = new Map<AgentName, number>(agents.map(a => [a, 0]));

  for (const name of agents) {
    for (const req of registry[name].requires) {
      const producer = producerOf.get(req);
      if (producer && agentSet.has(producer)) {
        edges.get(producer)!.push(name);
        inDegree.set(name, inDegree.get(name)! + 1);
      }
    }
  }

  // Kahn: começa pelos nós sem dependências
  const queue: AgentName[] = agents.filter(a => inDegree.get(a) === 0);
  const sorted: AgentName[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const dependent of edges.get(current)!) {
      const newDegree = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== agents.length) {
    const missing = agents.filter(a => !sorted.includes(a));
    throw new Error(
      `Ciclo detectado no grafo de dependências dos agentes: ${missing.join(', ')}`
    );
  }

  return sorted;
}

/**
 * Retorna quais agentes (do conjunto dado) devem completar antes de `agent`.
 * Usado para preencher `depends_on` de cada PlannedTask.
 */
export function buildDependsOn(
  agent: AgentName,
  allAgents: AgentName[],
  registry: Record<AgentName, AgentCapability> = AGENT_REGISTRY
): AgentName[] {
  const agentSet = new Set(allAgents);

  const producerOf = new Map<ArtifactType, AgentName>();
  for (const name of allAgents) {
    for (const artifact of registry[name].produces) {
      producerOf.set(artifact, name);
    }
  }

  const deps: AgentName[] = [];
  for (const req of registry[agent].requires) {
    const producer = producerOf.get(req);
    if (producer && agentSet.has(producer)) {
      deps.push(producer);
    }
  }
  return deps;
}
