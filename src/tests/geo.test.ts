import { describe, expect, it } from 'vitest';
import {
  altitudeKmToGlobeRadiusUnits,
  geoToUnitCartesian,
  greatCircleDistanceKm,
  initialBearingDegrees,
  normalizeLongitude,
  unitCartesianToGeo,
} from '../shared/coordinates/geo';

describe('geographic coordinate utilities', () => {
  it('normalizes longitude without losing +180 semantics', () => {
    expect(normalizeLongitude(181)).toBe(-179);
    expect(normalizeLongitude(-181)).toBe(179);
    expect(normalizeLongitude(180)).toBe(180);
  });

  it('round-trips unit sphere coordinates', () => {
    const source = { lat: 50.94, lon: 6.96, altitudeKm: 408 };
    const roundTrip = unitCartesianToGeo(geoToUnitCartesian(source));
    expect(roundTrip.lat).toBeCloseTo(source.lat, 8);
    expect(roundTrip.lon).toBeCloseTo(source.lon, 8);
    expect(roundTrip.altitudeKm).toBeCloseTo(source.altitudeKm, 6);
  });

  it('calculates realistic great-circle distance and bearing', () => {
    const cologne = { lat: 50.94, lon: 6.96 };
    const london = { lat: 51.5074, lon: -0.1278 };
    expect(greatCircleDistanceKm(cologne, london)).toBeGreaterThan(490);
    expect(greatCircleDistanceKm(cologne, london)).toBeLessThan(520);
    expect(initialBearingDegrees(cologne, london)).toBeGreaterThan(270);
    expect(initialBearingDegrees(cologne, london)).toBeLessThan(290);
  });

  it('converts physical altitude to globe radius units', () => {
    expect(altitudeKmToGlobeRadiusUnits(6371.0088)).toBeCloseTo(1, 8);
  });
});
