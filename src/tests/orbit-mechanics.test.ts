import { describe, expect, it } from 'vitest';
import { asSatelliteId } from '../features/orbit/types';
import {
  apsisAltitudesKm,
  constellationForSatellite,
  deriveOrbitMechanics,
  meanAnomalyAt,
  orbitalPeriodMinutes,
  orbitClassForOmm,
  semiMajorAxisKm,
} from '../features/orbit/mechanics';
import type { SatelliteRecord } from '../features/orbit/types';
import type { OMMRecord } from '../shared/types/orbit';

function omm(overrides: Partial<OMMRecord> = {}): OMMRecord {
  return {
    OBJECT_NAME: 'ISS (ZARYA)',
    EPOCH: '2026-09-14T00:00:00.000Z',
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0005,
    INCLINATION: 51.64,
    RA_OF_ASC_NODE: 120,
    ARG_OF_PERICENTER: 60,
    MEAN_ANOMALY: 30,
    NORAD_CAT_ID: 25544,
    ...overrides,
  };
}

function satellite(record: OMMRecord = omm(), name = record.OBJECT_NAME): SatelliteRecord {
  return {
    id: asSatelliteId(record.NORAD_CAT_ID),
    noradId: String(record.NORAD_CAT_ID),
    name,
    omm: record,
    category: 'stations',
    categories: ['stations'],
    epoch: Date.parse(record.EPOCH),
    source: 'celestrak',
  };
}

describe('Orbit 2.0 mechanics', () => {
  it('derives LEO period and apsides from mean elements', () => {
    const record = omm();
    expect(orbitalPeriodMinutes(record)).toBeCloseTo(92.9, 1);
    expect(semiMajorAxisKm(record)).toBeGreaterThan(6_700);
    const apsides = apsisAltitudesKm(record)!;
    expect(apsides.perigeeKm).toBeGreaterThan(300);
    expect(apsides.apogeeKm).toBeLessThan(600);
    expect(orbitClassForOmm(record)).toBe('leo');
  });

  it('classifies navigation-like and geosynchronous mean elements', () => {
    expect(orbitClassForOmm(omm({ MEAN_MOTION: 2.0056, ECCENTRICITY: 0.01 }))).toBe('meo');
    expect(orbitClassForOmm(omm({ MEAN_MOTION: 1.0027, ECCENTRICITY: 0.0002 }))).toBe('geo');
  });

  it('classifies highly eccentric high-apogee orbits separately', () => {
    expect(orbitClassForOmm(omm({ MEAN_MOTION: 2.006, ECCENTRICITY: 0.74 }))).toBe('heo');
  });

  it('advances mean orbital phase with mean motion', () => {
    const record = omm({ MEAN_MOTION: 12, MEAN_ANOMALY: 10 });
    const epoch = Date.parse(record.EPOCH);
    expect(meanAnomalyAt(record, epoch, epoch)).toBeCloseTo(10, 6);
    expect(meanAnomalyAt(record, epoch, epoch + 60 * 60_000)).toBeCloseTo(190, 6);
  });

  it('detects major satellite constellations and programs by name', () => {
    expect(constellationForSatellite('STARLINK-12345')).toBe('Starlink');
    expect(constellationForSatellite('GALILEO 31')).toBe('Galileo');
    expect(constellationForSatellite('SENTINEL-2C')).toBe('Copernicus Sentinel');
    expect(constellationForSatellite('HST')).toBeNull();
  });

  it('derives selected-time illumination and ground-track direction without remote data', () => {
    const record = omm();
    const value = deriveOrbitMechanics(satellite(record), Date.parse(record.EPOCH) + 15 * 60_000);
    expect(value.periodMinutes).toBeCloseTo(92.9, 1);
    expect(value.orbitClass).toBe('leo');
    expect(['ascending', 'descending', 'turning']).toContain(value.direction);
    expect(['sunlit', 'penumbra', 'umbra', 'unavailable']).toContain(value.illumination);
    if (value.shadowFraction !== null) {
      expect(value.shadowFraction).toBeGreaterThanOrEqual(0);
      expect(value.shadowFraction).toBeLessThanOrEqual(1);
    }
  });
});
