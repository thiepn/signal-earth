import { describe, expect, it } from 'vitest';
import { buildShareUrl, parseShareView, type ShareViewState } from '../features/share/shareState';
import { asEntityId } from '../shared/types/entities';

const state: ShareViewState = {
  pointOfView: { lat: 35.6762, lng: 139.6503, altitude: 1.2 },
  visualMode: 'night',
  layers: { earthquakes: true, events: false, orbit: true, aurora: true },
  clock: { mode: 'simulation', realTime: 1_000, simulationTime: 2_000, speed: 100, isPlaying: true },
  selectedEntityId: asEntityId('satellite:25544'),
  earthquakeWindow: 'day',
  earthquakeMagnitude: 4,
  orbitCategories: { stations: true, weather: true, 'earth-observation': false, navigation: false, science: false, communications: false },
  naturalEventCategories: { 'severe-storm': true, wildfire: false, volcano: true },
  orbitScaleMode: 'visual',
  orbitTrailMode: 'past-10m',
  showOrbitPath: true,
  showGroundTrack: false,
  auroraHemispheres: { north: true, south: false },
};

describe('share state', () => {
  it('round-trips the public view without observer/private settings', () => {
    const url = buildShareUrl('https://example.test/signal-earth/', state);
    const parsed = parseShareView(url)!;
    expect(parsed.pointOfView).toEqual({ lat: 35.6762, lng: 139.6503, altitude: 1.2 });
    expect(parsed.visualMode).toBe('night');
    expect(parsed.layers?.orbit).toBe(true);
    expect(parsed.layers?.events).toBe(false);
    expect(parsed.selectedEntityId).toBe('satellite:25544');
    expect(parsed.orbitScaleMode).toBe('visual');
    expect(parsed.orbitTrailMode).toBe('past-10m');
    expect(parsed.showGroundTrack).toBe(false);
    expect(parsed.auroraHemispheres).toEqual({ north: true, south: false });
  });

  it('rejects unversioned URLs', () => {
    expect(parseShareView('https://example.test/?mode=night')).toBeNull();
  });
});
