import { DataCache } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import { loadReliableSnapshot, type ReliableLoadOptions } from '../../core/data/reliableLoad';
import { RequestCoordinator } from '../../core/data/reliability';
import type { SpaceWeatherFeed } from '../../features/space-weather/types';
import { SwpcProvider } from './SwpcProvider';

const CACHE_KEY = 'swpc:space-weather:v1';
const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'swpc-products-v1';

export interface SpaceWeatherLoadOptions extends ReliableLoadOptions {}

export class SpaceWeatherService {
  readonly #cache: DataCache;
  readonly #coordinator = new RequestCoordinator();
  #memory: DataSnapshot<SpaceWeatherFeed> | null = null;

  constructor(cache = new DataCache()) { this.#cache = cache; }

  async load(options: SpaceWeatherLoadOptions = {}): Promise<DataSnapshot<SpaceWeatherFeed>> {
    const provider = new SwpcProvider();
    return loadReliableSnapshot({
      provider,
      cache: this.#cache,
      cacheKey: CACHE_KEY,
      cacheSchemaVersion: CACHE_SCHEMA_VERSION,
      providerVersion: PROVIDER_VERSION,
      memory: this.#memory,
      setMemory: (snapshot) => { this.#memory = snapshot; },
      coordinator: this.#coordinator,
      options,
      sourceUpdatedAt: (data) => data.sourceUpdatedAt,
      partial: (data) => data.partial,
      validationAttempts: 2,
    });
  }
}
