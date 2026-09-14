import { DataCache, type CacheEntry } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { LocalWeather } from '../../features/above-me/types';
import { OpenMeteoProvider } from './OpenMeteoProvider';

const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'open-meteo-current-v1';

function cacheKey(lat: number, lon: number): string {
  return `openmeteo:current:${lat.toFixed(2)},${lon.toFixed(2)}:v1`;
}

function cachedSnapshot(entry: CacheEntry<LocalWeather>, freshness: Freshness): DataSnapshot<LocalWeather> {
  return {
    provider: 'openmeteo',
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: 'forecast',
    freshness,
    data: entry.value,
  };
}

export class LocalWeatherService {
  readonly #cache: DataCache;
  #memory = new Map<string, DataSnapshot<LocalWeather>>();

  constructor(cache = new DataCache()) { this.#cache = cache; }

  async load(lat: number, lon: number, options: { signal?: AbortSignal; forceRefresh?: boolean } = {}): Promise<DataSnapshot<LocalWeather>> {
    const provider = new OpenMeteoProvider(lat, lon);
    const key = cacheKey(lat, lon);
    const now = Date.now();
    const memory = this.#memory.get(key);
    if (!options.forceRefresh && memory && now - memory.fetchedAt <= provider.cachePolicy.ttlMs) {
      return { ...memory, freshness: memory.freshness === 'fresh' ? 'cached' : memory.freshness };
    }

    let cached: CacheEntry<LocalWeather> | undefined;
    try { cached = await this.#cache.get<LocalWeather>(key); } catch { /* IndexedDB unavailable */ }
    if (!options.forceRefresh && cached && now <= cached.expiresAt) {
      const snapshot = cachedSnapshot(cached, 'cached');
      this.#memory.set(key, snapshot);
      return snapshot;
    }

    try {
      const raw = await provider.fetchRaw(options.signal);
      const data = provider.normalize(raw);
      if (!provider.validate(data)) throw new Error('Open-Meteo returned an invalid local-weather snapshot.');
      const snapshot: DataSnapshot<LocalWeather> = {
        provider: 'openmeteo', fetchedAt: now, sourceUpdatedAt: data.timestamp,
        temporalType: 'forecast', freshness: 'fresh', data,
      };
      this.#memory.set(key, snapshot);
      try {
        await this.#cache.set({
          key, provider: 'openmeteo', fetchedAt: now, sourceUpdatedAt: data.timestamp,
          expiresAt: now + provider.cachePolicy.ttlMs,
          schemaVersion: CACHE_SCHEMA_VERSION, providerVersion: PROVIDER_VERSION, value: data,
        });
      } catch { /* fail open */ }
      return snapshot;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = cachedSnapshot(cached, 'stale'); this.#memory.set(key, snapshot); return snapshot;
      }
      if (memory && now - memory.fetchedAt <= provider.cachePolicy.staleForMs) {
        const snapshot = { ...memory, freshness: 'stale' as const }; this.#memory.set(key, snapshot); return snapshot;
      }
      throw error;
    }
  }
}
