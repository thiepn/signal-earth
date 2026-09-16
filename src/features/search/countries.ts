import type { GeoCoordinates } from '../../shared/types/entities';

interface GeoJsonFeature {
  properties?: { name?: unknown };
  geometry?: { type?: string; coordinates?: unknown };
}

export interface SearchCountry {
  name: string;
  coordinates: GeoCoordinates;
}

let cachedCountries: SearchCountry[] | null = null;
let countriesRequest: Promise<SearchCountry[]> | null = null;

function collectPoints(value: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    const lon = value[0];
    const lat = value[1];
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push([lon, lat]);
    return;
  }
  for (const item of value) collectPoints(item, out);
}

function representativePoint(geometry: GeoJsonFeature['geometry']): GeoCoordinates | null {
  if (!geometry) return null;
  const points: Array<[number, number]> = [];
  collectPoints(geometry.coordinates, points);
  if (!points.length) return null;

  // Circular mean prevents polygons around the date line from centering near Greenwich.
  let x = 0;
  let y = 0;
  let latSum = 0;
  for (const [lon, lat] of points) {
    const radians = lon * Math.PI / 180;
    x += Math.cos(radians);
    y += Math.sin(radians);
    latSum += lat;
  }
  const lon = Math.atan2(y / points.length, x / points.length) * 180 / Math.PI;
  return { lat: latSum / points.length, lon };
}

function abortError(): DOMException {
  return new DOMException('Country search loading was aborted.', 'AbortError');
}

function waitForSharedRequest(request: Promise<SearchCountry[]>, signal?: AbortSignal): Promise<SearchCountry[]> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<SearchCountry[]>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    request.then(
      (countries) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) resolve(countries);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) reject(error);
      },
    );
  });
}

async function fetchSearchCountries(): Promise<SearchCountry[]> {
  const url = new URL('data/natural-earth-lowres.geojson', document.baseURI).toString();
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Natural Earth countries returned HTTP ${response.status}`);
  const payload = await response.json() as { features?: GeoJsonFeature[] };
  if (!Array.isArray(payload.features)) return [];
  const countries: SearchCountry[] = [];
  for (const feature of payload.features) {
    const name = typeof feature.properties?.name === 'string' ? feature.properties.name.trim() : '';
    const coordinates = representativePoint(feature.geometry);
    if (name && coordinates) countries.push({ name, coordinates });
  }
  return countries.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadSearchCountries(signal?: AbortSignal): Promise<SearchCountry[]> {
  if (cachedCountries) return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve(cachedCountries);

  if (!countriesRequest) {
    countriesRequest = fetchSearchCountries().then((countries) => {
      cachedCountries = countries;
      return countries;
    }).finally(() => {
      countriesRequest = null;
    });
  }

  return waitForSharedRequest(countriesRequest, signal);
}
