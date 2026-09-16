import { describe, expect, it } from 'vitest';
import { loadSavedObserverLocation, MAX_OBSERVER_ALTITUDE_KM, MIN_OBSERVER_ALTITUDE_KM, saveObserverLocation } from '../features/above-me/geolocation';
import type { ObserverLocation } from '../features/above-me/types';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('observer location persistence', () => {
  it('clamps corrupted saved altitude and repairs invalid acquisition time', () => {
    const storage = new MemoryStorage();
    storage.setItem('signal-earth:observer-location:v1', JSON.stringify({ lat: 50, lon: 7, altitudeKm: 1e9, acquiredAt: -10 }));
    const location = loadSavedObserverLocation(storage as unknown as Storage);
    expect(location?.altitudeKm).toBe(MAX_OBSERVER_ALTITUDE_KM);
    expect(location?.acquiredAt).toBeGreaterThan(0);
  });

  it('normalizes altitude before persisting remembered observer state', () => {
    const storage = new MemoryStorage();
    const location: ObserverLocation = { lat: 50, lon: 7, altitudeKm: -99, accuracyM: 12, acquiredAt: 1, source: 'browser' };
    saveObserverLocation(location, storage as unknown as Storage);
    const saved = loadSavedObserverLocation(storage as unknown as Storage);
    expect(saved?.altitudeKm).toBe(MIN_OBSERVER_ALTITUDE_KM);
  });
});
