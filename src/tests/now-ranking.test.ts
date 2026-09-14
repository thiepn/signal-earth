import { describe, expect, it } from 'vitest';
import { asEarthquakeId, type EarthquakeRecord } from '../features/seismic/types';
import { asNaturalEventId, type NaturalEventRecord } from '../features/natural-events/types';
import { asSatelliteId, type SatelliteRecord } from '../features/orbit/types';
import { buildNowSignals } from '../features/now/ranking';
import { nearestCityContext } from '../features/now/geography';

const NOW = Date.UTC(2026, 8, 14, 6, 0, 0);

function quake(magnitude: number, hoursAgo: number): EarthquakeRecord {
  return {
    id: asEarthquakeId(`q-${magnitude}`), usgsId: `q-${magnitude}`, place: 'Test Region', magnitude, magnitudeType: 'mw',
    time: NOW - hoursAgo * 3_600_000, updated: NOW, coordinates: { lat: 35.7, lon: 139.7, depthKm: 24 },
    url: 'https://example.com', detailUrl: 'https://example.com/detail', felt: 120, cdi: 4, mmi: 5,
    alert: null, status: 'reviewed', tsunami: false, significance: 650, network: 'us', code: 'test',
  };
}

function event(category: NaturalEventRecord['category']): NaturalEventRecord {
  return {
    id: asNaturalEventId(`event-${category}`), eonetId: `event-${category}`, title: `Test ${category}`,
    description: null, category, categoryTitle: category, link: 'https://example.com', sources: [],
    startTime: NOW - 24 * 3_600_000, closedAt: null, updatedAt: NOW - 3_600_000,
    geometry: [{ timestamp: NOW - 3_600_000, type: 'point', point: { lat: 34, lon: -118 }, magnitudeValue: null, magnitudeUnit: null, magnitudeDescription: null }],
  };
}

function iss(): SatelliteRecord {
  return {
    id: asSatelliteId('25544'), name: 'ISS (ZARYA)', noradId: '25544', category: 'stations', categories: ['stations'],
    epoch: NOW, omm: {} as SatelliteRecord['omm'],
  } as SatelliteRecord;
}

describe('Signal Earth Now ranking', () => {
  it('puts a major recent earthquake ahead of routine orbital context', () => {
    const signals = buildNowSignals({ earthquakes: [quake(7.2, 1)], naturalEvents: [], spaceWeather: null, satellites: [iss()], observerLocation: null, passForecast: null, now: NOW });
    expect(signals[0]?.kind).toBe('earthquake');
    expect(signals[0]?.metric).toBe('M7.2');
    expect(signals.some((signal) => signal.kind === 'orbit')).toBe(true);
  });

  it('keeps only the strongest current item from each natural-event category', () => {
    const first = event('wildfire');
    const second = { ...event('wildfire'), id: asNaturalEventId('event-wildfire-2'), eonetId: 'event-wildfire-2', geometry: [...first.geometry, ...first.geometry] };
    const signals = buildNowSignals({ earthquakes: [], naturalEvents: [first, second, event('volcano')], spaceWeather: null, satellites: [], observerLocation: null, passForecast: null, now: NOW });
    expect(signals.filter((signal) => signal.kind === 'natural-event' && signal.naturalEventCategory === 'wildfire')).toHaveLength(1);
    expect(signals.filter((signal) => signal.kind === 'natural-event' && signal.naturalEventCategory === 'volcano')).toHaveLength(1);
  });

  it('adds local ISS passes as a first-class discovery signal', () => {
    const passForecast = { generatedAt: NOW, startTime: NOW, horizonHours: 24, satelliteId: asSatelliteId('25544'), passes: [{ satelliteId: asSatelliteId('25544'), startTime: NOW + 30 * 60_000, endTime: NOW + 37 * 60_000, maxTime: NOW + 34 * 60_000, maxElevationDeg: 72, riseAzimuthDeg: 250, maxAzimuthDeg: 180, setAzimuthDeg: 90 }] };
    const observerLocation = { lat: 50.9375, lon: 6.9603, altitudeKm: 0, accuracyM: 20, acquiredAt: NOW, source: 'browser' as const };
    const signals = buildNowSignals({ earthquakes: [], naturalEvents: [], spaceWeather: null, satellites: [], observerLocation, passForecast, now: NOW });
    expect(signals[0]?.kind).toBe('local');
    expect(signals[0]?.title).toContain('ISS pass');
  });
});

describe('Phase 16 geographic context', () => {
  it('recognizes coordinates close to Cologne', () => {
    const nearby = nearestCityContext(50.94, 6.96, 100);
    expect(nearby?.city).toBe('Cologne');
    expect(nearby?.distanceKm).toBeLessThan(5);
  });
});
