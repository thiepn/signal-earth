import { describe, expect, it } from 'vitest';
import { classifyFreshness } from '../core/data/freshness';

const policy = { freshForMs: 1_000, staleAfterMs: 5_000 };

describe('classifyFreshness', () => {
  it('distinguishes fresh, aging, stale, and cached', () => {
    expect(classifyFreshness(9_500, 10_000, policy)).toBe('fresh');
    expect(classifyFreshness(9_500, 10_000, policy, true)).toBe('cached');
    expect(classifyFreshness(8_000, 10_000, policy)).toBe('aging');
    expect(classifyFreshness(1_000, 10_000, policy)).toBe('stale');
  });
});
