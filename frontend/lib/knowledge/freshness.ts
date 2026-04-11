// Política de frescor por artifact_type.
// Fonte de verdade única — espelha freshness_days do AGENT_REGISTRY,
// mas sem importar o registry (evita dependência circular).
// PRD seção 4.1 / Skill: knowledge-layer.md

import type { ArtifactType } from '../agent-registry';

// dias antes do artifact ser considerado stale.
// null = não-cacheável (e.g. copy_components) — sempre regera, nunca é "fresh".
const FRESHNESS_DAYS: Record<ArtifactType, number | null> = {
  product:                       null,  // produto em si nunca tem TTL por regra
  avatar:                          60,  // perfis de avatar mudam lentamente
  market:                          30,  // mercado é mais dinâmico
  angles:                          30,  // ângulos atrelados ao mercado
  copy_components:               null,  // não-cacheável — sempre regera
  compliance_results:            null,  // resultado de compliance não é reutilizado
  copy_combinations_selected:    null,  // combinações não são reaproveitadas
  video_assets:                  null,  // assets de vídeo nunca são reaproveitados
};

/**
 * Retorna o número de dias de frescor para um artifact_type.
 * null = artifact não é cacheável (isFreshEnough sempre retorna false).
 */
export function getFreshnessDays(artifactType: ArtifactType | string): number | null {
  return FRESHNESS_DAYS[artifactType as ArtifactType] ?? null;
}

/**
 * Data de corte para considerar um artifact "fresco".
 * Retorna null se o tipo não for cacheável.
 */
export function getFreshnessCutoff(artifactType: ArtifactType | string): Date | null {
  const days = getFreshnessDays(artifactType);
  if (days === null) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * Verifica se um artifact criado em `createdAt` ainda está dentro da janela de frescor.
 * Sempre retorna false para tipos não-cacheáveis.
 */
export function isFreshEnough(createdAt: Date, artifactType: ArtifactType | string): boolean {
  const cutoff = getFreshnessCutoff(artifactType);
  if (cutoff === null) return false;
  return createdAt >= cutoff;
}
