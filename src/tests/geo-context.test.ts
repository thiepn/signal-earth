import { describe, expect, it } from 'vitest';
import { angularDistanceDeg, geoContextBand, selectGeoContextLabels, type GeoContextCountry } from '../features/globe/geoContext';

const countries: GeoContextCountry[] = [
  { name: 'Germany', lat: 51, lon: 10 },
  { name: 'France', lat: 46, lon: 2 },
  { name: 'Japan', lat: 36, lon: 138 },
  { name: 'United States of America', lat: 39, lon: -98 },
];

describe('geographic context', () => {
  it('computes stable angular distance across the date line', () => {
    expect(angularDistanceDeg(0, 179, 0, -179)).toBeCloseTo(2, 5);
    expect(angularDistanceDeg(0, 0, 0, 90)).toBeCloseTo(90, 5);
  });

  it('classifies zoom bands', () => {
    expect(geoContextBand(3.2)).toBe('global');
    expect(geoContextBand(1.5)).toBe('regional');
    expect(geoContextBand(0.7)).toBe('local');
  });

  it('keeps global context sparse', () => {
    const labels = selectGeoContextLabels(countries, { lat: 20, lng: 10, altitude: 3.1 });
    expect(labels.every((label) => label.kind === 'country')).toBe(true);
    expect(labels.map((label) => label.name)).toContain('Germany');
  });

  it('adds nearby cities as the camera approaches the surface', () => {
    const labels = selectGeoContextLabels(countries, { lat: 50.9, lng: 7, altitude: 0.65 });
    expect(labels.some((label) => label.kind === 'city' && label.name === 'Cologne')).toBe(true);
    expect(labels.some((label) => label.kind === 'country' && label.name === 'Germany')).toBe(true);
    expect(labels.some((label) => label.name === 'Japan')).toBe(false);
  });
});
