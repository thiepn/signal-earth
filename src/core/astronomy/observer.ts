import { solarElevationDegrees } from './solar';

const SUNRISE_ELEVATION_DEG = -0.833;
const SEARCH_HORIZON_MS = 40 * 60 * 60_000;
const STEP_MS = 5 * 60_000;

export interface SolarEventTimes {
  nextSunrise: number | null;
  nextSunset: number | null;
}

function elevationOffset(lat: number, lon: number, timestamp: number): number {
  return solarElevationDegrees(lat, lon, timestamp) - SUNRISE_ELEVATION_DEG;
}

function refineCrossing(lat: number, lon: number, a: number, b: number): number {
  let low = a;
  let high = b;
  let lowValue = elevationOffset(lat, lon, low);
  for (let i = 0; i < 14; i += 1) {
    const mid = (low + high) / 2;
    const midValue = elevationOffset(lat, lon, mid);
    if ((lowValue <= 0 && midValue <= 0) || (lowValue >= 0 && midValue >= 0)) {
      low = mid;
      lowValue = midValue;
    } else high = mid;
  }
  return Math.round((low + high) / 2);
}

export function nextSolarEvents(lat: number, lon: number, timestamp: number): SolarEventTimes {
  let nextSunrise: number | null = null;
  let nextSunset: number | null = null;
  let previousTime = timestamp;
  let previousValue = elevationOffset(lat, lon, previousTime);
  const end = timestamp + SEARCH_HORIZON_MS;

  for (let time = timestamp + STEP_MS; time <= end && (!nextSunrise || !nextSunset); time += STEP_MS) {
    const value = elevationOffset(lat, lon, time);
    if (previousValue <= 0 && value > 0 && nextSunrise === null) nextSunrise = refineCrossing(lat, lon, previousTime, time);
    if (previousValue >= 0 && value < 0 && nextSunset === null) nextSunset = refineCrossing(lat, lon, previousTime, time);
    previousTime = time;
    previousValue = value;
  }
  return { nextSunrise, nextSunset };
}
