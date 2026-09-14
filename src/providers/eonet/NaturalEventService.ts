import { DataCache, type CacheEntry } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { NaturalEventFeed } from '../../features/natural-events/types';
import { EonetProvider } from './EonetProvider';

const CACHE_KEY = 'eonet:natural-events:v1';
const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'eonet-v3-events-v1';

function cachedSnapshot(entry: CacheEntry<NaturalEventFeed>, freshness: Freshness): DataSnapshot<NaturalEventFeed> {
  return {
    provider: 'eonet',
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: 'observed',
    freshness,
    data: entry.value,
  };
}

export interface NaturalEventLoadOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export class NaturalEventService {
  readonly #cache: DataCache;
  #memory: DataSnapshot<NaturalEventFeed> | null = null;

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(options: NaturalEventLoadOptions = {}): Promise<DataSnapshot<NaturalEventFeed>> {
    const provider = new EonetProvider();
    const now = Date.now();
    if (!options.forceRefresh && this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.ttlMs) {
      return { ...this.#memory, freshness: this.#memory.freshness === 'fresh' ? 'cached' : this.#memory.freshness };
    }

    let cached: CacheEntry<NaturalEventFeed> | undefined;
    try { cached = await this.#cache.get<NaturalEventFeed>(CACHE_KEY); } catch { /* IndexedDB can be unavailable */ }
    if (!options.forceRefresh && cached && now <= cached.expiresAt) {
      const snapshot = cachedSnapshot(cached, 'cached');
      this.#memory = snapshot;
      return snapshot;
    }

    try {
      const raw = await provider.fetchRaw(options.signal);
      const data = provider.normalize(raw);
      if (!provider.validate(data)) throw new Error('NASA EONET returned an invalid event feed.');
      const snapshot: DataSnapshot<NaturalEventFeed> = {
        provider: 'eonet',
        fetchedAt: now,
        sourceUpdatedAt: data.sourceUpdatedAt,
        temporalType: 'observed',
        freshness: 'fresh',
        data,
      };
      this.#memory = snapshot;
      try {
        await this.#cache.set({
          key: CACHE_KEY,
          provider: 'eonet',
          fetchedAt: now,
          sourceUpdatedAt: data.sourceUpdatedAt,
          expiresAt: now + provider.cachePolicy.ttlMs,
          schemaVersion: CACHE_SCHEMA_VERSION,
          providerVersion: PROVIDER_VERSION,
          value: data,
        });
      } catch { /* fail open */ }
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = cachedSnapshot(cached, 'stale');
        this.#memory = snapshot;
        return snapshot;
      }
      if (this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.staleForMs) {
        this.#memory = { ...this.#memory, freshness: 'stale' };
        return this.#memory;
      }
      throw error;
    }
  }
}
