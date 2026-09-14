import { describe, expect, it } from 'vitest';
import { moonObserverState, moonPhaseName } from '../core/astronomy/lunar';
import { nextSolarEvents } from '../core/astronomy/observer';
import { observerAstronomy } from '../features/above-me/astronomy';
import { auroraModelValueAt } from '../features/above-me/aurora';
import type { AuroraModel } from '../features/space-weather/types';

describe('Above Me astronomy', () => {
  const lat = 50.94;
  const lon = 6.96;
  const time = Date.parse('2026-09-12T00:00:00Z');

  it('returns finite local Sun and Moon look angles', () => {
    const state = observerAstronomy(lat, lon, time);
    expect(Number.isFinite(state.sun.azimuthDeg)).toBe(true);
    expect(Number.isFinite(state.sun.elevationDeg)).toBe(true);
    expect(Number.isFinite(state.moon.azimuthDeg)).toBe(true);
    expect(Number.isFinite(state.moon.elevationDeg)).toBe(true);
    expect(state.moon.illuminatedFraction).toBeGreaterThanOrEqual(0);
    expect(state.moon.illuminatedFraction).toBeLessThanOrEqual(1);
  });

  it('finds future solar crossings in ordinary mid-latitude conditions', () => {
    const events = nextSolarEvents(lat, lon, time);
    expect(events.nextSunrise).not.toBeNull();
    expect(events.nextSunset).not.toBeNull();
    expect(events.nextSunrise!).toBeGreaterThan(time);
    expect(events.nextSunset!).toBeGreaterThan(time);
  });

  it('normalizes lunar phase names across wrapped values', () => {
    expect(moonPhaseName(0)).toBe('New Moon');
    expect(moonPhaseName(0.25)).toBe('First Quarter');
    expect(moonPhaseName(0.5)).toBe('Full Moon');
    expect(moonPhaseName(0.75)).toBe('Last Quarter');
    expect(moonPhaseName(1)).toBe('New Moon');
    expect(moonObserverState(lat, lon, time).phase).toBeGreaterThanOrEqual(0);
  });

  it('samples the closest OVATION point using wrapped longitude', () => {
    const model: AuroraModel = {
      observationTime: time,
      forecastTime: time + 30 * 60_000,
      coordinates: new Float32Array([
        -1, 68, 42,
        120, -70, 15,
      ]),
      pointCount: 2,
    };
    expect(auroraModelValueAt(model, 67.8, 359)).toBe(42);
  });
});
