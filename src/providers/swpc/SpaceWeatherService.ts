import { DataCache, type CacheEntry } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { SpaceWeatherFeed } from '../../features/space-weather/types';
import { SwpcProvider } from './SwpcProvider';

const CACHE_KEY = 'swpc:space-weather:v1';
const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'swpc-products-v1';

function cachedSnapshot(entry: CacheEntry<SpaceWeatherFeed>, freshness: Freshness): DataSnapshot<SpaceWeatherFeed> {
  return {
    provider: 'swpc',
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: 'forecast',
    freshness,
    data: entry.value,
  };
}

export interface SpaceWeatherLoadOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export class SpaceWeatherService {
  readonly #cache: DataCache;
  #memory: DataSnapshot<SpaceWeatherFeed> | null = null;

  constructor(cache = new DataCache()) { this.#cache = cache; }

  async load(options: SpaceWeatherLoadOptions = {}): Promise<DataSnapshot<SpaceWeatherFeed>> {
    const provider = new SwpcProvider();
    const now = Date.now();
    if (!options.forceRefresh && this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.ttlMs) {
      return { ...this.#memory, freshness: this.#memory.freshness === 'fresh' ? 'cached' : this.#memory.freshness };
    }

    let cached: CacheEntry<SpaceWeatherFeed> | undefined;
    try { cached = await this.#cache.get<SpaceWeatherFeed>(CACHE_KEY); } catch { /* IndexedDB can be unavailable */ }
    if (!options.forceRefresh && cached && now <= cached.expiresAt) {
      const snapshot = cachedSnapshot(cached, 'cached');
      this.#memory = snapshot;
      return snapshot;
    }

    try {
      const raw = await provider.fetchRaw(options.signal);
      const data = provider.normalize(raw);
      if (!provider.validate(data)) throw new Error('NOAA SWPC returned an invalid space-weather snapshot.');
      const snapshot: DataSnapshot<SpaceWeatherFeed> = {
        provider: 'swpc', fetchedAt: now, sourceUpdatedAt: data.sourceUpdatedAt,
        temporalType: 'forecast', freshness: 'fresh', data,
      };
      this.#memory = snapshot;
      try {
        await this.#cache.set({
          key: CACHE_KEY, provider: 'swpc', fetchedAt: now, sourceUpdatedAt: data.sourceUpdatedAt,
          expiresAt: now + provider.cachePolicy.ttlMs, schemaVersion: CACHE_SCHEMA_VERSION,
          providerVersion: PROVIDER_VERSION, value: data,
        });
      } catch { /* fail open */ }
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = cachedSnapshot(cached, 'stale'); this.#memory = snapshot; return snapshot;
      }
      if (this.#memory && now - this.#memory.fetchedAt <= provider.cachePolicy.staleForMs) {
        this.#memory = { ...this.#memory, freshness: 'stale' }; return this.#memory;
      }
      throw error;
    }
  }
}
