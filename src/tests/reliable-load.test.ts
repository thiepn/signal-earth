import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataCache, CacheEntry } from '../core/data/DataCache';
import type { ProviderAdapter } from '../core/data/ProviderAdapter';
import { loadReliableSnapshot } from '../core/data/reliableLoad';
import { providerHealthRegistry, RequestCoordinator } from '../core/data/reliability';
import { SOURCE_REGISTRY } from '../core/data/sourceRegistry';

interface RawPayload { value: number; timestamp: number; }
interface NormalizedPayload { value: number; timestamp: number; partial: boolean; }

function provider(fetchRaw: ProviderAdapter<RawPayload, NormalizedPayload>['fetchRaw']): ProviderAdapter<RawPayload, NormalizedPayload> & { readonly id: 'usgs' } {
  return {
    id: 'usgs',
    source: SOURCE_REGISTRY.usgs,
    temporalType: 'observed',
    cachePolicy: { ttlMs: 1_000, staleForMs: 60_000 },
    fetchRaw,
    normalize: (raw) => ({ value: raw.value, timestamp: raw.timestamp, partial: false }),
    validate: (data) => Number.isFinite(data.value) && Number.isFinite(data.timestamp),
  };
}

function fakeCache(entry?: CacheEntry<NormalizedPayload>) {
  const state = { entry };
  const api = {
    get: vi.fn(async () => state.entry),
    set: vi.fn(async (next: CacheEntry<NormalizedPayload>) => { state.entry = next; }),
    delete: vi.fn(async () => { state.entry = undefined; }),
    clearProvider: vi.fn(async () => {}),
  };
  return { state, api, cache: api as unknown as DataCache };
}

describe('reliable provider loading', () => {
  beforeEach(() => {
    providerHealthRegistry.reset();
    vi.useRealTimers();
  });

  it('deletes invalid cached data before accepting a validated network replacement', async () => {
    const now = Date.now();
    const cache = fakeCache({
      key: 'test', provider: 'usgs', fetchedAt: now - 100, sourceUpdatedAt: now - 100,
      expiresAt: now + 500, schemaVersion: 1, providerVersion: 'old',
      value: { value: 1, timestamp: now - 100, partial: false },
    });
    let memory: import('../core/data/ProviderAdapter').DataSnapshot<NormalizedPayload> | null = null;
    const testProvider = provider(async () => ({ value: 2, timestamp: Date.now() }));

    const snapshot = await loadReliableSnapshot({
      provider: testProvider,
      cache: cache.cache,
      cacheKey: 'test',
      cacheSchemaVersion: 2,
      providerVersion: 'new',
      memory,
      setMemory: (next) => { memory = next; },
      coordinator: new RequestCoordinator(),
      sourceUpdatedAt: (data) => data.timestamp,
      partial: (data) => data.partial,
      validationAttempts: 1,
    });

    expect(snapshot.freshness).toBe('fresh');
    expect(snapshot.data.value).toBe(2);
    expect(cache.api.delete).toHaveBeenCalledTimes(1);
    expect(cache.api.set).toHaveBeenCalledTimes(1);
    expect(providerHealthRegistry.getSnapshot().find((item) => item.provider === 'usgs')).toMatchObject({
      status: 'live', cacheRecovered: true,
    });
  });

  it('uses a valid stale cache deterministically when refresh retries are exhausted', async () => {
    const now = Date.now();
    const cache = fakeCache({
      key: 'test', provider: 'usgs', fetchedAt: now - 5_000, sourceUpdatedAt: now - 5_000,
      expiresAt: now - 4_000, schemaVersion: 2, providerVersion: 'new',
      value: { value: 7, timestamp: now - 5_000, partial: false },
    });
    const fetchRaw = vi.fn(async () => { throw new Error('USGS request failed (503)'); });
    const testProvider = provider(fetchRaw);

    const snapshot = await loadReliableSnapshot({
      provider: testProvider,
      cache: cache.cache,
      cacheKey: 'test',
      cacheSchemaVersion: 2,
      providerVersion: 'new',
      memory: null,
      setMemory: () => {},
      coordinator: new RequestCoordinator(),
      sourceUpdatedAt: (data) => data.timestamp,
      validationAttempts: 2,
    });

    expect(snapshot.freshness).toBe('stale');
    expect(snapshot.data.value).toBe(7);
    expect(fetchRaw).toHaveBeenCalledTimes(2);
    expect(providerHealthRegistry.getSnapshot().find((item) => item.provider === 'usgs')).toMatchObject({
      status: 'stale', consecutiveFailures: 1,
    });
  });

  it('rejects implausible future source timestamps instead of caching them', async () => {
    const cache = fakeCache();
    const testProvider = provider(async () => ({ value: 3, timestamp: Date.now() + 24 * 60 * 60_000 }));

    await expect(loadReliableSnapshot({
      provider: testProvider,
      cache: cache.cache,
      cacheKey: 'test',
      cacheSchemaVersion: 2,
      providerVersion: 'new',
      memory: null,
      setMemory: () => {},
      coordinator: new RequestCoordinator(),
      sourceUpdatedAt: (data) => data.timestamp,
      validationAttempts: 1,
    })).rejects.toMatchObject({ kind: 'validation' });

    expect(cache.api.set).not.toHaveBeenCalled();
    expect(providerHealthRegistry.getSnapshot().find((item) => item.provider === 'usgs')).toMatchObject({ status: 'error' });
  });

  it('times out a hung provider attempt and falls back to valid stale data', async () => {
    const now = Date.now();
    const cache = fakeCache({
      key: 'test', provider: 'usgs', fetchedAt: now - 5_000, sourceUpdatedAt: now - 5_000,
      expiresAt: now - 4_000, schemaVersion: 2, providerVersion: 'new',
      value: { value: 9, timestamp: now - 5_000, partial: false },
    });
    const fetchRaw = vi.fn(() => new Promise<RawPayload>(() => {}));

    const snapshot = await loadReliableSnapshot({
      provider: provider(fetchRaw),
      cache: cache.cache,
      cacheKey: 'test',
      cacheSchemaVersion: 2,
      providerVersion: 'new',
      memory: null,
      setMemory: () => {},
      coordinator: new RequestCoordinator(),
      sourceUpdatedAt: (data) => data.timestamp,
      validationAttempts: 1,
      requestTimeoutMs: 20,
    });

    expect(snapshot.freshness).toBe('stale');
    expect(snapshot.data.value).toBe(9);
    expect(fetchRaw).toHaveBeenCalledTimes(1);
  });

});
