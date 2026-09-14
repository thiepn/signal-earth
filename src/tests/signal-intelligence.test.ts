import { describe, expect, it } from 'vitest';
import {
  boundedIntensityScore,
  buildEarthquakeIntelligence,
  buildNaturalEventIntelligence,
  buildSatelliteIntelligence,
  buildSpaceWeatherIntelligence,
} from '../features/intelligence/derive';
import type { NaturalEventRecord } from '../features/natural-events/types';
import type { SatelliteRecord, SatelliteTelemetry } from '../features/orbit/types';
import type { EarthquakeRecord } from '../features/seismic/types';
import type { KpSample, SolarWindObservation, SpaceWeatherScaleSnapshot } from '../features/space-weather/types';
import { asEntityId } from '../shared/types/entities';

const earthquake: EarthquakeRecord = {
  id: asEntityId('earthquake:test'),
  usgsId: 'test',
  place: 'Test region',
  magnitude: 7.2,
  magnitudeType: 'mww',
  time: Date.UTC(2026, 8, 14, 8),
  updated: Date.UTC(2026, 8, 14, 8, 5),
  coordinates: { lat: 35, lon: 140, depthKm: 24 },
  url: 'https://example.test/quake',
  detailUrl: 'https://example.test/quake.json',
  felt: 842,
  cdi: 6.2,
  mmi: 7.1,
  alert: 'orange',
  status: 'reviewed',
  tsunami: true,
  significance: 1_112,
  network: 'us',
  code: 'test',
};

const naturalEvent: NaturalEventRecord = {
  id: asEntityId('event:test'),
  eonetId: 'EONET_TEST',
  title: 'Test storm',
  description: null,
  category: 'severe-storm',
  categoryTitle: 'Severe Storms',
  link: 'https://example.test/event',
  sources: [{ id: 'TEST', url: 'https://example.test/source' }],
  startTime: Date.UTC(2026, 8, 10),
  closedAt: null,
  updatedAt: Date.UTC(2026, 8, 12, 12),
  geometry: [
    { timestamp: Date.UTC(2026, 8, 10), type: 'point', point: { lat: 10, lon: 120 }, magnitudeValue: 60, magnitudeUnit: 'kts', magnitudeDescription: 'wind' },
    { timestamp: Date.UTC(2026, 8, 11), type: 'point', point: { lat: 12, lon: 123 }, magnitudeValue: 70, magnitudeUnit: 'kts', magnitudeDescription: 'wind' },
    { timestamp: Date.UTC(2026, 8, 12), type: 'point', point: { lat: 15, lon: 126 }, magnitudeValue: 80, magnitudeUnit: 'kts', magnitudeDescription: 'wind' },
  ],
};

const satellite: SatelliteRecord = {
  id: asEntityId('satellite:25544'),
  noradId: '25544',
  name: 'TEST SAT',
  category: 'stations',
  categories: ['stations'],
  epoch: Date.UTC(2026, 8, 14, 8),
  source: 'celestrak',
  omm: {
    OBJECT_NAME: 'TEST SAT',
    EPOCH: '2026-09-14T08:00:00.000000',
    MEAN_MOTION: 15,
    ECCENTRICITY: 0.0005,
    INCLINATION: 51.64,
    RA_OF_ASC_NODE: 120,
    ARG_OF_PERICENTER: 80,
    MEAN_ANOMALY: 20,
    NORAD_CAT_ID: 25544,
  },
};

const telemetry: SatelliteTelemetry = {
  id: satellite.id,
  timestamp: Date.UTC(2026, 8, 14, 10),
  lat: 20,
  lon: 30,
  altitudeKm: 420,
  speedKmS: 7.66,
};

describe('Signal Intelligence', () => {
  it('identifies high-impact earthquake cues without turning a tsunami flag into a tsunami claim', () => {
    const result = buildEarthquakeIntelligence(earthquake);
    expect(result.tone).toBe('high');
    expect(result.title).toContain('Major');
    expect(result.summary).toContain('tsunami flag present');
    expect(result.summary).toContain('not a claim that a tsunami occurred');
    expect(result.facts.find((fact) => fact.label === 'Depth regime')?.value).toContain('Shallow');
  });

  it('escalates red-alert earthquakes to critical', () => {
    const result = buildEarthquakeIntelligence({ ...earthquake, alert: 'red' });
    expect(result.tone).toBe('critical');
  });

  it('derives natural-event movement only from reports available at simulation time', () => {
    const result = buildNaturalEventIntelligence(naturalEvent, Date.UTC(2026, 8, 11, 12));
    expect(result.title).toContain('Open severe storm');
    expect(result.facts.find((fact) => fact.label === 'Geometry reports')?.value).toBe('2');
    expect(result.summary).toContain('latest reported center shifted');
  });

  it('reports cumulative natural-event history at a later simulation time', () => {
    const result = buildNaturalEventIntelligence(naturalEvent, Date.UTC(2026, 8, 13));
    expect(result.facts.find((fact) => fact.label === 'Geometry reports')?.value).toBe('3');
    expect(result.facts.find((fact) => fact.label === 'Reported track')?.value).not.toBe('Not available');
    expect(result.methodology).toContain('representative geometry points');
  });

  it('derives satellite period and orbit shape from OMM elements', () => {
    const result = buildSatelliteIntelligence(satellite, telemetry);
    expect(result.title).toContain('Low Earth orbit');
    expect(result.title).toContain('96.0 min');
    expect(result.summary).toContain('Near-circular');
    expect(result.facts.find((fact) => fact.label === 'Inclination')?.value).toBe('51.64°');
  });

  it('warns when propagated telemetry is far from the element epoch', () => {
    const result = buildSatelliteIntelligence(satellite, { ...telemetry, timestamp: satellite.epoch + 30 * 60 * 60_000 });
    expect(result.tone).toBe('watch');
    expect(result.facts.find((fact) => fact.label === 'Element timing')?.value).toContain('30 h after');
  });

  it('summarizes applicable NOAA scales and space-weather observations', () => {
    const kp: KpSample = { timestamp: telemetry.timestamp, kp: 7, kind: 'observed', noaaScale: 'G3' };
    const scales: SpaceWeatherScaleSnapshot = {
      timestamp: telemetry.timestamp,
      G: { scale: 4, text: 'Severe' },
      R: { scale: 1, text: 'Minor' },
      S: { scale: 0, text: null },
    };
    const solarWind: SolarWindObservation = { timestamp: telemetry.timestamp, speedKmS: 620, btNt: 12, bzGsmNt: -8.5 };
    const result = buildSpaceWeatherIntelligence({ kp, scales, solarWind, scalesApplicable: true, solarWindApplicable: true, auroraApplicable: true });
    expect(result.tone).toBe('critical');
    expect(result.title).toContain('G4');
    expect(result.summary).toContain('southward');
    expect(result.summary).toContain('OVATION');
  });

  it('does not backfill current NOAA scales into unrelated time', () => {
    const kp: KpSample = { timestamp: telemetry.timestamp, kp: 3.2, kind: 'observed', noaaScale: null };
    const scales: SpaceWeatherScaleSnapshot = {
      timestamp: telemetry.timestamp,
      G: { scale: 5, text: 'Extreme' },
      R: { scale: 5, text: 'Extreme' },
      S: { scale: 5, text: 'Extreme' },
    };
    const result = buildSpaceWeatherIntelligence({ kp, scales, solarWind: null, scalesApplicable: false, solarWindApplicable: false, auroraApplicable: false });
    expect(result.tone).toBe('neutral');
    expect(result.title).toContain('Kp 3.2');
    expect(result.facts.find((fact) => fact.label === 'G scale')?.value).toBe('Not applicable');
  });

  it('bounds normalized intensity helpers safely', () => {
    expect(boundedIntensityScore(-10, 0, 10)).toBe(0);
    expect(boundedIntensityScore(5, 0, 10)).toBe(0.5);
    expect(boundedIntensityScore(20, 0, 10)).toBe(1);
    expect(boundedIntensityScore(5, 10, 10)).toBe(0);
  });
});
