import { describe, expect, it } from 'vitest';
import { OpenMeteoProvider } from '../providers/openmeteo/OpenMeteoProvider';

const raw = {
  latitude: 50.94,
  longitude: 6.96,
  elevation: 53,
  timezone: 'Europe/Berlin',
  utc_offset_seconds: 7200,
  current: {
    time: '2026-09-12T14:30',
    interval: 900,
    temperature_2m: 18.4,
    apparent_temperature: 18.1,
    relative_humidity_2m: 64,
    precipitation: 0.2,
    weather_code: 3,
    cloud_cover: 71,
    wind_speed_10m: 16.2,
    wind_direction_10m: 225,
  },
};

describe('OpenMeteoProvider', () => {
  it('normalizes current local conditions and converts local API time to UTC', () => {
    const provider = new OpenMeteoProvider(50.94, 6.96);
    const weather = provider.normalize(raw);
    expect(weather.timestamp).toBe(Date.parse('2026-09-12T12:30:00Z'));
    expect(weather.temperatureC).toBe(18.4);
    expect(weather.cloudCoverPct).toBe(71);
    expect(weather.windDirectionDeg).toBe(225);
    expect(weather.timezone).toBe('Europe/Berlin');
    expect(provider.validate(weather)).toBe(true);
  });

  it('rejects impossible percentages and wind directions', () => {
    const provider = new OpenMeteoProvider(50.94, 6.96);
    const weather = provider.normalize(raw);
    expect(provider.validate({ ...weather, relativeHumidityPct: 140 })).toBe(false);
    expect(provider.validate({ ...weather, windDirectionDeg: 500 })).toBe(false);
  });
});
