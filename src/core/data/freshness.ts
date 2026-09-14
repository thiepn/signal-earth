export type Freshness = 'fresh' | 'aging' | 'stale' | 'cached' | 'unavailable';

export interface FreshnessPolicy {
  freshForMs: number;
  staleAfterMs: number;
}

export function classifyFreshness(
  fetchedAt: number,
  now: number,
  policy: FreshnessPolicy,
  isCached = false,
): Freshness {
  if (!Number.isFinite(fetchedAt) || !Number.isFinite(now)) return 'unavailable';
  const age = Math.max(0, now - fetchedAt);
  if (age <= policy.freshForMs) return isCached ? 'cached' : 'fresh';
  if (age < policy.staleAfterMs) return 'aging';
  return 'stale';
}
