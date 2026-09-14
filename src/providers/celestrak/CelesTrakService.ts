import { DataCache, type CacheEntry } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { OrbitCatalog } from '../../features/orbit/types';
import { CelesTrakProvider } from './CelesTrakProvider';

const CACHE_KEY = 'celestrak:orbit:curated-v1';
const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'celestrak-curated-omm-v1';

function cachedSnapshot(entry: CacheEntry<OrbitCatalog>, freshness: Freshness): DataSnapshot<OrbitCatalog> {
  return {
    provider: 'celestrak',
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: 'propagated',
    freshness,
    data: entry.value,
  };
}

export interface OrbitLoadOptions {
  signal?: AbortSignal;
}

export class CelesTrakService {
  readonly #cache: DataCache;
  #memory: DataSnapshot<OrbitCatalog> | null = null;

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(options: OrbitLoadOptions = {}): Promise<DataSnapshot<OrbitCatalog>> {
    const provider = new CelesTrakProvider();
    const now = Date.now();

    // Intentionally no force-refresh escape hatch. CelesTrak's two-hour update
    // cadence is a provider constraint, not merely an optimization.
    if (this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.ttlMs) {
      return { ...this.#memory, freshness: this.#memory.freshness === 'fresh' ? 'cached' : this.#memory.freshness };
    }

    let cached: CacheEntry<OrbitCatalog> | undefined;
    try { cached = await this.#cache.get<OrbitCatalog>(CACHE_KEY); } catch { /* fail open */ }

    if (cached && now <= cached.expiresAt) {
      const snapshot = cachedSnapshot(cached, 'cached');
      this.#memory = snapshot;
      return snapshot;
    }

    try {
      const raw = await provider.fetchRaw(options.signal);
      const data = provider.normalize(raw);
      if (!provider.validate(data)) throw new Error('CelesTrak returned an invalid orbital catalog.');

      const snapshot: DataSnapshot<OrbitCatalog> = {
        provider: 'celestrak',
        fetchedAt: now,
        ...(data.newestElementEpoch === null ? {} : { sourceUpdatedAt: data.newestElementEpoch }),
        temporalType: 'propagated',
        freshness: 'fresh',
        data,
      };
      this.#memory = snapshot;

      const entry: CacheEntry<OrbitCatalog> = {
        key: CACHE_KEY,
        provider: 'celestrak',
        fetchedAt: now,
        ...(data.newestElementEpoch === null ? {} : { sourceUpdatedAt: data.newestElementEpoch }),
        expiresAt: now + provider.cachePolicy.ttlMs,
        schemaVersion: CACHE_SCHEMA_VERSION,
        providerVersion: PROVIDER_VERSION,
        value: data,
      };
      try { await this.#cache.set(entry); } catch { /* privacy mode / quota: network remains authoritative */ }
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = cachedSnapshot(cached, 'stale');
        this.#memory = snapshot;
        return snapshot;
      }
      if (this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot: DataSnapshot<OrbitCatalog> = { ...this.#memory, freshness: 'stale' };
        this.#memory = snapshot;
        return snapshot;
      }
      throw error;
    }
  }
}
