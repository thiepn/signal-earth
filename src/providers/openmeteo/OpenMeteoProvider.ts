import type { ProviderAdapter } from '../../core/data/ProviderAdapter';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import type { LocalWeather } from '../../features/above-me/types';
import type { OpenMeteoRaw } from './types';

export const OPEN_METEO_CACHE_POLICY = {
  ttlMs: 15 * 60_000,
  staleForMs: 2 * 60 * 60_000,
} as const;

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = /(?:Z|[+-]\d\d:?\d\d)$/i.test(value) ? value : `${value}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export class OpenMeteoProvider implements ProviderAdapter<OpenMeteoRaw, LocalWeather> {
  readonly id = 'openmeteo' as const;
  readonly source = SOURCE_REGISTRY.openmeteo;
  readonly temporalType = 'forecast' as const;
  readonly cachePolicy = OPEN_METEO_CACHE_POLICY;
  readonly lat: number;
  readonly lon: number;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  async fetchRaw(signal?: AbortSignal): Promise<OpenMeteoRaw> {
    const params = new URLSearchParams({
      latitude: this.lat.toFixed(5),
      longitude: this.lon.toFixed(5),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      ...(signal ? { signal } : {}),
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    });
    if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status}).`);
    return await response.json() as OpenMeteoRaw;
  }

  normalize(raw: OpenMeteoRaw): LocalWeather {
    const current = raw.current ?? {};
    const offsetSeconds = finite(raw.utc_offset_seconds) ?? 0;
    const rawTimestamp = parseTime(current.time);
    const timestamp = rawTimestamp === null ? Date.now() : rawTimestamp - offsetSeconds * 1_000;
    return {
      timestamp,
      timezone: typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone : 'UTC',
      utcOffsetSeconds: offsetSeconds,
      elevationM: finite(raw.elevation),
      temperatureC: finite(current.temperature_2m),
      apparentTemperatureC: finite(current.apparent_temperature),
      relativeHumidityPct: finite(current.relative_humidity_2m),
      precipitationMm: finite(current.precipitation),
      weatherCode: finite(current.weather_code),
      cloudCoverPct: finite(current.cloud_cover),
      windSpeedKmh: finite(current.wind_speed_10m),
      windDirectionDeg: finite(current.wind_direction_10m),
    };
  }

  validate(weather: LocalWeather): boolean {
    return Number.isFinite(weather.timestamp)
      && typeof weather.timezone === 'string'
      && Number.isFinite(weather.utcOffsetSeconds)
      && (weather.temperatureC === null || (weather.temperatureC > -100 && weather.temperatureC < 70))
      && (weather.cloudCoverPct === null || (weather.cloudCoverPct >= 0 && weather.cloudCoverPct <= 100))
      && (weather.relativeHumidityPct === null || (weather.relativeHumidityPct >= 0 && weather.relativeHumidityPct <= 100))
      && (weather.windDirectionDeg === null || (weather.windDirectionDeg >= 0 && weather.windDirectionDeg <= 360));
  }
}
