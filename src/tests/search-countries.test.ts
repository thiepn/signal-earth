import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const COUNTRY_FIXTURE = {
  features: [
    {
      properties: { name: 'Testland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 20], [12, 20], [12, 22], [10, 22], [10, 20]]],
      },
    },
  ],
};

function response(): Response {
  return new Response(JSON.stringify(COUNTRY_FIXTURE), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('country search loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('document', { baseURI: 'https://signal-earth.test/' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('coalesces concurrent callers and reuses the parsed country index', async () => {
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetchMock);
    const { loadSearchCountries } = await import('../features/search/countries');

    const [first, second] = await Promise.all([
      loadSearchCountries(),
      loadSearchCountries(),
    ]);
    const third = await loadSearchCountries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(first).toHaveLength(1);
    expect(first[0]?.name).toBe('Testland');
  });

  it('lets one caller abort without cancelling the shared request for other callers', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadSearchCountries } = await import('../features/search/countries');

    const controller = new AbortController();
    const cancelled = loadSearchCountries(controller.signal);
    const cancelledExpectation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    const active = loadSearchCountries();
    controller.abort();
    resolveFetch(response());

    await cancelledExpectation;
    await expect(active).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
