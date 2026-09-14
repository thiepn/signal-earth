import { julianDay, normalizeDegrees } from './solar';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = 2_451_545;
const EARTH_SUN_DISTANCE_KM = 149_598_000;

export interface MoonEquatorialCoordinates {
  rightAscensionRad: number;
  declinationRad: number;
  distanceKm: number;
}

export interface MoonObserverState extends MoonEquatorialCoordinates {
  azimuthDeg: number;
  elevationDeg: number;
  illuminatedFraction: number;
  phase: number;
  phaseName: string;
}

function daysSinceJ2000(timestamp: number): number {
  return julianDay(timestamp) - J2000;
}

function rightAscension(l: number, b: number): number {
  const e = DEG * 23.4397;
  return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
}

function declination(l: number, b: number): number {
  const e = DEG * 23.4397;
  return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
}

function solarEquatorial(timestamp: number): { rightAscensionRad: number; declinationRad: number } {
  const d = daysSinceJ2000(timestamp);
  const meanAnomaly = DEG * (357.5291 + 0.98560028 * d);
  const equation = DEG * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = DEG * 102.9372;
  const eclipticLongitude = meanAnomaly + equation + perihelion + Math.PI;
  return {
    rightAscensionRad: rightAscension(eclipticLongitude, 0),
    declinationRad: declination(eclipticLongitude, 0),
  };
}

export function moonEquatorialCoordinates(timestamp: number): MoonEquatorialCoordinates {
  const d = daysSinceJ2000(timestamp);
  const meanLongitude = DEG * (218.316 + 13.176396 * d);
  const meanAnomaly = DEG * (134.963 + 13.064993 * d);
  const argumentLatitude = DEG * (93.272 + 13.229350 * d);
  const longitude = meanLongitude + DEG * 6.289 * Math.sin(meanAnomaly);
  const latitude = DEG * 5.128 * Math.sin(argumentLatitude);
  const distanceKm = 385_001 - 20_905 * Math.cos(meanAnomaly);
  return {
    rightAscensionRad: rightAscension(longitude, latitude),
    declinationRad: declination(longitude, latitude),
    distanceKm,
  };
}

function localSiderealRadians(timestamp: number, longitudeDeg: number): number {
  const d = daysSinceJ2000(timestamp);
  return DEG * (280.16 + 360.9856235 * d + longitudeDeg);
}

export function moonObserverState(latitudeDeg: number, longitudeDeg: number, timestamp: number): MoonObserverState {
  const moon = moonEquatorialCoordinates(timestamp);
  const sun = solarEquatorial(timestamp);
  const latitude = latitudeDeg * DEG;
  const hourAngle = localSiderealRadians(timestamp, longitudeDeg) - moon.rightAscensionRad;
  const elevation = Math.asin(
    Math.sin(latitude) * Math.sin(moon.declinationRad)
    + Math.cos(latitude) * Math.cos(moon.declinationRad) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(moon.declinationRad) * Math.cos(latitude),
  ) + Math.PI;

  const elongation = Math.acos(Math.max(-1, Math.min(1,
    Math.sin(sun.declinationRad) * Math.sin(moon.declinationRad)
    + Math.cos(sun.declinationRad) * Math.cos(moon.declinationRad)
      * Math.cos(sun.rightAscensionRad - moon.rightAscensionRad),
  )));
  const incidence = Math.atan2(
    EARTH_SUN_DISTANCE_KM * Math.sin(elongation),
    moon.distanceKm - EARTH_SUN_DISTANCE_KM * Math.cos(elongation),
  );
  const angle = Math.atan2(
    Math.cos(sun.declinationRad) * Math.sin(sun.rightAscensionRad - moon.rightAscensionRad),
    Math.sin(sun.declinationRad) * Math.cos(moon.declinationRad)
      - Math.cos(sun.declinationRad) * Math.sin(moon.declinationRad)
        * Math.cos(sun.rightAscensionRad - moon.rightAscensionRad),
  );
  const illuminatedFraction = (1 + Math.cos(incidence)) / 2;
  const phase = 0.5 + 0.5 * incidence * (angle < 0 ? -1 : 1) / Math.PI;

  return {
    ...moon,
    azimuthDeg: normalizeDegrees(azimuth * RAD),
    elevationDeg: elevation * RAD,
    illuminatedFraction: Math.max(0, Math.min(1, illuminatedFraction)),
    phase: ((phase % 1) + 1) % 1,
    phaseName: moonPhaseName(phase),
  };
}

export function moonPhaseName(value: number): string {
  const phase = ((value % 1) + 1) % 1;
  if (phase < 0.03 || phase >= 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}
