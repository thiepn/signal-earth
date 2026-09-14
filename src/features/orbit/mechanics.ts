import {
  degreesLat,
  eciToGeodetic,
  gstime,
  jday,
  json2satrec,
  propagate,
  shadowFraction,
  sunPos,
  type OMMJsonObject,
} from 'satellite.js';
import type { OMMRecord } from '../../shared/types/orbit';
import type { SatelliteRecord } from './types';

const EARTH_MU_KM3_S2 = 398_600.4418;
const EARTH_EQUATORIAL_RADIUS_KM = 6_378.137;
const DAY_SECONDS = 86_400;
const MINUTE_MS = 60_000;

export type OrbitClass = 'leo' | 'meo' | 'geo' | 'heo';
export type OrbitDirection = 'ascending' | 'descending' | 'turning';
export type OrbitIllumination = 'sunlit' | 'penumbra' | 'umbra' | 'unavailable';

export interface OrbitMechanics {
  periodMinutes: number | null;
  semiMajorAxisKm: number | null;
  perigeeAltitudeKm: number | null;
  apogeeAltitudeKm: number | null;
  meanPhaseDeg: number | null;
  argumentOfLatitudeDeg: number | null;
  orbitClass: OrbitClass;
  direction: OrbitDirection;
  illumination: OrbitIllumination;
  shadowFraction: number | null;
  constellation: string | null;
}

export const ORBIT_CLASS_LABELS: Record<OrbitClass, string> = {
  leo: 'Low Earth orbit',
  meo: 'Medium Earth orbit',
  geo: 'Geosynchronous orbit',
  heo: 'High / elliptical orbit',
};

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function orbitalPeriodMinutes(omm: Pick<OMMRecord, 'MEAN_MOTION'>): number | null {
  return Number.isFinite(omm.MEAN_MOTION) && omm.MEAN_MOTION > 0 ? 1_440 / omm.MEAN_MOTION : null;
}

export function semiMajorAxisKm(omm: Pick<OMMRecord, 'MEAN_MOTION'>): number | null {
  if (!Number.isFinite(omm.MEAN_MOTION) || omm.MEAN_MOTION <= 0) return null;
  const meanMotionRadS = omm.MEAN_MOTION * Math.PI * 2 / DAY_SECONDS;
  const axis = Math.cbrt(EARTH_MU_KM3_S2 / (meanMotionRadS * meanMotionRadS));
  return Number.isFinite(axis) ? axis : null;
}

export function apsisAltitudesKm(omm: Pick<OMMRecord, 'MEAN_MOTION' | 'ECCENTRICITY'>): { perigeeKm: number; apogeeKm: number } | null {
  const axis = semiMajorAxisKm(omm);
  const eccentricity = omm.ECCENTRICITY;
  if (axis === null || !Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) return null;
  return {
    perigeeKm: axis * (1 - eccentricity) - EARTH_EQUATORIAL_RADIUS_KM,
    apogeeKm: axis * (1 + eccentricity) - EARTH_EQUATORIAL_RADIUS_KM,
  };
}

export function meanAnomalyAt(omm: Pick<OMMRecord, 'MEAN_ANOMALY' | 'MEAN_MOTION'>, epoch: number, timestamp: number): number | null {
  if (![omm.MEAN_ANOMALY, omm.MEAN_MOTION, epoch, timestamp].every(Number.isFinite) || omm.MEAN_MOTION <= 0) return null;
  const elapsedDays = (timestamp - epoch) / (DAY_SECONDS * 1_000);
  return normalizeDegrees(omm.MEAN_ANOMALY + elapsedDays * omm.MEAN_MOTION * 360);
}

export function orbitClassForOmm(omm: Pick<OMMRecord, 'MEAN_MOTION' | 'ECCENTRICITY'>): OrbitClass {
  const period = orbitalPeriodMinutes(omm);
  const apsides = apsisAltitudesKm(omm);
  if (!period || !apsides) return 'heo';
  if (period >= 1_320 && period <= 1_560 && omm.ECCENTRICITY < 0.12) return 'geo';
  if (apsides.apogeeKm < 2_000) return 'leo';
  if (omm.ECCENTRICITY >= 0.1 || apsides.apogeeKm >= 30_000) return 'heo';
  return 'meo';
}

export function constellationForSatellite(name: string): string | null {
  const value = name.toUpperCase();
  if (/STARLINK/.test(value)) return 'Starlink';
  if (/ONEWEB/.test(value)) return 'OneWeb';
  if (/\bGPS\b|NAVSTAR/.test(value)) return 'GPS';
  if (/GALILEO/.test(value)) return 'Galileo';
  if (/GLONASS/.test(value)) return 'GLONASS';
  if (/BEIDOU|\bBDS\b/.test(value)) return 'BeiDou';
  if (/IRIDIUM/.test(value)) return 'Iridium';
  if (/GLOBALSTAR/.test(value)) return 'Globalstar';
  if (/ORBCOMM/.test(value)) return 'ORBCOMM';
  if (/FLOCK|DOVE/.test(value)) return 'Planet';
  if (/SENTINEL/.test(value)) return 'Copernicus Sentinel';
  if (/GOES/.test(value)) return 'GOES';
  if (/NOAA/.test(value)) return 'NOAA';
  return null;
}

function satrecFor(satellite: SatelliteRecord) {
  return json2satrec(satellite.omm as unknown as OMMJsonObject);
}

function propagatedLatitude(satellite: SatelliteRecord, timestamp: number): number | null {
  try {
    const date = new Date(timestamp);
    const state = propagate(satrecFor(satellite), date);
    if (!state?.position) return null;
    const geodetic = eciToGeodetic(state.position, gstime(date));
    const latitude = degreesLat(geodetic.latitude);
    return Number.isFinite(latitude) ? latitude : null;
  } catch {
    return null;
  }
}

export function orbitDirectionAt(satellite: SatelliteRecord, timestamp: number): OrbitDirection {
  const before = propagatedLatitude(satellite, timestamp - 30_000);
  const after = propagatedLatitude(satellite, timestamp + 30_000);
  if (before === null || after === null) return 'turning';
  const delta = after - before;
  if (Math.abs(delta) < 0.015) return 'turning';
  return delta > 0 ? 'ascending' : 'descending';
}

export function satelliteIlluminationAt(satellite: SatelliteRecord, timestamp: number): { state: OrbitIllumination; shadowFraction: number | null } {
  try {
    const date = new Date(timestamp);
    const propagated = propagate(satrecFor(satellite), date);
    if (!propagated?.position) return { state: 'unavailable', shadowFraction: null };
    const sun = sunPos(jday(date));
    const shadow = shadowFraction(sun.rsun, propagated.position);
    if (!Number.isFinite(shadow)) return { state: 'unavailable', shadowFraction: null };
    if (shadow >= 0.995) return { state: 'umbra', shadowFraction: shadow };
    if (shadow <= 0.005) return { state: 'sunlit', shadowFraction: shadow };
    return { state: 'penumbra', shadowFraction: shadow };
  } catch {
    return { state: 'unavailable', shadowFraction: null };
  }
}

export function deriveOrbitMechanics(satellite: SatelliteRecord, timestamp: number): OrbitMechanics {
  const periodMinutes = orbitalPeriodMinutes(satellite.omm);
  const axis = semiMajorAxisKm(satellite.omm);
  const apsides = apsisAltitudesKm(satellite.omm);
  const phase = meanAnomalyAt(satellite.omm, satellite.epoch, timestamp);
  const argumentOfLatitudeDeg = phase === null || !Number.isFinite(satellite.omm.ARG_OF_PERICENTER)
    ? null
    : normalizeDegrees(phase + satellite.omm.ARG_OF_PERICENTER);
  const illumination = satelliteIlluminationAt(satellite, timestamp);
  return {
    periodMinutes,
    semiMajorAxisKm: axis,
    perigeeAltitudeKm: apsides?.perigeeKm ?? null,
    apogeeAltitudeKm: apsides?.apogeeKm ?? null,
    meanPhaseDeg: phase,
    argumentOfLatitudeDeg,
    orbitClass: orbitClassForOmm(satellite.omm),
    direction: orbitDirectionAt(satellite, timestamp),
    illumination: illumination.state,
    shadowFraction: illumination.shadowFraction,
    constellation: constellationForSatellite(satellite.name),
  };
}

export function formatOrbitClass(value: OrbitClass): string {
  return ORBIT_CLASS_LABELS[value];
}

export function formatIllumination(value: OrbitIllumination): string {
  if (value === 'sunlit') return 'Sunlit';
  if (value === 'penumbra') return 'Penumbra';
  if (value === 'umbra') return 'Earth shadow';
  return 'Unavailable';
}

export function compactOrbitDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 180) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(minutes >= 1_000 ? 1 : 2)} h`;
}

export function compactAltitude(km: number | null): string {
  if (km === null) return '—';
  return `${Math.round(km).toLocaleString()} km`;
}

export const ORBIT_MECHANICS_SAMPLE_MINUTES = 0.5;
export const ORBIT_PHASE_SAMPLE_MS = MINUTE_MS;
