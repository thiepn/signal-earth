import type { GeoCoordinates } from '../types/entities';

export const EARTH_RADIUS_KM = 6371.0088;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface Cartesian3 {
  x: number;
  y: number;
  z: number;
}

export function clampLatitude(lat: number): number {
  if (!Number.isFinite(lat)) throw new RangeError('Latitude must be finite.');
  return Math.max(-90, Math.min(90, lat));
}

export function normalizeLongitude(lon: number): number {
  if (!Number.isFinite(lon)) throw new RangeError('Longitude must be finite.');
  const normalized = ((lon + 180) % 360 + 360) % 360 - 180;
  // Preserve +180 for positive inputs so display code does not unexpectedly flip signs.
  return normalized === -180 && lon > 0 ? 180 : normalized;
}

export function normalizeGeoCoordinates(coordinates: GeoCoordinates): GeoCoordinates {
  const altitudeKm = coordinates.altitudeKm ?? 0;
  if (!Number.isFinite(altitudeKm)) throw new RangeError('Altitude must be finite.');
  return {
    lat: clampLatitude(coordinates.lat),
    lon: normalizeLongitude(coordinates.lon),
    altitudeKm,
  };
}

/**
 * Engine-independent unit sphere conversion. Globe.gl scene-space conversion
 * should use GlobeEngine.geoToWorld() so it follows Globe.gl's exact axes.
 */
export function geoToUnitCartesian(input: GeoCoordinates): Cartesian3 {
  const { lat, lon, altitudeKm = 0 } = normalizeGeoCoordinates(input);
  const latitude = lat * DEG;
  const longitude = lon * DEG;
  const radius = 1 + altitudeKm / EARTH_RADIUS_KM;
  const cosLat = Math.cos(latitude);
  return {
    x: radius * cosLat * Math.cos(longitude),
    y: radius * Math.sin(latitude),
    z: radius * cosLat * Math.sin(longitude),
  };
}

export function unitCartesianToGeo({ x, y, z }: Cartesian3): GeoCoordinates {
  if (![x, y, z].every(Number.isFinite)) throw new RangeError('Cartesian coordinates must be finite.');
  const radius = Math.hypot(x, y, z);
  if (radius === 0) throw new RangeError('Cannot convert the origin into geographic coordinates.');
  return {
    lat: Math.asin(y / radius) * RAD,
    lon: normalizeLongitude(Math.atan2(z, x) * RAD),
    altitudeKm: (radius - 1) * EARTH_RADIUS_KM,
  };
}

export function greatCircleDistanceKm(a: GeoCoordinates, b: GeoCoordinates): number {
  const p1 = normalizeGeoCoordinates(a);
  const p2 = normalizeGeoCoordinates(b);
  const lat1 = p1.lat * DEG;
  const lat2 = p2.lat * DEG;
  const dLat = (p2.lat - p1.lat) * DEG;
  const dLon = (p2.lon - p1.lon) * DEG;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initialBearingDegrees(a: GeoCoordinates, b: GeoCoordinates): number {
  const p1 = normalizeGeoCoordinates(a);
  const p2 = normalizeGeoCoordinates(b);
  const lat1 = p1.lat * DEG;
  const lat2 = p2.lat * DEG;
  const dLon = (p2.lon - p1.lon) * DEG;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * RAD + 360) % 360;
}

export function altitudeKmToGlobeRadiusUnits(altitudeKm: number): number {
  if (!Number.isFinite(altitudeKm)) throw new RangeError('Altitude must be finite.');
  return altitudeKm / EARTH_RADIUS_KM;
}

export function globeRadiusUnitsToAltitudeKm(altitude: number): number {
  if (!Number.isFinite(altitude)) throw new RangeError('Altitude must be finite.');
  return altitude * EARTH_RADIUS_KM;
}
