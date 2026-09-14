import type { ObserverLocation } from './types';

const STORAGE_KEY = 'signal-earth:observer-location:v1';

function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
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
          altitudeKm: Number.isFinite(altitude) ? Math.max(-0.5, (altitude ?? 0) / 1_000) : 0,
          accuracyM: Number.isFinite(accuracy) ? accuracy : null,
          acquiredAt: position.timestamp || Date.now(),
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

export function saveObserverLocation(location: ObserverLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: location.lat, lon: location.lon, altitudeKm: location.altitudeKm, acquiredAt: Date.now() }));
  } catch { /* localStorage may be blocked */ }
}

export function clearSavedObserverLocation(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignored */ }
}

export function loadSavedObserverLocation(): ObserverLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const lat = Number(parsed.lat); const lon = Number(parsed.lon); const altitudeKm = Number(parsed.altitudeKm ?? 0);
    if (!validCoordinate(lat, lon) || !Number.isFinite(altitudeKm)) return null;
    return { lat, lon, altitudeKm, accuracyM: null, acquiredAt: Number(parsed.acquiredAt) || Date.now(), source: 'saved' };
  } catch { return null; }
}
