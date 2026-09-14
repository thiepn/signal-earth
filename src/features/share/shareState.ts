import type { SimulationClockSnapshot, SimulationSpeed } from '../../core/time/temporal';
import type { EarthquakeTimeWindow } from '../seismic/types';
import type { NaturalEventCategory } from '../natural-events/types';
import type { OrbitScaleMode } from '../orbit/interaction';
import type { OrbitTrailMode } from '../orbit/playback';
import type { TimelineRange } from '../timeline/timeline';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { EntityId } from '../../shared/types/entities';
import { DEFAULT_WEATHER_SETTINGS, type WeatherLayerSettings } from '../weather/types';

export const SHARE_STATE_VERSION = 1;

export interface ShareViewState {
  pointOfView: { lat: number; lng: number; altitude: number };
  visualMode: VisualMode;
  layers: Record<LayerId, boolean>;
  weatherSettings: WeatherLayerSettings;
  timelineRange: TimelineRange;
  clock: SimulationClockSnapshot | null;
  selectedEntityId: EntityId | null;
  earthquakeWindow: EarthquakeTimeWindow;
  earthquakeMagnitude: number;
  orbitCategories: Record<SatelliteCategory, boolean>;
  naturalEventCategories: Record<NaturalEventCategory, boolean>;
  orbitScaleMode: OrbitScaleMode;
  orbitTrailMode: OrbitTrailMode;
  showOrbitPath: boolean;
  showGroundTrack: boolean;
  auroraHemispheres: { north: boolean; south: boolean };
}

export type ParsedShareView = Partial<ShareViewState>;

const LAYERS: LayerId[] = ['weather', 'earthquakes', 'events', 'orbit', 'aurora'];
const MODES: VisualMode[] = ['earth', 'signal', 'night', 'wireframe'];
const WINDOWS: EarthquakeTimeWindow[] = ['hour', 'day', 'week', 'month'];
const TIMELINE_RANGE_IDS: TimelineRange[] = ['day', 'week', 'month'];
const SAT_CATEGORIES: SatelliteCategory[] = ['stations', 'weather', 'earth-observation', 'navigation', 'science', 'communications'];
const NATURAL_CATEGORIES: NaturalEventCategory[] = ['severe-storm', 'wildfire', 'volcano'];
const TRAILS: OrbitTrailMode[] = ['off', 'past-10m', 'past-orbit', 'next-orbit'];
const SPEEDS: SimulationSpeed[] = [0, 1, 10, 100, 1000];

function finiteNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: string | null): boolean | null {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return null;
}

function enabledMap<T extends string>(values: string | null, allowed: readonly T[]): Record<T, boolean> | null {
  if (values === null) return null;
  const selected = new Set(values.split(',').map((value) => value.trim()).filter(Boolean));
  return Object.fromEntries(allowed.map((value) => [value, selected.has(value)])) as Record<T, boolean>;
}

function enabledList<T extends string>(map: Record<T, boolean>, allowed: readonly T[]): string {
  return allowed.filter((value) => map[value]).join(',');
}

function fixed(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString();
}

export function buildShareUrl(currentUrl: string | URL, state: ShareViewState): string {
  const url = new URL(currentUrl.toString());
  url.search = '';
  url.hash = '';
  const q = url.searchParams;
  q.set('v', String(SHARE_STATE_VERSION));
  q.set('lat', fixed(state.pointOfView.lat, 4));
  q.set('lng', fixed(state.pointOfView.lng, 4));
  q.set('alt', fixed(state.pointOfView.altitude, 3));
  q.set('mode', state.visualMode);
  q.set('layers', enabledList(state.layers, LAYERS));
  q.set('wx', `${state.weatherSettings.clouds ? 'c' : ''}${state.weatherSettings.precipitation ? 'p' : ''}${state.weatherSettings.stormTracks ? 's' : ''}` || 'none');
  q.set('wo', fixed(state.weatherSettings.opacity, 2));
  q.set('tr', state.timelineRange);

  if (!state.clock || state.clock.mode === 'live') {
    q.set('time', 'live');
  } else {
    q.set('time', new Date(state.clock.simulationTime).toISOString());
    q.set('speed', String(state.clock.isPlaying ? state.clock.speed : 0));
  }

  if (state.selectedEntityId) q.set('target', String(state.selectedEntityId));
  q.set('eqw', state.earthquakeWindow);
  q.set('mag', fixed(state.earthquakeMagnitude, 1));
  q.set('oc', enabledList(state.orbitCategories, SAT_CATEGORIES));
  q.set('nc', enabledList(state.naturalEventCategories, NATURAL_CATEGORIES));
  q.set('scale', state.orbitScaleMode);
  if (state.orbitTrailMode !== 'off') q.set('trail', state.orbitTrailMode);
  if (!state.showOrbitPath) q.set('op', '0');
  if (!state.showGroundTrack) q.set('gt', '0');
  q.set('ah', `${state.auroraHemispheres.north ? 'n' : ''}${state.auroraHemispheres.south ? 's' : ''}` || 'none');
  return url.toString();
}

export function parseShareView(input: string | URL | URLSearchParams): ParsedShareView | null {
  const q = input instanceof URLSearchParams
    ? input
    : input instanceof URL
      ? input.searchParams
      : new URL(input, 'https://signal-earth.invalid/').searchParams;

  if (q.get('v') !== String(SHARE_STATE_VERSION)) return null;
  const parsed: ParsedShareView = {};

  const lat = finiteNumber(q.get('lat'));
  const lng = finiteNumber(q.get('lng'));
  const altitude = finiteNumber(q.get('alt'));
  if (lat !== null && lng !== null && altitude !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && altitude > 0.01 && altitude < 50) {
    parsed.pointOfView = { lat, lng, altitude };
  }

  const mode = q.get('mode') as VisualMode | null;
  if (mode && MODES.includes(mode)) parsed.visualMode = mode;

  const layers = enabledMap(q.get('layers'), LAYERS);
  if (layers) parsed.layers = layers;

  const timelineRange = q.get('tr') as TimelineRange | null;
  if (timelineRange && TIMELINE_RANGE_IDS.includes(timelineRange)) parsed.timelineRange = timelineRange;

  const weatherFlags = q.get('wx');
  const weatherOpacity = finiteNumber(q.get('wo'));
  if (weatherFlags !== null || weatherOpacity !== null) {
    const flags = weatherFlags ?? 'cs';
    parsed.weatherSettings = {
      clouds: flags.includes('c'),
      precipitation: flags.includes('p'),
      stormTracks: flags.includes('s'),
      opacity: Math.max(0.25, Math.min(1, weatherOpacity ?? DEFAULT_WEATHER_SETTINGS.opacity)),
    };
  }

  const time = q.get('time');
  if (time === 'live') {
    const now = Date.now();
    parsed.clock = { mode: 'live', realTime: now, simulationTime: now, speed: 1, isPlaying: true };
  } else if (time) {
    const timestamp = Date.parse(time);
    if (Number.isFinite(timestamp)) {
      const speedValue = finiteNumber(q.get('speed'));
      const speed = SPEEDS.includes(speedValue as SimulationSpeed) ? speedValue as SimulationSpeed : 0;
      const now = Date.now();
      parsed.clock = {
        mode: timestamp < now ? 'replay' : 'simulation',
        realTime: now,
        simulationTime: timestamp,
        speed,
        isPlaying: speed !== 0,
      };
    }
  }

  const target = q.get('target');
  if (target && target.length <= 180) parsed.selectedEntityId = target as EntityId;

  const window = q.get('eqw') as EarthquakeTimeWindow | null;
  if (window && WINDOWS.includes(window)) parsed.earthquakeWindow = window;
  const magnitude = finiteNumber(q.get('mag'));
  if (magnitude !== null && magnitude >= 0 && magnitude <= 10) parsed.earthquakeMagnitude = magnitude;

  const orbitCategories = enabledMap(q.get('oc'), SAT_CATEGORIES);
  if (orbitCategories) parsed.orbitCategories = orbitCategories;
  const naturalCategories = enabledMap(q.get('nc'), NATURAL_CATEGORIES);
  if (naturalCategories) parsed.naturalEventCategories = naturalCategories;

  const scale = q.get('scale');
  if (scale === 'true' || scale === 'visual') parsed.orbitScaleMode = scale;
  const trail = q.get('trail') as OrbitTrailMode | null;
  if (trail && TRAILS.includes(trail)) parsed.orbitTrailMode = trail;
  const orbitPath = bool(q.get('op'));
  if (orbitPath !== null) parsed.showOrbitPath = orbitPath;
  const groundTrack = bool(q.get('gt'));
  if (groundTrack !== null) parsed.showGroundTrack = groundTrack;

  const ah = q.get('ah');
  if (ah !== null) parsed.auroraHemispheres = { north: ah.includes('n'), south: ah.includes('s') };

  return parsed;
}

export function hasShareView(url: string | URL = window.location.href): boolean {
  return parseShareView(url) !== null;
}
