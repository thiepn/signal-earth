import { describe, expect, it } from 'vitest';
import {
  daylightState,
  greenwichMeanSiderealTimeRadians,
  julianDay,
  solarCoordinates,
  solarElevationDegrees,
} from '../core/astronomy/solar';

describe('solar astronomy', () => {
  it('converts the Unix epoch to its known Julian day', () => {
    expect(julianDay(Date.UTC(1970, 0, 1, 0, 0, 0))).toBeCloseTo(2_440_587.5, 6);
  });

  it('places the subsolar point close to the equator near the March equinox', () => {
    const solar = solarCoordinates(Date.UTC(2026, 2, 20, 14, 45));
    expect(Math.abs(solar.lat)).toBeLessThan(1.0);
  });

  it('reaches northern-solstice declination in June', () => {
    const solar = solarCoordinates(Date.UTC(2026, 5, 21, 12, 0));
    expect(solar.lat).toBeGreaterThan(23);
    expect(solar.lat).toBeLessThan(24);
  });

  it('keeps sidereal angle normalized', () => {
    const gmst = greenwichMeanSiderealTimeRadians(Date.UTC(2026, 8, 11, 12, 0));
    expect(gmst).toBeGreaterThanOrEqual(0);
    expect(gmst).toBeLessThan(Math.PI * 2);
  });

  it('puts the Sun high near the subsolar point', () => {
    const time = Date.UTC(2026, 8, 11, 12, 0);
    const solar = solarCoordinates(time);
    expect(solarElevationDegrees(solar.lat, solar.lon, time)).toBeGreaterThan(88);
  });

  it('classifies the anti-solar side as night', () => {
    const time = Date.UTC(2026, 8, 11, 12, 0);
    const solar = solarCoordinates(time);
    const oppositeLongitude = solar.lon > 0 ? solar.lon - 180 : solar.lon + 180;
    expect(daylightState(-solar.lat, oppositeLongitude, time)).toBe('night');
  });
});
