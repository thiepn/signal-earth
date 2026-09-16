import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProviderHealthRegistry,
  ReliabilityError,
  RequestCoordinator,
  fetchJsonReliable,
  parseRetryAfter,
} from '../core/data/reliability';

describe('data reliability primitives', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses Retry-After seconds and dates with a bounded delay', () => {
    const now = Date.parse('2026-09-16T16:00:00Z');
    expect(parseRetryAfter('2', now)).toBe(2_000);
    expect(parseRetryAfter('Wed, 16 Sep 2026 16:00:05 GMT', now)).toBe(5_000);
    expect(parseRetryAfter('999', now)).toBe(60_000);
    expect(parseRetryAfter('nonsense', now)).toBeNull();
  });

  it('retries transient HTTP failures and returns the later valid JSON response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJsonReliable<{ ok: boolean }>('https://example.test/data', {
      label: 'Test provider',
      attempts: 2,
      baseDelayMs: 0,
    })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies exhausted rate limiting with status and retry metadata', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '0' } }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchJsonReliable('https://example.test/data', {
      label: 'Test provider',
      attempts: 1,
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ReliabilityError);
    expect(error).toMatchObject({ kind: 'rate-limit', status: 429, retryAfterMs: 0 });
  });

  it('short-circuits network access while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchJsonReliable('https://example.test/data', {
      label: 'Test provider',
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({ kind: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('coalesces concurrent requests and lets one caller abort without cancelling another', async () => {
    const coordinator = new RequestCoordinator();
    let resolveShared!: (value: number) => void;
    const operation = vi.fn((_signal: AbortSignal) => new Promise<number>((resolve) => { resolveShared = resolve; }));
    const controller = new AbortController();

    const cancelled = coordinator.run('same', operation, controller.signal);
    const active = coordinator.run('same', operation);
    const cancelledExpectation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    resolveShared(42);

    await cancelledExpectation;
    await expect(active).resolves.toBe(42);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('tracks live, partial, fallback and error states deterministically', () => {
    const registry = new ProviderHealthRegistry();
    registry.markAttempt('usgs', 100);
    registry.markSuccess('usgs', { freshness: 'fresh', fetchedAt: 110, sourceUpdatedAt: 105, partial: false, latencyMs: 10 });
    expect(registry.getSnapshot().find((item) => item.provider === 'usgs')).toMatchObject({ status: 'live', consecutiveFailures: 0 });

    registry.markFallback('usgs', { freshness: 'stale', fetchedAt: 110, sourceUpdatedAt: 105, detail: 'fallback' });
    expect(registry.getSnapshot().find((item) => item.provider === 'usgs')).toMatchObject({ status: 'stale', consecutiveFailures: 1, detail: 'fallback' });

    registry.markSuccess('eonet', { freshness: 'fresh', fetchedAt: 120, partial: true });
    expect(registry.getSnapshot().find((item) => item.provider === 'eonet')).toMatchObject({ status: 'partial' });

    registry.markFailure('swpc', new ReliabilityError('down', { kind: 'network' }));
    expect(registry.getSnapshot().find((item) => item.provider === 'swpc')).toMatchObject({ status: 'error', consecutiveFailures: 1 });
  });
});
