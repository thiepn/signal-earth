import { DataCache } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import { loadReliableSnapshot, type ReliableLoadOptions } from '../../core/data/reliableLoad';
import { RequestCoordinator } from '../../core/data/reliability';
import type { NaturalEventFeed } from '../../features/natural-events/types';
import { EonetProvider } from './EonetProvider';

const CACHE_KEY = 'eonet:natural-events:v2';
const CACHE_SCHEMA_VERSION = 2;
const PROVIDER_VERSION = 'eonet-v3-events-v2-reliable';

export interface NaturalEventLoadOptions extends ReliableLoadOptions {}

export class NaturalEventService {
  readonly #cache: DataCache;
  readonly #coordinator = new RequestCoordinator();
  #memory: DataSnapshot<NaturalEventFeed> | null = null;

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(options: NaturalEventLoadOptions = {}): Promise<DataSnapshot<NaturalEventFeed>> {
    const provider = new EonetProvider();
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
