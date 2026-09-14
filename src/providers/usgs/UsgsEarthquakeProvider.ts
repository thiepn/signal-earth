import type { ProviderAdapter } from '../../core/data/ProviderAdapter';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import type { EarthquakeAlert, EarthquakeFeed, EarthquakeRecord, EarthquakeTimeWindow } from '../../features/seismic/types';
import { asEarthquakeId } from '../../features/seismic/types';
import type { UsgsGeoJsonCollection, UsgsGeoJsonFeature } from './types';

const FEED_URLS: Record<EarthquakeTimeWindow, string> = {
  hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
};

const MAX_RAW_FEATURES = 25_000;

export const USGS_FEED_POLICY: Record<EarthquakeTimeWindow, { ttlMs: number; staleForMs: number }> = {
  hour: { ttlMs: 60_000, staleForMs: 6 * 60 * 60_000 },
  day: { ttlMs: 60_000, staleForMs: 6 * 60 * 60_000 },
  week: { ttlMs: 5 * 60_000, staleForMs: 6 * 60 * 60_000 },
  month: { ttlMs: 10 * 60_000, staleForMs: 6 * 60 * 60_000 },
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nullableFinite(value: unknown): number | null {
  return finite(value) ? value : null;
}

function isUsgsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'earthquake.usgs.gov';
  } catch {
    return false;
  }
}

function normalizeAlert(value: unknown): EarthquakeAlert {
  return value === 'green' || value === 'yellow' || value === 'orange' || value === 'red' ? value : null;
}

function normalizeFeature(feature: UsgsGeoJsonFeature): EarthquakeRecord | null {
  if (!feature || feature.type !== 'Feature' || typeof feature.id !== 'string' || !feature.geometry) return null;
  if (feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null;

  const [lon, lat, depthKm] = feature.geometry.coordinates;
  const properties = feature.properties;
  if (!finite(lat) || !finite(lon) || !finite(depthKm)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || depthKm < -20 || depthKm > 1_000) return null;
  if (!finite(properties?.mag) || !finite(properties?.time) || !finite(properties?.updated)) return null;
  if (properties.type !== 'earthquake') return null;
  if (properties.mag < -2 || properties.mag > 12) return null;
  if (!isUsgsUrl(properties.url) || !isUsgsUrl(properties.detail)) return null;

  return {
    id: asEarthquakeId(feature.id),
    usgsId: feature.id,
    place: typeof properties.place === 'string' && properties.place.trim() ? properties.place.trim() : 'Unknown location',
    magnitude: properties.mag,
    magnitudeType: typeof properties.magType === 'string' ? properties.magType : null,
    time: properties.time,
    updated: properties.updated,
    coordinates: { lat, lon, depthKm },
    url: properties.url,
    detailUrl: properties.detail,
    felt: nullableFinite(properties.felt),
    cdi: nullableFinite(properties.cdi),
    mmi: nullableFinite(properties.mmi),
    alert: normalizeAlert(properties.alert),
    status: typeof properties.status === 'string' ? properties.status : 'unknown',
    tsunami: properties.tsunami === 1,
    significance: finite(properties.sig) ? Math.max(0, properties.sig) : 0,
    network: typeof properties.net === 'string' ? properties.net : '',
    code: typeof properties.code === 'string' ? properties.code : '',
  };
}

export class UsgsEarthquakeProvider implements ProviderAdapter<UsgsGeoJsonCollection, EarthquakeFeed> {
  readonly id = 'usgs' as const;
  readonly source = SOURCE_REGISTRY.usgs;
  readonly temporalType = 'observed' as const;
  readonly cachePolicy: { ttlMs: number; staleForMs: number };
  readonly window: EarthquakeTimeWindow;

  constructor(window: EarthquakeTimeWindow) {
    this.window = window;
    this.cachePolicy = USGS_FEED_POLICY[window];
  }

  async fetchRaw(signal?: AbortSignal): Promise<UsgsGeoJsonCollection> {
    const response = await fetch(FEED_URLS[this.window], {
      ...(signal ? { signal } : {}),
      headers: { Accept: 'application/geo+json, application/json' },
      cache: 'no-cache',
    });
    if (!response.ok) throw new Error(`USGS feed request failed (${response.status})`);
    return await response.json() as UsgsGeoJsonCollection;
  }

  normalize(raw: UsgsGeoJsonCollection): EarthquakeFeed {
    const features = Array.isArray(raw.features) ? raw.features.slice(0, MAX_RAW_FEATURES) : [];
    const earthquakes: EarthquakeRecord[] = [];
    for (const feature of features) {
      const normalized = normalizeFeature(feature);
      if (normalized) earthquakes.push(normalized);
    }
    earthquakes.sort((a, b) => b.time - a.time);

    return {
      generatedAt: finite(raw.metadata?.generated) ? raw.metadata.generated : Date.now(),
      title: typeof raw.metadata?.title === 'string' ? raw.metadata.title : 'USGS Earthquakes',
      count: earthquakes.length,
      window: this.window,
      earthquakes,
    };
  }

  validate(normalized: EarthquakeFeed): boolean {
    return Number.isFinite(normalized.generatedAt)
      && Array.isArray(normalized.earthquakes)
      && normalized.earthquakes.length <= MAX_RAW_FEATURES
      && normalized.window === this.window;
  }
}
