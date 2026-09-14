import type { EntityId } from '../../shared/types/entities';
import type { SatelliteCategory } from '../../shared/types/orbit';

export interface ObserverLocation {
  lat: number;
  lon: number;
  altitudeKm: number;
  accuracyM: number | null;
  acquiredAt: number;
  source: 'browser' | 'saved';
}

export interface LocalWeather {
  timestamp: number;
  timezone: string;
  utcOffsetSeconds: number;
  elevationM: number | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  relativeHumidityPct: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  cloudCoverPct: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
}

export interface ObserverSkySatellite {
  id: EntityId;
  catalogIndex: number;
  name: string;
  category: SatelliteCategory;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  altitudeKm: number;
  speedKmS: number;
  /** 0 = fully sunlit, 1 = full Earth umbra, intermediate = penumbra. */
  shadowFraction: number;
}

export interface ObserverSkySnapshot {
  timestamp: number;
  visibleCount: number;
  satellites: ObserverSkySatellite[];
}

export interface SatellitePass {
  satelliteId: EntityId;
  startTime: number;
  endTime: number;
  maxTime: number;
  maxElevationDeg: number;
  riseAzimuthDeg: number;
  maxAzimuthDeg: number;
  setAzimuthDeg: number;
  /** Earth-shadow fraction at maximum elevation: 0 = sunlit, 1 = umbra. */
  maxShadowFraction: number;
}

export interface ObserverPassForecast {
  generatedAt: number;
  startTime: number;
  horizonHours: number;
  satelliteId: EntityId;
  passes: SatellitePass[];
}

export type GeolocationState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';
