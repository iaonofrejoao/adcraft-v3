import { describe, it, expect } from 'vitest';
import {
  buildHookTag,
  buildBodyTag,
  buildCtaTag,
  buildCombinationTag,
  buildVideoTag,
  parseTag,
  validateTag,
} from './tagging';

// ─── 5 testes: build correto de cada tipo ────────────────────────────────────

describe('build functions — correct output', () => {
  it('buildHookTag returns correct format', () => {
    expect(buildHookTag('ABCD', 1, 2)).toBe('ABCD_v1_H2');
  });

  it('buildBodyTag returns correct format', () => {
    expect(buildBodyTag('XYZW', 3, 1)).toBe('XYZW_v3_B1');
  });

  it('buildCtaTag returns correct format', () => {
    expect(buildCtaTag('TEST', 2, 3)).toBe('TEST_v2_C3');
  });

  it('buildCombinationTag returns correct format', () => {
    expect(buildCombinationTag('PROD', 1, 1, 2, 3)).toBe('PROD_v1_H1_B2_C3');
  });

  it('buildVideoTag returns correct format', () => {
    expect(buildVideoTag('SALE', 5, 2, 3, 1, 4)).toBe('SALE_v5_H2_B3_C1_V4');
  });
});

// ─── 5 testes: roundtrip build → parse → build idêntico ──────────────────────

describe('roundtrip build → parse → build', () => {
  it('hook roundtrip', () => {
    const tag = buildHookTag('ABCD', 1, 1);
    const p = parseTag(tag)!;
    expect(buildHookTag(p.sku, p.version, p.hookSlot!)).toBe(tag);
  });

  it('body roundtrip', () => {
    const tag = buildBodyTag('BODY', 2, 2);
    const p = parseTag(tag)!;
    expect(buildBodyTag(p.sku, p.version, p.bodySlot!)).toBe(tag);
  });

  it('cta roundtrip', () => {
    const tag = buildCtaTag('CTAX', 3, 3);
    const p = parseTag(tag)!;
    expect(buildCtaTag(p.sku, p.version, p.ctaSlot!)).toBe(tag);
  });

  it('combination roundtrip', () => {
    const tag = buildCombinationTag('COMB', 1, 1, 2, 3);
    const p = parseTag(tag)!;
    expect(buildCombinationTag(p.sku, p.version, p.hookSlot!, p.bodySlot!, p.ctaSlot!)).toBe(tag);
  });

  it('video roundtrip', () => {
    const tag = buildVideoTag('VIDE', 2, 3, 2, 1, 7);
    const p = parseTag(tag)!;
    expect(buildVideoTag(p.sku, p.version, p.hookSlot!, p.bodySlot!, p.ctaSlot!, p.videoSlot!)).toBe(tag);
  });
});

// ─── 5 testes: rejeição de SKUs inválidos ────────────────────────────────────

describe('invalid SKUs are rejected', () => {
  it('rejects lowercase SKU', () => {
    expect(() => buildHookTag('abcd', 1, 1)).toThrow(/Invalid SKU/);
  });

  it('rejects 3-letter SKU', () => {
    expect(() => buildHookTag('ABC', 1, 1)).toThrow(/Invalid SKU/);
  });

  it('rejects 5-letter SKU', () => {
    expect(() => buildHookTag('ABCDE', 1, 1)).toThrow(/Invalid SKU/);
  });

  it('rejects numeric SKU', () => {
    expect(() => buildHookTag('1234', 1, 1)).toThrow(/Invalid SKU/);
  });

  it('rejects empty SKU', () => {
    expect(() => buildHookTag('', 1, 1)).toThrow(/Invalid SKU/);
  });
});

// ─── 3 testes: rejeição de versões inválidas ─────────────────────────────────

describe('invalid versions are rejected', () => {
  it('rejects version 0', () => {
    expect(() => buildHookTag('ABCD', 0, 1)).toThrow(/Invalid version/);
  });

  it('rejects negative version', () => {
    expect(() => buildHookTag('ABCD', -1, 1)).toThrow(/Invalid version/);
  });

  it('rejects non-integer version (1.5)', () => {
    expect(() => buildHookTag('ABCD', 1.5, 1)).toThrow(/Invalid version/);
  });
});

// ─── 2 testes: rejeição de slots fora de 1-3 ─────────────────────────────────

describe('invalid component slots are rejected', () => {
  it('rejects slot 0', () => {
    expect(() => buildHookTag('ABCD', 1, 0)).toThrow(/Invalid hook slot/);
  });

  it('rejects slot 4', () => {
    expect(() => buildBodyTag('ABCD', 1, 4)).toThrow(/Invalid body slot/);
  });
});

// ─── Extras: validateTag e parseTag ──────────────────────────────────────────

describe('validateTag', () => {
  it('accepts valid hook tag', () => {
    expect(validateTag('ABCD_v1_H1')).toBe(true);
  });

  it('accepts valid combination tag', () => {
    expect(validateTag('ABCD_v2_H1_B2_C3')).toBe(true);
  });

  it('accepts valid video tag', () => {
    expect(validateTag('ABCD_v1_H1_B1_C1_V10')).toBe(true);
  });

  it('rejects lowercase sku in tag', () => {
    expect(validateTag('abcd_v1_H1')).toBe(false);
  });

  it('rejects slot 4 in tag', () => {
    expect(validateTag('ABCD_v1_H4')).toBe(false);
  });
});

describe('parseTag', () => {
  it('returns null for invalid tag', () => {
    expect(parseTag('not-a-tag')).toBeNull();
  });

  it('parses hook tag correctly', () => {
    const p = parseTag('PROD_v2_H3');
    expect(p).toMatchObject({ sku: 'PROD', version: 2, hookSlot: 3, type: 'hook' });
  });

  it('parses combination tag correctly', () => {
    const p = parseTag('SALE_v1_H1_B2_C3');
    expect(p).toMatchObject({ sku: 'SALE', version: 1, hookSlot: 1, bodySlot: 2, ctaSlot: 3, type: 'combination' });
  });

  it('parses video tag correctly', () => {
    const p = parseTag('VIDE_v3_H2_B1_C3_V5');
    expect(p).toMatchObject({ sku: 'VIDE', version: 3, hookSlot: 2, bodySlot: 1, ctaSlot: 3, videoSlot: 5, type: 'video' });
  });
});
