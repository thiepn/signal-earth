import { describe, expect, it } from 'vitest';
import { asEntityId } from '../shared/types/entities';
import { buildShareUrl, type ShareViewState } from '../features/share/shareState';
import {
  createSavedWorld,
  loadSavedWorlds,
  MAX_SAVED_WORLDS,
  normalizeSavedWorldName,
  persistSavedWorlds,
  removeSavedWorld,
  SAVED_WORLDS_STORAGE_KEY,
  summarizeSavedWorldUrl,
  upsertSavedWorld,
  type StorageLike,
} from '../features/saved-worlds/storage';

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

function state(overrides: Partial<ShareViewState> = {}): ShareViewState {
  const now = Date.now();
  return {
    pointOfView: { lat: 50.94, lng: 6.96, altitude: 1.2 },
    visualMode: 'night',
    layers: { weather: true, earthquakes: true, events: false, orbit: true, aurora: true },
    weatherSettings: { clouds: true, precipitation: false, stormTracks: true, opacity: 0.72 },
    timelineRange: 'week',
    clock: { mode: 'live', realTime: now, simulationTime: now, speed: 1, isPlaying: true },
    selectedEntityId: asEntityId('satellite:25544'),
    earthquakeWindow: 'week',
    earthquakeMagnitude: 4.5,
    orbitCategories: { stations: true, weather: true, 'earth-observation': false, navigation: false, science: false, communications: false },
    naturalEventCategories: { 'severe-storm': true, wildfire: false, volcano: true },
    orbitScaleMode: 'true',
    orbitTrailMode: 'past-orbit',
    showOrbitPath: true,
    showGroundTrack: true,
    auroraHemispheres: { north: true, south: false },
    ...overrides,
  };
}

function viewUrl(overrides: Partial<ShareViewState> = {}): string {
  return buildShareUrl('https://thiepn.dev/signal-earth/', state(overrides));
}

describe('Phase 24 Saved Worlds', () => {
  it('summarizes the canonical share-state URL instead of duplicating serialization', () => {
    const summary = summarizeSavedWorldUrl(viewUrl());
    expect(summary).toEqual({
      visualMode: 'night',
      timelineRange: 'week',
      enabledLayers: ['weather', 'earthquakes', 'orbit', 'aurora'],
      target: 'satellite:25544',
      timeMode: 'live',
    });
  });

  it('normalizes user labels and caps them at 48 characters', () => {
    expect(normalizeSavedWorldName('  Europe   weather  ')).toBe('Europe weather');
    expect(normalizeSavedWorldName('   ')).toBe('Saved World');
    expect(normalizeSavedWorldName('x'.repeat(80))).toHaveLength(48);
  });

  it('creates and persists a valid named world locally', () => {
    const storage = new MemoryStorage();
    const world = createSavedWorld('ISS night', viewUrl(), 1_000, 'world-1');
    expect(world?.name).toBe('ISS night');
    expect(world?.summary.target).toBe('satellite:25544');
    expect(world).not.toBeNull();
    const saved = persistSavedWorlds([world!], storage);
    expect(saved).toHaveLength(1);
    expect(loadSavedWorlds(storage)[0]?.id).toBe('world-1');
  });

  it('drops malformed and non-share-state localStorage records', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVED_WORLDS_STORAGE_KEY, JSON.stringify([
      { id: 'bad', name: 'Bad', url: 'https://example.com/not-a-world', createdAt: 1, updatedAt: 1 },
      { nope: true },
    ]));
    expect(loadSavedWorlds(storage)).toEqual([]);
  });

  it('updates an existing world while preserving its original creation time', () => {
    const storage = new MemoryStorage();
    const first = createSavedWorld('Home', viewUrl(), 1_000, 'same')!;
    upsertSavedWorld(first, storage);
    const changed = createSavedWorld('Home', viewUrl({ visualMode: 'signal' }), 5_000, 'same')!;
    const result = upsertSavedWorld(changed, storage);
    expect(result).toHaveLength(1);
    expect(result[0]?.createdAt).toBe(1_000);
    expect(result[0]?.updatedAt).toBe(5_000);
    expect(result[0]?.summary.visualMode).toBe('signal');
  });

  it('keeps only the newest 24 saved worlds', () => {
    const storage = new MemoryStorage();
    const worlds = Array.from({ length: MAX_SAVED_WORLDS + 5 }, (_, index) => createSavedWorld(`World ${index}`, viewUrl(), index + 1, `id-${index}`)!);
    const result = persistSavedWorlds(worlds, storage);
    expect(result).toHaveLength(MAX_SAVED_WORLDS);
    expect(result[0]?.id).toBe(`id-${MAX_SAVED_WORLDS + 4}`);
    expect(result.at(-1)?.id).toBe('id-5');
  });

  it('removes a saved world without disturbing the others', () => {
    const storage = new MemoryStorage();
    const a = createSavedWorld('A', viewUrl(), 1, 'a')!;
    const b = createSavedWorld('B', viewUrl(), 2, 'b')!;
    persistSavedWorlds([a, b], storage);
    const result = removeSavedWorld('b', storage);
    expect(result.map((world) => world.id)).toEqual(['a']);
  });

  it('retains replay/simulation semantics from the canonical share state', () => {
    const now = Date.now();
    const summary = summarizeSavedWorldUrl(viewUrl({
      timelineRange: 'month',
      clock: { mode: 'replay', realTime: now, simulationTime: now - 7 * 86_400_000, speed: 0, isPlaying: false },
      selectedEntityId: null,
    }));
    expect(summary?.timelineRange).toBe('month');
    expect(summary?.timeMode).toBe('replay');
    expect(summary?.target).toBeNull();
  });
});
