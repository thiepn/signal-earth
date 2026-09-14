import type { LayerId } from '../../shared/types/layers';
import type { EntityId } from '../../shared/types/entities';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { EarthquakeRecord } from '../seismic/types';
import type { NaturalEventCategory, NaturalEventRecord } from '../natural-events/types';
import { NATURAL_EVENT_CATEGORY_LABELS } from '../natural-events/types';
import type { SatelliteRecord } from '../orbit/types';
import type { SpaceWeatherFeed } from '../space-weather/types';
import type { ObserverLocation, ObserverPassForecast } from '../above-me/types';
import { nearestCityContext } from './geography';

export type NowSignalKind = 'earthquake' | 'natural-event' | 'space-weather' | 'orbit' | 'local';
export type NowSignalTone = 'critical' | 'high' | 'medium' | 'info';
export type NowSignalAction = 'entity' | 'space-weather' | 'here';

export interface NowSignal {
  id: string;
  rank: number;
  kind: NowSignalKind;
  tone: NowSignalTone;
  score: number;
  eyebrow: string;
  title: string;
  summary: string;
  metric: string;
  source: string;
  timestamp: number | null;
  action: NowSignalAction;
  entityId?: EntityId;
  layer?: LayerId;
  coordinates?: { lat: number; lon: number };
  naturalEventCategory?: NaturalEventCategory;
  satelliteCategory?: SatelliteCategory;
}

export interface BuildNowSignalsInput {
  earthquakes: EarthquakeRecord[];
  naturalEvents: NaturalEventRecord[];
  spaceWeather: SpaceWeatherFeed | null;
  satellites: SatelliteRecord[];
  observerLocation: ObserverLocation | null;
  passForecast: ObserverPassForecast | null;
  now: number;
  limit?: number;
}

const HOUR = 3_600_000;

function ageHours(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / HOUR);
}

function recencyBonus(timestamp: number, now: number, maxBonus: number, horizonHours: number): number {
  const age = ageHours(timestamp, now);
  if (age >= horizonHours) return 0;
  return maxBonus * (1 - age / horizonHours);
}

function timePhrase(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function earthquakeTone(magnitude: number): NowSignalTone {
  if (magnitude >= 7) return 'critical';
  if (magnitude >= 6) return 'high';
  if (magnitude >= 5) return 'medium';
  return 'info';
}

function eventTone(category: NaturalEventCategory): NowSignalTone {
  if (category === 'severe-storm') return 'high';
  return 'medium';
}

function currentEventFrame(event: NaturalEventRecord, now: number) {
  const eligible = event.geometry.filter((frame) => frame.timestamp <= now);
  return eligible[eligible.length - 1] ?? event.geometry[0] ?? null;
}

function rankEarthquakes(input: BuildNowSignalsInput): NowSignal[] {
  const candidates = input.earthquakes
    .filter((quake) => quake.time <= input.now + 5 * 60_000 && ageHours(quake.time, input.now) <= 48)
    .map((quake) => {
      const alertWeight = quake.alert === 'red' ? 16 : quake.alert === 'orange' ? 10 : quake.alert === 'yellow' ? 5 : 0;
      const score = quake.magnitude * 12 + Math.min(12, quake.significance / 85) + recencyBonus(quake.time, input.now, 16, 36) + alertWeight + (quake.tsunami ? 8 : 0);
      const nearby = nearestCityContext(quake.coordinates.lat, quake.coordinates.lon, 750);
      const context = nearby ? ` · ${nearby.label}` : '';
      return {
        id: `now:${quake.id}`,
        rank: 0,
        kind: 'earthquake' as const,
        tone: earthquakeTone(quake.magnitude),
        score,
        eyebrow: `EARTHQUAKE · ${timePhrase(quake.time, input.now)}`,
        title: `M${quake.magnitude.toFixed(1)} · ${quake.place}`,
        summary: `${quake.coordinates.depthKm.toFixed(0)} km deep${quake.felt ? ` · ${quake.felt.toLocaleString()} felt reports` : ''}${context}`,
        metric: `M${quake.magnitude.toFixed(1)}`,
        source: 'USGS',
        timestamp: quake.time,
        action: 'entity' as const,
        entityId: quake.id,
        layer: 'earthquakes' as const,
        coordinates: { lat: quake.coordinates.lat, lon: quake.coordinates.lon },
      };
    })
    .sort((a, b) => b.score - a.score);
  return candidates.slice(0, 2);
}

function rankNaturalEvents(input: BuildNowSignalsInput): NowSignal[] {
  const bases: Record<NaturalEventCategory, number> = { 'severe-storm': 61, volcano: 54, wildfire: 48 };
  const byCategory = new Map<NaturalEventCategory, NowSignal>();
  for (const event of input.naturalEvents) {
    if (event.startTime > input.now || (event.closedAt !== null && event.closedAt < input.now)) continue;
    const frame = currentEventFrame(event, input.now);
    if (!frame) continue;
    const score = bases[event.category] + Math.min(8, event.geometry.length * 0.35) + recencyBonus(event.updatedAt, input.now, 10, 72) + (frame.magnitudeValue ?? 0) * 0.25;
    const nearby = nearestCityContext(frame.point.lat, frame.point.lon, 900);
    const magnitude = frame.magnitudeValue === null ? '' : ` · ${frame.magnitudeValue}${frame.magnitudeUnit ? ` ${frame.magnitudeUnit}` : ''}`;
    const signal: NowSignal = {
      id: `now:${event.id}`,
      rank: 0,
      kind: 'natural-event',
      tone: eventTone(event.category),
      score,
      eyebrow: `${NATURAL_EVENT_CATEGORY_LABELS[event.category].toUpperCase()} · ACTIVE`,
      title: event.title,
      summary: `${event.geometry.length} observations${magnitude}${nearby ? ` · ${nearby.label}` : ''}`,
      metric: event.category === 'severe-storm' ? 'STORM' : event.category === 'volcano' ? 'VOLCANO' : 'FIRE',
      source: 'NASA EONET',
      timestamp: event.updatedAt,
      action: 'entity',
      entityId: event.id,
      layer: 'events',
      coordinates: { ...frame.point },
      naturalEventCategory: event.category,
    };
    const current = byCategory.get(event.category);
    if (!current || signal.score > current.score) byCategory.set(event.category, signal);
  }
  return [...byCategory.values()];
}

function rankSpaceWeather(input: BuildNowSignalsInput): NowSignal[] {
  const feed = input.spaceWeather;
  if (!feed) return [];
  const usableKp = feed.kp
    .filter((sample) => sample.timestamp <= input.now + 3 * HOUR && sample.kind !== 'predicted')
    .sort((a, b) => Math.abs(input.now - a.timestamp) - Math.abs(input.now - b.timestamp))[0]
    ?? feed.kp.slice().sort((a, b) => Math.abs(input.now - a.timestamp) - Math.abs(input.now - b.timestamp))[0]
    ?? null;
  const scales = feed.scales;
  const g = scales?.G.scale ?? 0;
  const r = scales?.R.scale ?? 0;
  const s = scales?.S.scale ?? 0;
  const maxScale = Math.max(g, r, s);
  const kp = usableKp?.kp ?? 0;
  const elevated = maxScale > 0 || kp >= 4;
  const title = g > 0 ? `G${g} geomagnetic storm conditions` : elevated ? 'Elevated geomagnetic activity' : 'Space weather is quiet';
  const score = (elevated ? 49 : 18) + maxScale * 12 + kp * 3;
  return [{
    id: 'now:space-weather',
    rank: 0,
    kind: 'space-weather',
    tone: maxScale >= 3 || kp >= 7 ? 'high' : elevated ? 'medium' : 'info',
    score,
    eyebrow: 'SPACE WEATHER · NOAA',
    title,
    summary: `Kp ${kp.toFixed(1)} · G${g} R${r} S${s}${feed.partial ? ' · partial feed' : ''}`,
    metric: `Kp ${kp.toFixed(1)}`,
    source: 'NOAA SWPC',
    timestamp: usableKp?.timestamp ?? feed.sourceUpdatedAt,
    action: 'space-weather',
    layer: 'aurora',
  }];
}

function rankOrbit(input: BuildNowSignalsInput): NowSignal[] {
  const iss = input.satellites.find((satellite) => satellite.noradId === '25544')
    ?? input.satellites.find((satellite) => /ISS|INTERNATIONAL SPACE STATION/i.test(satellite.name));
  if (!iss) return [];
  const category = iss.categories.find((candidate) => candidate === 'stations') ?? iss.category;
  return [{
    id: `now:${iss.id}`,
    rank: 0,
    kind: 'orbit',
    tone: 'info',
    score: 39,
    eyebrow: 'ORBIT · LIVE PROPAGATION',
    title: 'International Space Station',
    summary: `Track ${iss.name} in real time and jump directly into its propagated orbit.`,
    metric: 'ISS',
    source: 'CelesTrak',
    timestamp: iss.epoch,
    action: 'entity',
    entityId: iss.id,
    layer: 'orbit',
    satelliteCategory: category,
  }];
}

function rankLocal(input: BuildNowSignalsInput): NowSignal[] {
  if (!input.observerLocation || !input.passForecast?.passes.length) return [];
  const pass = input.passForecast.passes.find((candidate) => candidate.endTime >= input.now);
  if (!pass) return [];
  const hoursUntil = (pass.startTime - input.now) / HOUR;
  if (hoursUntil > 24) return [];
  const nearby = nearestCityContext(input.observerLocation.lat, input.observerLocation.lon, 250);
  const when = hoursUntil <= 0 ? 'in progress' : hoursUntil < 1 ? `in ${Math.max(1, Math.round(hoursUntil * 60))} min` : `in ${hoursUntil.toFixed(1)}h`;
  return [{
    id: 'now:local-iss-pass',
    rank: 0,
    kind: 'local',
    tone: pass.maxElevationDeg >= 60 ? 'high' : pass.maxElevationDeg >= 35 ? 'medium' : 'info',
    score: 45 + Math.min(18, pass.maxElevationDeg / 5) + Math.max(0, 8 - Math.max(0, hoursUntil)),
    eyebrow: 'ABOVE ME · NEXT ISS PASS',
    title: `ISS pass ${when}`,
    summary: `Peak elevation ${pass.maxElevationDeg.toFixed(0)}°${nearby ? ` · observer near ${nearby.city}` : ''}`,
    metric: `${pass.maxElevationDeg.toFixed(0)}°`,
    source: 'Local + CelesTrak',
    timestamp: pass.startTime,
    action: 'here',
  }];
}

export function buildNowSignals(input: BuildNowSignalsInput): NowSignal[] {
  const limit = Math.max(1, Math.min(12, input.limit ?? 8));
  const ranked = [
    ...rankEarthquakes(input),
    ...rankNaturalEvents(input),
    ...rankSpaceWeather(input),
    ...rankLocal(input),
    ...rankOrbit(input),
  ].sort((a, b) => b.score - a.score || (b.timestamp ?? 0) - (a.timestamp ?? 0));

  return ranked.slice(0, limit).map((signal, index) => ({ ...signal, rank: index + 1 }));
}
