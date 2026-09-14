import { DataCache, type CacheEntry } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { EarthquakeFeed, EarthquakeTimeWindow } from '../../features/seismic/types';
import { UsgsEarthquakeProvider } from './UsgsEarthquakeProvider';

const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'usgs-feed-v1';

function cacheKey(window: EarthquakeTimeWindow): string {
  return `usgs:earthquakes:${window}`;
}

function cachedSnapshot(entry: CacheEntry<EarthquakeFeed>, freshness: Freshness): DataSnapshot<EarthquakeFeed> {
  return {
    provider: 'usgs',
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: 'observed',
    freshness,
    data: entry.value,
  };
}

export interface EarthquakeLoadOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export class EarthquakeService {
  readonly #cache: DataCache;
  readonly #memory = new Map<EarthquakeTimeWindow, DataSnapshot<EarthquakeFeed>>();

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(window: EarthquakeTimeWindow, options: EarthquakeLoadOptions = {}): Promise<DataSnapshot<EarthquakeFeed>> {
    const provider = new UsgsEarthquakeProvider(window);
    const now = Date.now();
    const memory = this.#memory.get(window);

    if (!options.forceRefresh && memory && now - memory.fetchedAt <= provider.cachePolicy.ttlMs) {
      return { ...memory, freshness: memory.freshness === 'fresh' ? 'cached' : memory.freshness };
    }

    let cached: CacheEntry<EarthquakeFeed> | undefined;
    try {
      cached = await this.#cache.get<EarthquakeFeed>(cacheKey(window));
    } catch {
      // IndexedDB can be unavailable in privacy modes; network remains authoritative.
    }

    if (!options.forceRefresh && cached && now <= cached.expiresAt) {
      const snapshot = cachedSnapshot(cached, 'cached');
      this.#memory.set(window, snapshot);
      return snapshot;
    }

    try {
      const raw = await provider.fetchRaw(options.signal);
      const data = provider.normalize(raw);
      if (!provider.validate(data)) throw new Error('USGS returned an invalid earthquake feed.');

      const snapshot: DataSnapshot<EarthquakeFeed> = {
        provider: 'usgs',
        fetchedAt: now,
        sourceUpdatedAt: data.generatedAt,
        temporalType: 'observed',
        freshness: 'fresh',
        data,
      };
      this.#memory.set(window, snapshot);

      const entry: CacheEntry<EarthquakeFeed> = {
        key: cacheKey(window),
        provider: 'usgs',
        fetchedAt: now,
        sourceUpdatedAt: data.generatedAt,
        expiresAt: now + provider.cachePolicy.ttlMs,
        schemaVersion: CACHE_SCHEMA_VERSION,
        providerVersion: PROVIDER_VERSION,
        value: data,
      };
      try { await this.#cache.set(entry); } catch { /* fail open */ }
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = cachedSnapshot(cached, 'stale');
        this.#memory.set(window, snapshot);
        return snapshot;
      }
      if (memory && now - memory.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot: DataSnapshot<EarthquakeFeed> = { ...memory, freshness: 'stale' };
        this.#memory.set(window, snapshot);
        return snapshot;
      }
      throw error;
    }
  }
}
