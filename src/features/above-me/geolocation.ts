import type { ObserverLocation } from './types';

const STORAGE_KEY = 'signal-earth:observer-location:v1';
export const MIN_OBSERVER_ALTITUDE_KM = -0.5;
export const MAX_OBSERVER_ALTITUDE_KM = 20;

type ObserverStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(): ObserverStorage | null {
  try { return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage; }
  catch { return null; }
}

function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function normalizeObserverAltitudeKm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_OBSERVER_ALTITUDE_KM, Math.min(MAX_OBSERVER_ALTITUDE_KM, value));
}

export function requestBrowserLocation(): Promise<ObserverLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Browser geolocation is unavailable.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude, accuracy } = position.coords;
        if (!validCoordinate(latitude, longitude)) {
reject(new Error('Browser returned invalid coordinates.'));
return;
        }
        resolve({
lat: latitude,
lon: longitude,
altitudeKm: normalizeObserverAltitudeKm(Number.isFinite(altitude) ? (altitude ?? 0) / 1_000 : 0),
accuracyM: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
acquiredAt: Number.isFinite(position.timestamp) && position.timestamp > 0 ? position.timestamp : Date.now(),
source: 'browser',
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new DOMException('Location permission was denied.', 'NotAllowedError'));
        else if (error.code === error.POSITION_UNAVAILABLE) reject(new Error('Your current location could not be determined.'));
        else if (error.code === error.TIMEOUT) reject(new Error('Location request timed out.'));
        else reject(new Error(error.message || 'Location request failed.'));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  });
}

export function saveObserverLocation(location: ObserverLocation, storage: ObserverStorage | null = safeStorage()): void {
  if (!storage || !validCoordinate(location.lat, location.lon)) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      lat: location.lat,
      lon: location.lon,
      altitudeKm: normalizeObserverAltitudeKm(location.altitudeKm),
      acquiredAt: Date.now(),
    }));
  } catch { /* localStorage may be blocked */ }
}

export function clearSavedObserverLocation(storage: ObserverStorage | null = safeStorage()): void {
  if (!storage) return;
  try { storage.removeItem(STORAGE_KEY); } catch { /* ignored */ }
}

export function loadSavedObserverLocation(storage: ObserverStorage | null = safeStorage()): ObserverLocation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const lat = Number(parsed.lat);
    const lon = Number(parsed.lon);
    if (!validCoordinate(lat, lon)) return null;
    const acquired = Number(parsed.acquiredAt);
    return {
      lat,
      lon,
      altitudeKm: normalizeObserverAltitudeKm(Number(parsed.altitudeKm ?? 0)),
      accuracyM: null,
      acquiredAt: Number.isFinite(acquired) && acquired > 0 ? acquired : Date.now(),
      source: 'saved',
    };
  } catch { return null; }
}
