import { DataCache } from '../../core/data/DataCache';
import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import { loadReliableSnapshot } from '../../core/data/reliableLoad';
import { RequestCoordinator } from '../../core/data/reliability';
import type { OrbitCatalog } from '../../features/orbit/types';
import { CelesTrakProvider } from './CelesTrakProvider';

const CACHE_KEY = 'celestrak:orbit:curated-v1';
const CACHE_SCHEMA_VERSION = 1;
const PROVIDER_VERSION = 'celestrak-curated-omm-v1';

export interface OrbitLoadOptions {
  signal?: AbortSignal;
}

export class CelesTrakService {
  readonly #cache: DataCache;
  readonly #coordinator = new RequestCoordinator();
  #memory: DataSnapshot<OrbitCatalog> | null = null;

  constructor(cache = new DataCache()) {
    this.#cache = cache;
  }

  async load(options: OrbitLoadOptions = {}): Promise<DataSnapshot<OrbitCatalog>> {
    const provider = new CelesTrakProvider();
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
      sourceUpdatedAt: (data) => data.newestElementEpoch ?? undefined,
      partial: (data) => data.partial,
      // OMM element epochs can legitimately lead wall-clock time by a small amount
      // depending on provider publication timing; keep the audit strict but practical.
      maxSourceFutureSkewMs: 6 * 60 * 60_000,
      validationAttempts: 2,
    });
  }
}
