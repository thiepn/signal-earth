import { DataCache } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import { loadReliableSnapshot, type ReliableLoadOptions } from '../../core/data/reliableLoad';
import { RequestCoordinator } from '../../core/data/reliability';
import type { EarthquakeFeed, EarthquakeTimeWindow } from '../../features/seismic/types';
import { UsgsEarthquakeProvider } from './UsgsEarthquakeProvider';

const CACHE_SCHEMA_VERSION = 2;
const PROVIDER_VERSION = 'usgs-feed-v2-reliable';

function cacheKey(window: EarthquakeTimeWindow): string {
  return `usgs:earthquakes:${window}`;
}

export interface EarthquakeLoadOptions extends ReliableLoadOptions {}

export class EarthquakeService {
  readonly #cache: DataCache;
  readonly #memory = new Map<EarthquakeTimeWindow, DataSnapshot<EarthquakeFeed>>();
  readonly #coordinator = new RequestCoordinator();

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(window: EarthquakeTimeWindow, options: EarthquakeLoadOptions = {}): Promise<DataSnapshot<EarthquakeFeed>> {
    const provider = new UsgsEarthquakeProvider(window);
    return loadReliableSnapshot({
      provider,
      cache: this.#cache,
      cacheKey: cacheKey(window),
      cacheSchemaVersion: CACHE_SCHEMA_VERSION,
      providerVersion: PROVIDER_VERSION,
      memory: this.#memory.get(window),
      setMemory: (snapshot) => this.#memory.set(window, snapshot),
      coordinator: this.#coordinator,
      options,
      sourceUpdatedAt: (data) => data.generatedAt,
      validationAttempts: 2,
    });
  }
}
