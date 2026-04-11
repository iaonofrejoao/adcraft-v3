/**
 * Canonical tagging implementation for AdCraft v2.
 * This file is a duplicate of workers/lib/tagging.ts.
 * The frontend cannot cross-import from workers/ (Next.js bundler moduleResolution),
 * so both packages keep identical copies. If you change one, change the other.
 *
 * Format:
 *   Hook:        SKU_v{N}_H{n}
 *   Body:        SKU_v{N}_B{n}
 *   CTA:         SKU_v{N}_C{n}
 *   Combination: SKU_v{N}_H{n}_B{n}_C{n}
 *   Video:       SKU_v{N}_H{n}_B{n}_C{n}_V{n}
 *
 * Rules:
 *   - SKU: exactly 4 uppercase letters [A-Z]{4}
 *   - version: integer >= 1
 *   - H/B/C slots: integer in {1, 2, 3}
 *   - V slot: integer >= 1
 */

export type TagType = 'hook' | 'body' | 'cta' | 'combination' | 'video';

export interface TagParts {
  sku: string;
  version: number;
  hookSlot?: number;
  bodySlot?: number;
  ctaSlot?: number;
  videoSlot?: number;
  type: TagType;
}

const SKU_RE = /^[A-Z]{4}$/;
const COMPONENT_SLOTS = new Set([1, 2, 3]);

function assertSku(sku: string): void {
  if (!SKU_RE.test(sku)) {
    throw new Error(`Invalid SKU "${sku}": must be exactly 4 uppercase letters (A-Z)`);
  }
}

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid version ${version}: must be a positive integer >= 1`);
  }
}

function assertComponentSlot(slot: number, label: string): void {
  if (!COMPONENT_SLOTS.has(slot)) {
    throw new Error(`Invalid ${label} slot ${slot}: must be 1, 2, or 3`);
  }
}

function assertVideoSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1) {
    throw new Error(`Invalid video slot ${slot}: must be a positive integer >= 1`);
  }
}

export function buildHookTag(sku: string, version: number, slot: number): string {
  assertSku(sku);
  assertVersion(version);
  assertComponentSlot(slot, 'hook');
  return `${sku}_v${version}_H${slot}`;
}

export function buildBodyTag(sku: string, version: number, slot: number): string {
  assertSku(sku);
  assertVersion(version);
  assertComponentSlot(slot, 'body');
  return `${sku}_v${version}_B${slot}`;
}

export function buildCtaTag(sku: string, version: number, slot: number): string {
  assertSku(sku);
  assertVersion(version);
  assertComponentSlot(slot, 'cta');
  return `${sku}_v${version}_C${slot}`;
}

export function buildCombinationTag(
  sku: string,
  version: number,
  h: number,
  b: number,
  c: number,
): string {
  assertSku(sku);
  assertVersion(version);
  assertComponentSlot(h, 'hook');
  assertComponentSlot(b, 'body');
  assertComponentSlot(c, 'cta');
  return `${sku}_v${version}_H${h}_B${b}_C${c}`;
}

export function buildVideoTag(
  sku: string,
  version: number,
  h: number,
  b: number,
  c: number,
  v: number,
): string {
  assertSku(sku);
  assertVersion(version);
  assertComponentSlot(h, 'hook');
  assertComponentSlot(b, 'body');
  assertComponentSlot(c, 'cta');
  assertVideoSlot(v);
  return `${sku}_v${version}_H${h}_B${b}_C${c}_V${v}`;
}

const TAG_RE =
  /^[A-Z]{4}_v\d+(_H[1-3]_B[1-3]_C[1-3](_V\d+)?)?$|^[A-Z]{4}_v\d+_[HBC][1-3]$/;

export function validateTag(tag: string): boolean {
  return TAG_RE.test(tag);
}

export function parseTag(tag: string): TagParts | null {
  if (!validateTag(tag)) return null;

  const parts = tag.split('_');
  const sku = parts[0];
  const version = parseInt(parts[1].slice(1), 10);

  // Combination or video: SKU_vN_H{n}_B{n}_C{n}[_V{n}]
  const combRe = /^[A-Z]{4}_v(\d+)_H([1-3])_B([1-3])_C([1-3])(_V(\d+))?$/;
  const combMatch = tag.match(combRe);
  if (combMatch) {
    const hasVideo = combMatch[5] !== undefined;
    return {
      sku,
      version,
      hookSlot: parseInt(combMatch[2], 10),
      bodySlot: parseInt(combMatch[3], 10),
      ctaSlot: parseInt(combMatch[4], 10),
      ...(hasVideo ? { videoSlot: parseInt(combMatch[6], 10) } : {}),
      type: hasVideo ? 'video' : 'combination',
    };
  }

  // Single component: SKU_vN_H{n} | SKU_vN_B{n} | SKU_vN_C{n}
  const compRe = /^[A-Z]{4}_v\d+_([HBC])([1-3])$/;
  const compMatch = tag.match(compRe);
  if (compMatch) {
    const letter = compMatch[1];
    const slot = parseInt(compMatch[2], 10);
    const typeMap: Record<string, TagType> = { H: 'hook', B: 'body', C: 'cta' };
    return {
      sku,
      version,
      ...(letter === 'H' ? { hookSlot: slot } : {}),
      ...(letter === 'B' ? { bodySlot: slot } : {}),
      ...(letter === 'C' ? { ctaSlot: slot } : {}),
      type: typeMap[letter],
    };
  }

  // SKU_vN (no component suffix — base tag)
  return { sku, version, type: 'combination' };
}
