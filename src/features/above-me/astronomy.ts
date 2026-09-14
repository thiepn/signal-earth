import { moonObserverState, type MoonObserverState } from '../../core/astronomy/lunar';
import { nextSolarEvents, type SolarEventTimes } from '../../core/astronomy/observer';
import { normalizeDegrees, solarCoordinates, solarElevationDegrees } from '../../core/astronomy/solar';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface SunObserverState {
  azimuthDeg: number;
  elevationDeg: number;
  daylight: 'day' | 'civil-twilight' | 'night';
  nextSunrise: number | null;
  nextSunset: number | null;
}

export interface ObserverAstronomy {
  sun: SunObserverState;
  moon: MoonObserverState;
}

export function sunObserverState(latDeg: number, lonDeg: number, timestamp: number, solarEvents?: SolarEventTimes): SunObserverState {
  const solar = solarCoordinates(timestamp);
  const lat = latDeg * DEG;
  const dec = solar.declination * DEG;
  const hourAngle = solar.gmstRadians + lonDeg * DEG - solar.rightAscension * DEG;
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
  ) + Math.PI;
  const elevationDeg = solarElevationDegrees(latDeg, lonDeg, timestamp);
  const events = solarEvents ?? nextSolarEvents(latDeg, lonDeg, timestamp);
  return {
    azimuthDeg: normalizeDegrees(azimuth * RAD),
    elevationDeg,
    daylight: elevationDeg >= 0 ? 'day' : elevationDeg >= -6 ? 'civil-twilight' : 'night',
    ...events,
  };
}

export function observerAstronomy(lat: number, lon: number, timestamp: number, solarEvents?: SolarEventTimes): ObserverAstronomy {
  return { sun: sunObserverState(lat, lon, timestamp, solarEvents), moon: moonObserverState(lat, lon, timestamp) };
}

