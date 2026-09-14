import { describe, expect, it } from 'vitest';
import type { DataSnapshot } from '../core/data/ProviderAdapter';
import { observerAstronomy } from '../features/above-me/astronomy';
import type { LocalWeather } from '../features/above-me/types';
import { buildDynamicBriefings, type DynamicBriefingSnapshot } from '../features/briefings/dynamic';
import type { NaturalEventFeed, NaturalEventRecord } from '../features/natural-events/types';
import type { OrbitCatalog, SatelliteRecord } from '../features/orbit/types';
import type { EarthquakeFeed, EarthquakeRecord } from '../features/seismic/types';
import type { SpaceWeatherFeed } from '../features/space-weather/types';
import { asEntityId } from '../shared/types/entities';

const NOW = Date.parse('2026-09-14T20:00:00Z');

function earthquake(id: string, magnitude: number, place: string, ageHours = 1): EarthquakeRecord {
  return {
    id: asEntityId(`earthquake:${id}`), usgsId: id, place, magnitude, magnitudeType: 'mw',
    time: NOW - ageHours * 3_600_000, updated: NOW - ageHours * 3_600_000 + 60_000,
    coordinates: { lat: 35, lon: 140, depthKm: 18 }, url: 'https://example.test/usgs', detailUrl: 'https://example.test/detail',
    felt: 42, cdi: 4.2, mmi: 5.1, alert: magnitude >= 6 ? 'yellow' : null, status: 'reviewed', tsunami: false,
    significance: Math.round(magnitude * 100), network: 'us', code: id,
  };
}

function naturalEvent(id: string, category: NaturalEventRecord['category'], title: string, ageHours = 3): NaturalEventRecord {
  return {
    id: asEntityId(`event:${id}`), eonetId: id, title, description: null, category,
    categoryTitle: category === 'severe-storm' ? 'Severe Storms' : category === 'wildfire' ? 'Wildfires' : 'Volcanoes',
    link: 'https://example.test/eonet', sources: [{ id: 'source', url: 'https://example.test/source' }],
    startTime: NOW - ageHours * 3_600_000, closedAt: null, updatedAt: NOW - 30 * 60_000,
    geometry: [
      { timestamp: NOW - ageHours * 3_600_000, type: 'point', point: { lat: 15, lon: -60 }, magnitudeValue: null, magnitudeUnit: null, magnitudeDescription: null },
      { timestamp: NOW - 30 * 60_000, type: 'point', point: { lat: 16, lon: -59 }, magnitudeValue: null, magnitudeUnit: null, magnitudeDescription: null },
    ],
  };
}

function satellite(norad: string, name: string, category: SatelliteRecord['category'], meanMotion = 15.5): SatelliteRecord {
  return {
    id: asEntityId(`satellite:${norad}`), noradId: norad, name,
    omm: {
      OBJECT_NAME: name, EPOCH: new Date(NOW).toISOString(), MEAN_MOTION: meanMotion, ECCENTRICITY: 0.001,
      INCLINATION: category === 'navigation' ? 55 : 51.6, RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0,
      NORAD_CAT_ID: norad,
    },
    category, categories: [category], epoch: NOW, source: 'celestrak',
  };
}

function snapshot<T>(provider: DataSnapshot<T>['provider'], temporalType: DataSnapshot<T>['temporalType'], data: T): DataSnapshot<T> {
  return { provider, fetchedAt: NOW, sourceUpdatedAt: NOW, temporalType, freshness: 'fresh', data };
}

function baseSnapshot(): DynamicBriefingSnapshot {
  const quakes = [earthquake('a', 6.4, '20 km E of Test City'), earthquake('b', 4.7, 'Second Place', 2)];
  const events = [naturalEvent('storm', 'severe-storm', 'Hurricane Test'), naturalEvent('fire', 'wildfire', 'Test Fire', 5)];
  const satellites = [
    satellite('25544', 'ISS (ZARYA)', 'stations'),
    satellite('1001', 'STARLINK-1001', 'communications'), satellite('1002', 'STARLINK-1002', 'communications'),
    satellite('2001', 'NOAA 20', 'weather'), satellite('3001', 'GPS BIIR-2', 'navigation', 2.0),
    satellite('4001', 'SENTINEL-2A', 'earth-observation'),
  ];
  const earthquakeFeed: EarthquakeFeed = { generatedAt: NOW, title: 'USGS day', count: quakes.length, window: 'day', earthquakes: quakes };
  const naturalFeed: NaturalEventFeed = {
    fetchedAt: NOW, sourceUpdatedAt: NOW, events,
    categoryCounts: { 'severe-storm': 1, wildfire: 1, volcano: 0 }, partial: false,
  };
  const orbitCatalog: OrbitCatalog = {
    satellites,
    categoryCounts: { stations: 1, weather: 1, 'earth-observation': 1, navigation: 1, science: 0, communications: 2 },
    newestElementEpoch: NOW, oldestElementEpoch: NOW, loadedGroups: ['stations', 'weather', 'navigation', 'earth-observation'], failedGroups: [], partial: false,
  };
  const spaceWeather: SpaceWeatherFeed = {
    fetchedAt: NOW, sourceUpdatedAt: NOW,
    kp: [{ timestamp: NOW - 30 * 60_000, kp: 6.0, kind: 'observed', noaaScale: 'G2' }],
    scales: { timestamp: NOW, G: { scale: 2, text: 'Moderate' }, R: { scale: 1, text: 'Minor' }, S: { scale: 0, text: null } },
    solarWind: { timestamp: NOW, speedKmS: 520, btNt: 7, bzGsmNt: -4 }, messages: [{ productId: 'x', issuedAt: NOW - 60_000, kind: 'watch', title: 'Watch', message: 'Test' }],
    aurora: null, partial: false, unavailableSources: [],
  };
  return {
    generatedAt: NOW,
    earthquakes: snapshot('usgs', 'observed', earthquakeFeed),
    naturalEvents: snapshot('eonet', 'observed', naturalFeed),
    orbit: snapshot('celestrak', 'propagated', orbitCatalog),
    spaceWeather: snapshot('swpc', 'forecast', spaceWeather),
    observer: null,
    errors: {},
  };
}

describe('Phase 23 dynamic briefings', () => {
  it('composes Earth Right Now from provider counts and the strongest earthquake', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['earth-now']!;
    expect(definition.dataDriven).toBe(true);
    expect(definition.dataState).toBe('live');
    expect(definition.dataSummary).toContain('2 quakes');
    expect(definition.description).toContain('M6.4');
    expect(definition.steps.some((step) => step.title.includes('M6.4'))).toBe(true);
  });

  it('builds a seismic briefing with day-feed and magnitude counts', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['seismic-now']!;
    expect(definition.dataSummary).toContain('2 day-feed events');
    expect(definition.dataSummary).toContain('1 M5+');
    expect(definition.steps[0]?.body).toContain('1 are M5.0+');
  });

  it('limits Active Storms to severe-storm records and source geometry', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['storm-watch']!;
    expect(definition.dataSummary).toContain('1 applicable severe-storm');
    expect(definition.description).toContain('Hurricane Test');
    expect(definition.steps.some((step) => step.body.includes('2 source geometry reports'))).toBe(true);
  });

  it('summarizes NOAA Kp and G/R/S values without merging their semantics', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['space-weather-now']!;
    expect(definition.dataSummary).toContain('Kp 6.0 observed');
    expect(definition.dataSummary).toContain('G2');
    expect(definition.steps.some((step) => step.body.includes('Solar wind is 520 km/s'))).toBe(true);
  });

  it('uses the loaded orbit catalog and recognized constellation counts', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['orbit-now']!;
    expect(definition.dataSummary).toContain('6 objects');
    expect(definition.dataSummary).toContain('Starlink 2');
    expect(definition.steps.some((step) => step.id === 'orbit-iss')).toBe(true);
    expect(definition.steps.some((step) => step.id === 'orbit-navigation')).toBe(true);
  });

  it('makes Above Me unavailable rather than requesting or guessing a location', () => {
    const definition = buildDynamicBriefings(baseSnapshot())['above-me']!;
    expect(definition.available).toBe(false);
    expect(definition.dataState).toBe('unavailable');
    expect(definition.steps).toHaveLength(0);
    expect(definition.unavailableReason).toContain('Remember this coordinate');
  });

  it('composes Above Me from a remembered observer snapshot and current weather only', () => {
    const input = baseSnapshot();
    const weather: LocalWeather = {
      timestamp: NOW, timezone: 'Europe/Berlin', utcOffsetSeconds: 7_200, elevationM: 100,
      temperatureC: 16.5, apparentTemperatureC: 16, relativeHumidityPct: 60, precipitationMm: 0, weatherCode: 0,
      cloudCoverPct: 22, windSpeedKmh: 12, windDirectionDeg: 240,
    };
    input.observer = {
      location: { lat: 50, lon: 8, altitudeKm: 0.1, accuracyM: null, acquiredAt: NOW, source: 'saved' },
      weather: snapshot('openmeteo', 'forecast', weather),
      astronomy: observerAstronomy(50, 8, NOW), auroraValue: 18, auroraApplicable: true,
    };
    const definition = buildDynamicBriefings(input)['above-me']!;
    expect(definition.available).toBe(true);
    expect(definition.dataSummary).toContain('22% cloud');
    expect(definition.steps.some((step) => step.body.includes('Open-Meteo current conditions'))).toBe(true);
    expect(definition.steps.some((step) => step.body.includes('not projected into future observing conditions'))).toBe(true);
  });

  it('degrades missing providers without fabricating missing sections', () => {
    const input = baseSnapshot();
    input.spaceWeather = null;
    input.orbit = null;
    input.errors = { swpc: 'offline', celestrak: 'offline' };
    const definitions = buildDynamicBriefings(input);
    expect(definitions['earth-now']!.dataState).toBe('partial');
    expect(definitions['earth-now']!.steps.some((step) => step.id === 'earth-space')).toBe(false);
    expect(definitions['earth-now']!.steps.some((step) => step.id === 'earth-orbit')).toBe(false);
    expect(definitions['orbit-now']!.available).toBe(false);
  });

  it('uses only existing deterministic tour instruction types', () => {
    const definitions = Object.values(buildDynamicBriefings(baseSnapshot())).filter(Boolean);
    const allowed = new Set(['frame-earth', 'set-visual-mode', 'set-layer', 'set-orbit-categories', 'set-natural-event-categories', 'set-earthquake-filter', 'clear-selection', 'select-strongest-earthquake', 'select-featured-natural-event', 'select-satellite', 'focus-selection', 'follow-selected-satellite', 'frame-selected-orbit', 'set-speed', 'seek-hours', 'return-live', 'stop-camera']);
    for (const definition of definitions) {
      for (const instruction of definition!.steps.flatMap((step) => step.instructions)) expect(allowed.has(instruction.type)).toBe(true);
    }
  });
});
