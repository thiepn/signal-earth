import { describe, expect, it } from 'vitest';
import { UsgsEarthquakeProvider } from '../providers/usgs/UsgsEarthquakeProvider';
import type { UsgsGeoJsonCollection } from '../providers/usgs/types';

function fixture(): UsgsGeoJsonCollection {
  return {
    type: 'FeatureCollection',
    metadata: {
      generated: 1_789_123_456_000,
      url: 'https://example.test',
      title: 'USGS fixture',
      api: '1.0.17',
      count: 2,
      status: 200,
    },
    features: [
      {
        type: 'Feature',
        id: 'test-quake',
        properties: {
          mag: 5.4,
          place: 'Test Ridge',
          time: 1_789_123_000_000,
          updated: 1_789_123_100_000,
          url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test-quake',
          detail: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/test-quake.geojson',
          felt: 12,
          cdi: 4.1,
          mmi: 3.8,
          alert: 'green',
          status: 'reviewed',
          tsunami: 0,
          sig: 450,
          net: 'us',
          code: 'test',
          magType: 'mww',
          type: 'earthquake',
        },
        geometry: { type: 'Point', coordinates: [142.1, 38.3, 32.4] },
      },
      {
        type: 'Feature',
        id: 'quarry',
        properties: {
          mag: 2.1,
          place: 'Quarry',
          time: 1_789_100_000_000,
          updated: 1_789_100_100_000,
          url: 'https://earthquake.usgs.gov/example',
          detail: 'https://earthquake.usgs.gov/example.geojson',
          felt: null,
          cdi: null,
          mmi: null,
          alert: null,
          status: 'automatic',
          tsunami: 0,
          sig: 70,
          net: 'ci',
          code: 'quarry',
          magType: 'ml',
          type: 'quarry blast',
        },
        geometry: { type: 'Point', coordinates: [-117, 35, 2] },
      },
    ],
  };
}

describe('USGS earthquake provider', () => {
  it('normalizes earthquake records and rejects non-earthquake seismic events', () => {
    const provider = new UsgsEarthquakeProvider('day');
    const normalized = provider.normalize(fixture());
    expect(provider.validate(normalized)).toBe(true);
    expect(normalized.earthquakes).toHaveLength(1);
    expect(normalized.earthquakes[0]?.magnitude).toBe(5.4);
    expect(normalized.earthquakes[0]?.coordinates.depthKm).toBe(32.4);
    expect(normalized.earthquakes[0]?.tsunami).toBe(false);
    expect(String(normalized.earthquakes[0]?.id)).toBe('earthquake:test-quake');
  });
});
