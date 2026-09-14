const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = 2_451_545.0;

export interface SolarCoordinates {
  /** Subsolar geographic latitude in degrees. */
  lat: number;
  /** Subsolar geographic longitude in degrees, normalized to [-180, 180). */
  lon: number;
  /** Apparent solar declination in degrees. */
  declination: number;
  /** Apparent solar right ascension in degrees, normalized to [0, 360). */
  rightAscension: number;
  /** Greenwich mean sidereal angle in radians, normalized to [0, 2π). */
  gmstRadians: number;
}

export function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function normalizeLongitude(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function julianDay(timestamp: number): number {
  return timestamp / 86_400_000 + 2_440_587.5;
}

/**
 * Greenwich mean sidereal time using the standard J2000 polynomial.
 * Sufficiently accurate for visual Earth/sky alignment and observer geometry.
 */
export function greenwichMeanSiderealTimeRadians(timestamp: number): number {
  const jd = julianDay(timestamp);
  const centuries = (jd - J2000) / 36_525;
  const degrees = normalizeDegrees(
    280.46061837
    + 360.98564736629 * (jd - J2000)
    + 0.000387933 * centuries * centuries
    - (centuries * centuries * centuries) / 38_710_000,
  );
  return degrees * DEG;
}

/**
 * Approximate apparent Sun coordinates for the supplied UTC timestamp.
 * Uses the compact solar-position formulation around J2000. Error is far below
 * what is perceptible in Signal Earth's globe-scale terminator rendering.
 */
export function solarCoordinates(timestamp: number): SolarCoordinates {
  const jd = julianDay(timestamp);
  const n = jd - J2000;
  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * n);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * n) * DEG;
  const eclipticLongitude = normalizeDegrees(
    meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly),
  ) * DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;

  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const gmstRadians = greenwichMeanSiderealTimeRadians(timestamp);
  const subsolarLongitude = normalizeLongitude((rightAscension - gmstRadians) * RAD);

  return {
    lat: declination * RAD,
    lon: subsolarLongitude,
    declination: declination * RAD,
    rightAscension: normalizeDegrees(rightAscension * RAD),
    gmstRadians,
  };
}

/**
 * Solar elevation angle above a local geometric horizon in degrees.
 * Positive values are above the horizon; -6° is approximately civil twilight.
 */
export function solarElevationDegrees(
  latitude: number,
  longitude: number,
  timestamp: number,
): number {
  const solar = solarCoordinates(timestamp);
  const lat = latitude * DEG;
  const dec = solar.declination * DEG;
  const hourAngle = normalizeLongitude(longitude - solar.lon) * DEG;
  const sinElevation = (
    Math.sin(lat) * Math.sin(dec)
    + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)
  );
  return Math.asin(Math.max(-1, Math.min(1, sinElevation))) * RAD;
}

export function daylightState(
  latitude: number,
  longitude: number,
  timestamp: number,
): 'day' | 'civil-twilight' | 'night' {
  const elevation = solarElevationDegrees(latitude, longitude, timestamp);
  if (elevation >= 0) return 'day';
  if (elevation >= -6) return 'civil-twilight';
  return 'night';
}
