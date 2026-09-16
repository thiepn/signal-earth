import { DataCache } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import { loadReliableSnapshot, type ReliableLoadOptions } from '../../core/data/reliableLoad';
import { RequestCoordinator } from '../../core/data/reliability';
import type { LocalWeather } from '../../features/above-me/types';
import { OpenMeteoProvider } from './OpenMeteoProvider';

const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'open-meteo-current-v1';

function cacheKey(lat: number, lon: number): string {
  return `openmeteo:current:${lat.toFixed(2)},${lon.toFixed(2)}:v1`;
}

export interface LocalWeatherLoadOptions extends ReliableLoadOptions {}

export class LocalWeatherService {
  readonly #cache: DataCache;
  readonly #coordinator = new RequestCoordinator();
  #memory = new Map<string, DataSnapshot<LocalWeather>>();

  constructor(cache = new DataCache()) { this.#cache = cache; }

  async load(lat: number, lon: number, options: LocalWeatherLoadOptions = {}): Promise<DataSnapshot<LocalWeather>> {
    const provider = new OpenMeteoProvider(lat, lon);
    const key = cacheKey(lat, lon);
    return loadReliableSnapshot({
      provider,
      cache: this.#cache,
      cacheKey: key,
      cacheSchemaVersion: CACHE_SCHEMA_VERSION,
      providerVersion: PROVIDER_VERSION,
      memory: this.#memory.get(key),
      setMemory: (snapshot) => this.#memory.set(key, snapshot),
      coordinator: this.#coordinator,
      options,
      sourceUpdatedAt: (data) => data.timestamp,
      validationAttempts: 2,
    });
  }
}
