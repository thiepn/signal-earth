import type { Freshness } from './freshness';
import type { ProviderId } from '../../shared/types/sources';

export type ExternalProviderId = Exclude<ProviderId, 'local'>;
export type ProviderHealthStatus = 'idle' | 'live' | 'cached' | 'stale' | 'partial' | 'offline' | 'error';
export type ReliabilityFailureKind = 'aborted' | 'offline' | 'network' | 'rate-limit' | 'http' | 'parse' | 'validation' | 'cache' | 'unknown';

export interface ProviderHealthSnapshot {
  provider: ExternalProviderId;
  status: ProviderHealthStatus;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  fetchedAt: number | null;
  sourceUpdatedAt: number | null;
  latencyMs: number | null;
  consecutiveFailures: number;
  detail: string | null;
  retryAt: number | null;
  cacheRecovered: boolean;
}

const PROVIDERS: readonly ExternalProviderId[] = ['usgs', 'eonet', 'celestrak', 'swpc', 'openmeteo'];

function initialHealth(provider: ExternalProviderId): ProviderHealthSnapshot {
  return {
    provider,
    status: 'idle',
    lastAttemptAt: null,
    lastSuccessAt: null,
    fetchedAt: null,
    sourceUpdatedAt: null,
    latencyMs: null,
    consecutiveFailures: 0,
    detail: null,
    retryAt: null,
    cacheRecovered: false,
  };
}

function statusFor(freshness: Freshness, partial: boolean): ProviderHealthStatus {
  if (freshness === 'stale') return 'stale';
  if (freshness === 'cached') return partial ? 'partial' : 'cached';
  return partial ? 'partial' : 'live';
}

export class ProviderHealthRegistry {
  readonly #state = new Map<ExternalProviderId, ProviderHealthSnapshot>(PROVIDERS.map((provider) => [provider, initialHealth(provider)]));
  readonly #listeners = new Set<() => void>();
  #snapshot: readonly ProviderHealthSnapshot[] = PROVIDERS.map((provider) => this.#state.get(provider)!);

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): readonly ProviderHealthSnapshot[] => this.#snapshot;

  #publish(provider: ExternalProviderId, next: ProviderHealthSnapshot): void {
    this.#state.set(provider, next);
    this.#snapshot = PROVIDERS.map((id) => this.#state.get(id)!);
    for (const listener of this.#listeners) listener();
  }

  markAttempt(provider: ExternalProviderId, at = Date.now()): void {
    const current = this.#state.get(provider)!;
    this.#publish(provider, { ...current, lastAttemptAt: at, retryAt: null, cacheRecovered: false });
  }

  markSuccess(provider: ExternalProviderId, info: {
    freshness: Freshness;
    fetchedAt: number;
    sourceUpdatedAt?: number;
    latencyMs?: number;
    partial?: boolean;
    detail?: string | null;
    cacheRecovered?: boolean;
  }): void {
    const current = this.#state.get(provider)!;
    this.#publish(provider, {
      ...current,
      status: statusFor(info.freshness, Boolean(info.partial)),
      lastSuccessAt: Date.now(),
      fetchedAt: info.fetchedAt,
      sourceUpdatedAt: info.sourceUpdatedAt ?? null,
      latencyMs: info.latencyMs ?? current.latencyMs,
      consecutiveFailures: 0,
      detail: info.detail ?? null,
      retryAt: null,
      cacheRecovered: Boolean(info.cacheRecovered),
    });
  }

  markFallback(provider: ExternalProviderId, info: {
    freshness: 'cached' | 'stale';
    fetchedAt: number;
    sourceUpdatedAt?: number;
    partial?: boolean;
    detail: string;
    cacheRecovered?: boolean;
  }): void {
    const current = this.#state.get(provider)!;
    this.#publish(provider, {
      ...current,
      status: statusFor(info.freshness, Boolean(info.partial)),
      lastSuccessAt: current.lastSuccessAt ?? Date.now(),
      fetchedAt: info.fetchedAt,
      sourceUpdatedAt: info.sourceUpdatedAt ?? null,
      consecutiveFailures: current.consecutiveFailures + 1,
      detail: info.detail,
      retryAt: null,
      cacheRecovered: Boolean(info.cacheRecovered),
    });
  }

  markFailure(provider: ExternalProviderId, error: unknown): void {
    const current = this.#state.get(provider)!;
    const failure = describeReliabilityFailure(error);
    if (failure.kind === 'aborted') return;
    this.#publish(provider, {
      ...current,
      status: failure.kind === 'offline' ? 'offline' : 'error',
      consecutiveFailures: current.consecutiveFailures + 1,
      detail: failure.message,
      retryAt: failure.retryAfterMs === null ? null : Date.now() + failure.retryAfterMs,
    });
  }

  reset(): void {
    for (const provider of PROVIDERS) this.#state.set(provider, initialHealth(provider));
    this.#snapshot = PROVIDERS.map((provider) => this.#state.get(provider)!);
    for (const listener of this.#listeners) listener();
  }
}

export const providerHealthRegistry = new ProviderHealthRegistry();

export class ReliabilityError extends Error {
  readonly kind: ReliabilityFailureKind;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(message: string, options: { kind: ReliabilityFailureKind; status?: number | null; retryAfterMs?: number | null; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ReliabilityError';
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

export interface ReliabilityFailureDescription {
  kind: ReliabilityFailureKind;
  message: string;
  status: number | null;
  retryAfterMs: number | null;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError');
}

export function describeReliabilityFailure(error: unknown): ReliabilityFailureDescription {
  if (isAbortError(error)) return { kind: 'aborted', message: 'Request cancelled.', status: null, retryAfterMs: null };
  if (error instanceof ReliabilityError) {
    return { kind: error.kind, message: error.message, status: error.status, retryAfterMs: error.retryAfterMs };
  }
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown provider failure.');
  return { kind: 'unknown', message, status: null, retryAfterMs: null };
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, Math.round(seconds * 1_000));
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.min(60_000, timestamp - now));
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function abortError(): DOMException {
  return new DOMException('Request aborted', 'AbortError');
}

export async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) throw abortError();
  await new Promise<void>((resolve, reject) => {
    const handle = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(handle);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchJsonReliable<T>(url: string, options: {
  signal?: AbortSignal;
  headers?: HeadersInit;
  cache?: RequestCache;
  label: string;
  attempts?: number;
  baseDelayMs?: number;
  maxResponseBytes?: number;
}): Promise<T> {
  const attempts = Math.max(1, Math.min(4, options.attempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 300);
  const maxResponseBytes = options.maxResponseBytes ?? 32 * 1024 * 1024;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError();
    if (!online()) throw new ReliabilityError(`${options.label} is unavailable while the browser is offline.`, { kind: 'offline' });

    try {
      const response = await fetch(url, {
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
        cache: options.cache ?? 'no-cache',
      });

      if (!response.ok) {
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
        const kind: ReliabilityFailureKind = response.status === 429 ? 'rate-limit' : 'http';
        const error = new ReliabilityError(`${options.label} request failed (${response.status}).`, {
          kind,
          status: response.status,
          retryAfterMs,
        });
        if (!retryableStatus(response.status) || attempt === attempts - 1) throw error;
        await abortableDelay(retryAfterMs ?? Math.min(3_000, baseDelayMs * 2 ** attempt), options.signal);
        lastError = error;
        continue;
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
        throw new ReliabilityError(`${options.label} payload exceeded the safe response-size limit.`, { kind: 'validation' });
      }

      try {
        return await response.json() as T;
      } catch (error) {
        const parseError = new ReliabilityError(`${options.label} returned malformed JSON.`, { kind: 'parse', cause: error });
        if (attempt === attempts - 1) throw parseError;
        await abortableDelay(Math.min(3_000, baseDelayMs * 2 ** attempt), options.signal);
        lastError = parseError;
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof ReliabilityError) {
        if (error.kind === 'http' || error.kind === 'rate-limit' || error.kind === 'parse' || error.kind === 'validation') throw error;
      }
      const wrapped = new ReliabilityError(`${options.label} network request failed.`, { kind: online() ? 'network' : 'offline', cause: error });
      if (attempt === attempts - 1) throw wrapped;
      await abortableDelay(Math.min(3_000, baseDelayMs * 2 ** attempt), options.signal);
      lastError = wrapped;
    }
  }

  throw lastError instanceof Error ? lastError : new ReliabilityError(`${options.label} request failed.`, { kind: 'unknown' });
}

interface Flight<T> {
  promise: Promise<T>;
  controller: AbortController;
  consumers: number;
  settled: boolean;
}

export class RequestCoordinator {
  readonly #flights = new Map<string, Flight<unknown>>();

  run<T>(key: string, operation: (signal: AbortSignal) => Promise<T>, callerSignal?: AbortSignal): Promise<T> {
    let flight = this.#flights.get(key) as Flight<T> | undefined;
    if (!flight) {
      const controller = new AbortController();
      flight = { promise: Promise.resolve(undefined as T), controller, consumers: 0, settled: false };
      const created = flight;
      created.promise = operation(controller.signal).finally(() => {
        created.settled = true;
        if (this.#flights.get(key) === created) this.#flights.delete(key);
      });
      this.#flights.set(key, created as Flight<unknown>);
    }

    flight.consumers += 1;
    const activeFlight = flight;

    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        callerSignal?.removeEventListener('abort', onAbort);
        activeFlight.consumers = Math.max(0, activeFlight.consumers - 1);
        if (activeFlight.consumers === 0 && !activeFlight.settled) activeFlight.controller.abort();
      };
      const onAbort = () => {
        finish();
        reject(abortError());
      };

      if (callerSignal?.aborted) {
        onAbort();
        return;
      }
      callerSignal?.addEventListener('abort', onAbort, { once: true });
      activeFlight.promise.then((value) => {
        if (finished) return;
        finish();
        resolve(value);
      }, (error) => {
        if (finished) return;
        finish();
        reject(error);
      });
    });
  }
}
