import { describe, expect, it } from 'vitest';
import { assessSatelliteGeometry, currentObservingConditions, illuminationState, rankPasses, rankObserverSky } from '../features/above-me/visibility';
import type { ObserverPassForecast, ObserverSkySatellite } from '../features/above-me/types';
import { asEntityId } from '../shared/types/entities';

const skySat = (name: string, elevationDeg: number, shadowFraction: number): ObserverSkySatellite => ({
  id: asEntityId(`satellite:${name}`), catalogIndex: 0, name, category: 'stations', azimuthDeg: 180,
  elevationDeg, rangeKm: 500, altitudeKm: 420, speedKmS: 7.7, shadowFraction,
});

describe('Above Me 2.0 visibility intelligence', () => {
  it('classifies sunlight, penumbra and shadow', () => {
    expect(illuminationState(0)).toBe('sunlit');
    expect(illuminationState(0.4)).toBe('penumbra');
    expect(illuminationState(1)).toBe('shadow');
  });

  it('requires a dark observer sky for excellent geometry', () => {
    expect(assessSatelliteGeometry(70, 0, -15).quality).toBe('excellent');
    expect(assessSatelliteGeometry(70, 0, 2).quality).toBe('daylight');
  });

  it('does not call an eclipsed satellite favorable', () => {
    const result = assessSatelliteGeometry(80, 1, -18);
    expect(result.quality).toBe('eclipsed');
    expect(result.favorableGeometry).toBe(false);
  });

  it('ranks favorable illuminated satellites above eclipsed ones', () => {
    const ranked = rankObserverSky([skySat('shadow', 80, 1), skySat('lit', 45, 0)], -15);
    expect(ranked[0]?.satellite.name).toBe('lit');
  });

  it('scores ISS passes using observer darkness and pass illumination', () => {
    const forecast: ObserverPassForecast = {
      generatedAt: Date.UTC(2026, 8, 14), startTime: Date.UTC(2026, 8, 14), horizonHours: 24,
      satelliteId: asEntityId('satellite:25544'), passes: [
        { satelliteId: asEntityId('satellite:25544'), startTime: Date.UTC(2026, 8, 14, 0), endTime: Date.UTC(2026, 8, 14, 0, 8), maxTime: Date.UTC(2026, 8, 14, 0, 4), maxElevationDeg: 70, riseAzimuthDeg: 250, maxAzimuthDeg: 180, setAzimuthDeg: 90, maxShadowFraction: 0 },
        { satelliteId: asEntityId('satellite:25544'), startTime: Date.UTC(2026, 8, 14, 12), endTime: Date.UTC(2026, 8, 14, 12, 8), maxTime: Date.UTC(2026, 8, 14, 12, 4), maxElevationDeg: 85, riseAzimuthDeg: 250, maxAzimuthDeg: 180, setAzimuthDeg: 90, maxShadowFraction: 0 },
      ],
    };
    const ranked = rankPasses(forecast, 50.94, 6.96, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.assessment.score).toBeGreaterThanOrEqual(ranked[1]!.assessment.score);
  });

  it('uses current cloud cover only when weather is applicable', () => {
    const weather = { timestamp: Date.now(), timezone: 'Europe/Berlin', utcOffsetSeconds: 7200, elevationM: 40, temperatureC: 18, apparentTemperatureC: 18, relativeHumidityPct: 60, precipitationMm: 0, weatherCode: 0, cloudCoverPct: 15, windSpeedKmh: 8, windDirectionDeg: 220 };
    expect(currentObservingConditions(weather, true, -15).quality).toBe('good');
    expect(currentObservingConditions(weather, false, -15).quality).toBe('unknown');
  });
});
