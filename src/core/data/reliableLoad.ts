import { DataCache, type CacheEntry } from './DataCache';
import type { DataSnapshot, ProviderAdapter } from './ProviderAdapter';
import { abortableDelay, providerHealthRegistry, ReliabilityError, RequestCoordinator, describeReliabilityFailure, isAbortError } from './reliability';
import type { ExternalProviderId } from './reliability';

const MAX_CLOCK_SKEW_MS = 10 * 60_000;

export interface ReliableLoadOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export interface ReliableLoadConfig<TRaw, TNormalized> {
  provider: ProviderAdapter<TRaw, TNormalized> & { readonly id: ExternalProviderId };
  cache: DataCache;
  cacheKey: string;
  cacheSchemaVersion: number;
  providerVersion: string;
  memory: DataSnapshot<TNormalized> | null | undefined;
  setMemory(snapshot: DataSnapshot<TNormalized>): void;
  coordinator: RequestCoordinator;
  options?: ReliableLoadOptions;
  sourceUpdatedAt(data: TNormalized): number | undefined;
  partial?(data: TNormalized): boolean;
  maxSourceFutureSkewMs?: number;
  validationAttempts?: number;
}

function cachedSnapshot<T>(entry: CacheEntry<T>, config: ReliableLoadConfig<unknown, T>, freshness: 'cached' | 'stale'): DataSnapshot<T> {
  return {
    provider: config.provider.id,
    fetchedAt: entry.fetchedAt,
    ...(entry.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: entry.sourceUpdatedAt }),
    temporalType: config.provider.temporalType,
    freshness,
    data: entry.value,
  };
}

function memorySnapshot<T>(snapshot: DataSnapshot<T>, freshness: 'cached' | 'stale'): DataSnapshot<T> {
  return { ...snapshot, freshness };
}

function validTimestamp(value: number | undefined, now: number, maxFutureSkewMs: number): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && value <= now + maxFutureSkewMs);
}

function providerDataValid<T>(config: ReliableLoadConfig<unknown, T>, value: T): boolean {
  try {
    return config.provider.validate(value);
  } catch {
    return false;
  }
}

function cacheEntryValid<T>(entry: CacheEntry<T>, config: ReliableLoadConfig<unknown, T>, now: number): boolean {
  return entry.provider === config.provider.id
    && entry.schemaVersion === config.cacheSchemaVersion
    && entry.providerVersion === config.providerVersion
    && Number.isFinite(entry.fetchedAt)
    && Number.isFinite(entry.expiresAt)
    && entry.fetchedAt >= 0
    && entry.fetchedAt <= now + MAX_CLOCK_SKEW_MS
    && entry.expiresAt >= entry.fetchedAt
    && validTimestamp(entry.sourceUpdatedAt, now, config.maxSourceFutureSkewMs ?? MAX_CLOCK_SKEW_MS)
    && providerDataValid(config, entry.value);
}

function normalizeProviderError(error: unknown, providerName: string): ReliabilityError {
  if (error instanceof ReliabilityError) return error;
  const message = error instanceof Error ? error.message : String(error ?? `${providerName} request failed.`);
  const match = message.match(/\((\d{3})\)/);
  const status = match?.[1] ? Number(match[1]) : null;
  if (status === 429) return new ReliabilityError(`${providerName} is rate-limiting requests (429).`, { kind: 'rate-limit', status, cause: error });
  if (status !== null) return new ReliabilityError(message, { kind: 'http', status, cause: error });
  return new ReliabilityError(message, { kind: 'network', cause: error });
}

function retryable(error: ReliabilityError): boolean {
  if (error.kind === 'network' || error.kind === 'parse' || error.kind === 'validation' || error.kind === 'rate-limit') return true;
  return error.kind === 'http' && (error.status === 408 || error.status === 425 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504);
}

async function fetchValidated<TRaw, TNormalized>(config: ReliableLoadConfig<TRaw, TNormalized>, signal: AbortSignal): Promise<TNormalized> {
  const attempts = Math.max(1, Math.min(3, config.validationAttempts ?? 3));
  let lastError: ReliabilityError | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    try {
      const raw = await config.provider.fetchRaw(signal);
      const data = config.provider.normalize(raw);
      let valid = false;
      try { valid = config.provider.validate(data); } catch { valid = false; }
      if (!valid) {
        throw new ReliabilityError(`${config.provider.source.name} returned a payload that failed validation.`, { kind: 'validation' });
      }
      const sourceUpdatedAt = config.sourceUpdatedAt(data);
      if (!validTimestamp(sourceUpdatedAt, Date.now(), config.maxSourceFutureSkewMs ?? MAX_CLOCK_SKEW_MS)) {
        throw new ReliabilityError(`${config.provider.source.name} returned an implausible source timestamp.`, { kind: 'validation' });
      }
      return data;
    } catch (error) {
      if (isAbortError(error)) throw error;
      const normalized = normalizeProviderError(error, config.provider.source.name);
      lastError = normalized;
      if (!retryable(normalized) || attempt === attempts - 1) throw normalized;
      const delayMs = normalized.retryAfterMs ?? Math.min(2_500, 250 * 2 ** attempt);
      await abortableDelay(delayMs, signal);
    }
  }

  throw lastError ?? new ReliabilityError(`${config.provider.source.name} request failed.`, { kind: 'unknown' });
}

function healthDetailForCacheRecovery(recovered: boolean): string | null {
  return recovered ? 'Recovered an invalid local cache entry before loading provider data.' : null;
}

export async function loadReliableSnapshot<TRaw, TNormalized>(config: ReliableLoadConfig<TRaw, TNormalized>): Promise<DataSnapshot<TNormalized>> {
  const options = config.options ?? {};
  const provider = config.provider;
  const startedAt = Date.now();
  const now = startedAt;
  providerHealthRegistry.markAttempt(provider.id, startedAt);
  const untypedConfig = config as ReliableLoadConfig<unknown, TNormalized>;

  if (!options.forceRefresh && config.memory && now - config.memory.fetchedAt <= provider.cachePolicy.ttlMs && providerDataValid(untypedConfig, config.memory.data)) {
    const snapshot = memorySnapshot(config.memory, config.memory.freshness === 'stale' ? 'stale' : 'cached');
    config.setMemory(snapshot);
    providerHealthRegistry.markSuccess(provider.id, {
      freshness: snapshot.freshness,
      fetchedAt: snapshot.fetchedAt,
      ...(snapshot.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: snapshot.sourceUpdatedAt }),
      partial: config.partial?.(snapshot.data) ?? false,
      latencyMs: 0,
    });
    return snapshot;
  }

  let cached: CacheEntry<TNormalized> | undefined;
  let cacheRecovered = false;
  try {
    cached = await config.cache.get<TNormalized>(config.cacheKey);
    if (cached && !cacheEntryValid(cached, untypedConfig, now)) {
      cacheRecovered = true;
      cached = undefined;
      try { await config.cache.delete(config.cacheKey); } catch { /* cache recovery is best-effort */ }
    }
  } catch {
    cached = undefined;
    // IndexedDB may be unavailable in privacy modes; network remains authoritative.
  }

  if (!options.forceRefresh && cached && now <= cached.expiresAt) {
    const snapshot = cachedSnapshot(cached, untypedConfig, 'cached');
    config.setMemory(snapshot);
    providerHealthRegistry.markSuccess(provider.id, {
      freshness: 'cached',
      fetchedAt: snapshot.fetchedAt,
      ...(snapshot.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: snapshot.sourceUpdatedAt }),
      partial: config.partial?.(snapshot.data) ?? false,
      latencyMs: Date.now() - startedAt,
      cacheRecovered,
      detail: healthDetailForCacheRecovery(cacheRecovered),
    });
    return snapshot;
  }

  try {
    const data = await config.coordinator.run(config.cacheKey, (sharedSignal) => fetchValidated(config, sharedSignal), options.signal);
    const completedAt = Date.now();
    const sourceUpdatedAt = config.sourceUpdatedAt(data);
    const snapshot: DataSnapshot<TNormalized> = {
      provider: provider.id,
      fetchedAt: completedAt,
      ...(sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt }),
      temporalType: provider.temporalType,
      freshness: 'fresh',
      data,
    };
    config.setMemory(snapshot);

    const entry: CacheEntry<TNormalized> = {
      key: config.cacheKey,
      provider: provider.id,
      fetchedAt: completedAt,
      ...(sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt }),
      expiresAt: completedAt + provider.cachePolicy.ttlMs,
      schemaVersion: config.cacheSchemaVersion,
      providerVersion: config.providerVersion,
      value: data,
    };
    try { await config.cache.set(entry); } catch { /* quota/privacy failures do not invalidate network data */ }

    providerHealthRegistry.markSuccess(provider.id, {
      freshness: 'fresh',
      fetchedAt: completedAt,
      ...(sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt }),
      partial: config.partial?.(data) ?? false,
      latencyMs: completedAt - startedAt,
      cacheRecovered,
      detail: healthDetailForCacheRecovery(cacheRecovered),
    });
    return snapshot;
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) throw error;
    const failure = describeReliabilityFailure(error);
    const detail = `${failure.message} Using the newest valid local fallback.`;

    if (cached && now - cached.fetchedAt <= provider.cachePolicy.staleForMs) {
      const snapshot = cachedSnapshot(cached, untypedConfig, 'stale');
      config.setMemory(snapshot);
      providerHealthRegistry.markFallback(provider.id, {
        freshness: 'stale',
        fetchedAt: snapshot.fetchedAt,
        ...(snapshot.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: snapshot.sourceUpdatedAt }),
        partial: config.partial?.(snapshot.data) ?? false,
        detail,
        cacheRecovered,
      });
      return snapshot;
    }

    if (config.memory && now - config.memory.fetchedAt <= provider.cachePolicy.staleForMs && providerDataValid(untypedConfig, config.memory.data)) {
      const snapshot = memorySnapshot(config.memory, 'stale');
      config.setMemory(snapshot);
      providerHealthRegistry.markFallback(provider.id, {
        freshness: 'stale',
        fetchedAt: snapshot.fetchedAt,
        ...(snapshot.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: snapshot.sourceUpdatedAt }),
        partial: config.partial?.(snapshot.data) ?? false,
        detail,
        cacheRecovered,
      });
      return snapshot;
    }

    providerHealthRegistry.markFailure(provider.id, error);
    throw error;
  }
}
