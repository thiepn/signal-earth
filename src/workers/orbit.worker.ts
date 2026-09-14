/// <reference lib="webworker" />

import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
  degreesToRadians,
  radiansToDegrees,
  gstime,
  json2satrec,
  propagate,
  jday,
  sunPos,
  shadowFraction as eclipseFraction,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js';
import type { OrbitTrackKind } from '../features/orbit/interaction';
import type { OMMRecord, SatelliteCategory } from '../shared/types/orbit';

export interface OrbitWorkerSatellite {
  id: string;
  category: SatelliteCategory;
  categories: SatelliteCategory[];
  omm: OMMRecord;
}

export type OrbitWorkerRequest =
  | { type: 'LOAD_CATALOG'; satellites: OrbitWorkerSatellite[] }
  | { type: 'SET_ACTIVE_CATEGORIES'; categories: SatelliteCategory[] }
  | { type: 'PROPAGATE'; timestamp: number; sequence: number }
  | { type: 'PROPAGATE_WINDOW'; startTimestamp: number; endTimestamp: number; sampleCount: number; sequence: number }
  | { type: 'GENERATE_TRACK'; satelliteId: string; timestamp: number; sequence: number; kind?: OrbitTrackKind; samples?: number }
  | { type: 'OBSERVER_SKY'; timestamp: number; sequence: number; observer: { lat: number; lon: number; altitudeKm: number }; minElevationDeg?: number; maxResults?: number }
  | { type: 'PREDICT_PASSES'; satelliteId: string; startTimestamp: number; sequence: number; observer: { lat: number; lon: number; altitudeKm: number }; horizonHours?: number; minElevationDeg?: number }
  | { type: 'CLEAR' };

export type OrbitWorkerResponse =
  | { type: 'READY' }
  | { type: 'CATALOG_READY'; loaded: number; rejected: number }
  | { type: 'FRAME'; sequence: number; timestamp: number; indices: Uint32Array; positions: Float32Array; validCount: number; errorCount: number }
  | { type: 'WINDOW'; sequence: number; startTimestamp: number; endTimestamp: number; sampleCount: number; objectCount: number; indices: Uint32Array; positions: Float32Array; validCount: number; errorCount: number }
  | { type: 'TRACK'; sequence: number; satelliteId: string; kind: OrbitTrackKind; centerTimestamp: number; startTimestamp: number; endTimestamp: number; periodMinutes: number; sampleCount: number; positions: Float32Array }
  | { type: 'OBSERVER_SKY'; sequence: number; timestamp: number; visibleCount: number; indices: Uint32Array; lookAngles: Float32Array }
  | { type: 'PASSES'; sequence: number; satelliteId: string; startTime: number; horizonHours: number; passes: Array<{ startTime: number; endTime: number; maxTime: number; maxElevationDeg: number; riseAzimuthDeg: number; maxAzimuthDeg: number; setAzimuthDeg: number; maxShadowFraction: number }> }
  | { type: 'ERROR'; message: string; sequence?: number };

interface WorkerRecord {
  id: string;
  sourceIndex: number;
  category: SatelliteCategory;
  categories: SatelliteCategory[];
  meanMotion: number;
  satrec: SatRec;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let catalog: WorkerRecord[] = [];
let activeCategories = new Set<SatelliteCategory>(['stations', 'weather', 'earth-observation', 'navigation', 'science']);

function post(response: OrbitWorkerResponse, transfer: Transferable[] = []): void {
  workerScope.postMessage(response, transfer);
}

function loadCatalog(satellites: OrbitWorkerSatellite[]): void {
  const next: WorkerRecord[] = [];
  let rejected = 0;

  for (let index = 0; index < satellites.length; index += 1) {
    const satellite = satellites[index]!;
    try {
      const satrec = json2satrec(satellite.omm as unknown as OMMJsonObject);
      if (satrec.error || !Number.isFinite(satellite.omm.MEAN_MOTION) || satellite.omm.MEAN_MOTION <= 0) {
        rejected += 1;
        continue;
      }
      next.push({
        id: satellite.id,
        sourceIndex: index,
        category: satellite.category,
        categories: satellite.categories,
        meanMotion: satellite.omm.MEAN_MOTION,
        satrec,
      });
    } catch {
      rejected += 1;
    }
  }

  catalog = next;
  post({ type: 'CATALOG_READY', loaded: catalog.length, rejected });
}

function activeCatalog(): WorkerRecord[] {
  return catalog.filter((record) => record.categories.some((category) => activeCategories.has(category)));
}

function propagateOne(record: WorkerRecord, timestamp: number): [number, number, number, number] | null {
  const date = new Date(timestamp);
  const result = propagate(record.satrec, date);
  if (!result?.position || !result.velocity) return null;
  const geodetic = eciToGeodetic(result.position, gstime(date));
  const latitude = degreesLat(geodetic.latitude);
  const longitude = degreesLong(geodetic.longitude);
  const altitudeKm = geodetic.height;
  const speedKmS = Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z);
  if (![latitude, longitude, altitudeKm, speedKmS].every(Number.isFinite) || altitudeKm < -100) return null;
  return [latitude, longitude, altitudeKm, speedKmS];
}

function propagateCatalog(timestamp: number, sequence: number): void {
  if (!Number.isFinite(timestamp)) {
    post({ type: 'ERROR', sequence, message: 'Orbit worker received an invalid simulation timestamp.' });
    return;
  }

  const active = activeCatalog();
  const indices = new Uint32Array(active.length);
  const positions = new Float32Array(active.length * 4);
  positions.fill(Number.NaN);

  let validCount = 0;
  let errorCount = 0;
  for (let slot = 0; slot < active.length; slot += 1) {
    const record = active[slot]!;
    indices[slot] = record.sourceIndex;
    try {
      const state = propagateOne(record, timestamp);
      if (!state) {
        errorCount += 1;
        continue;
      }
      positions.set(state, slot * 4);
      validCount += 1;
    } catch {
      errorCount += 1;
    }
  }

  post({ type: 'FRAME', sequence, timestamp, indices, positions, validCount, errorCount }, [indices.buffer, positions.buffer]);
}

function propagateWindow(startTimestamp: number, endTimestamp: number, requestedSamples: number, sequence: number): void {
  if (![startTimestamp, endTimestamp, requestedSamples].every(Number.isFinite) || endTimestamp < startTimestamp) {
    post({ type: 'ERROR', sequence, message: 'Orbit worker received an invalid prediction window.' });
    return;
  }

  const active = activeCatalog();
  const sampleCount = Math.max(2, Math.min(12, Math.round(requestedSamples)));
  const objectCount = active.length;
  const indices = new Uint32Array(objectCount);
  const positions = new Float32Array(sampleCount * objectCount * 4);
  positions.fill(Number.NaN);
  for (let slot = 0; slot < objectCount; slot += 1) indices[slot] = active[slot]!.sourceIndex;

  let validCount = 0;
  let errorCount = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const fraction = sampleCount === 1 ? 0 : sample / (sampleCount - 1);
    const timestamp = startTimestamp + (endTimestamp - startTimestamp) * fraction;
    for (let slot = 0; slot < objectCount; slot += 1) {
      const record = active[slot]!;
      const offset = (sample * objectCount + slot) * 4;
      try {
        const state = propagateOne(record, timestamp);
        if (!state) {
          if (sample === 0) errorCount += 1;
          continue;
        }
        positions.set(state, offset);
        if (sample === 0) validCount += 1;
      } catch {
        if (sample === 0) errorCount += 1;
      }
    }
  }

  post({
    type: 'WINDOW', sequence, startTimestamp, endTimestamp, sampleCount, objectCount,
    indices, positions, validCount, errorCount,
  }, [indices.buffer, positions.buffer]);
}

function resolveTrackWindow(record: WorkerRecord, timestamp: number, kind: OrbitTrackKind): { start: number; end: number; periodMinutes: number } | null {
  const periodMinutes = 1_440 / record.meanMotion;
  if (!Number.isFinite(periodMinutes) || periodMinutes <= 0 || periodMinutes > 2_000) return null;
  const periodMs = periodMinutes * 60_000;
  switch (kind) {
    case 'past-10m': return { start: timestamp - 10 * 60_000, end: timestamp, periodMinutes };
    case 'past-orbit': return { start: timestamp - periodMs, end: timestamp, periodMinutes };
    case 'next-orbit': return { start: timestamp, end: timestamp + periodMs, periodMinutes };
    case 'orbit': return { start: timestamp - periodMs / 2, end: timestamp + periodMs / 2, periodMinutes };
    case 'off': return { start: timestamp, end: timestamp, periodMinutes };
  }
}

function generateTrack(satelliteId: string, timestamp: number, sequence: number, kind: OrbitTrackKind = 'orbit', requestedSamples = 181): void {
  if (!Number.isFinite(timestamp)) {
    post({ type: 'ERROR', sequence, message: 'Orbit track request contained an invalid timestamp.' });
    return;
  }
  const record = catalog.find((item) => item.id === satelliteId);
  if (!record) {
    post({ type: 'ERROR', sequence, message: `Orbit track target is not loaded: ${satelliteId}` });
    return;
  }
  const window = resolveTrackWindow(record, timestamp, kind);
  if (!window) {
    post({ type: 'ERROR', sequence, message: `Orbit period is invalid for ${satelliteId}.` });
    return;
  }

  const sampleCount = kind === 'off' ? 0 : Math.max(33, Math.min(361, Math.round(requestedSamples)));
  const positions = new Float32Array(sampleCount * 3);
  positions.fill(Number.NaN);

  for (let index = 0; index < sampleCount; index += 1) {
    const fraction = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const sampleTime = window.start + (window.end - window.start) * fraction;
    try {
      const state = propagateOne(record, sampleTime);
      if (!state) continue;
      const offset = index * 3;
      positions[offset] = state[0];
      positions[offset + 1] = state[1];
      positions[offset + 2] = state[2];
    } catch {
      // Keep this sample NaN. One bad point should not discard the full path.
    }
  }

  post({
    type: 'TRACK', sequence, satelliteId, kind, centerTimestamp: timestamp,
    startTimestamp: window.start, endTimestamp: window.end,
    periodMinutes: window.periodMinutes, sampleCount, positions,
  }, [positions.buffer]);
}

function observerGeodetic(observer: { lat: number; lon: number; altitudeKm: number }) {
  return {
    latitude: degreesToRadians(observer.lat),
    longitude: degreesToRadians(observer.lon),
    height: Math.max(-0.5, observer.altitudeKm),
  };
}

interface ObserverLook {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  altitudeKm: number;
  speedKmS: number;
  shadowFraction: number;
}

function lookAnglesFor(record: WorkerRecord, timestamp: number, observer: { lat: number; lon: number; altitudeKm: number }): ObserverLook | null {
  const date = new Date(timestamp);
  const result = propagate(record.satrec, date);
  if (!result?.position || !result.velocity) return null;
  const gmst = gstime(date);
  const positionEcf = eciToEcf(result.position, gmst);
  const look = ecfToLookAngles(observerGeodetic(observer), positionEcf);
  const geodetic = eciToGeodetic(result.position, gmst);
  const azimuthDeg = ((radiansToDegrees(look.azimuth) % 360) + 360) % 360;
  const elevationDeg = radiansToDegrees(look.elevation);
  const rangeKm = look.rangeSat;
  const altitudeKm = geodetic.height;
  const speedKmS = Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z);
  const sun = sunPos(jday(date));
  const shadowFraction = eclipseFraction(sun.rsun, result.position);
  if (![azimuthDeg, elevationDeg, rangeKm, altitudeKm, speedKmS, shadowFraction].every(Number.isFinite)) return null;
  return { azimuthDeg, elevationDeg, rangeKm, altitudeKm, speedKmS, shadowFraction };
}

function observerSky(timestamp: number, sequence: number, observer: { lat: number; lon: number; altitudeKm: number }, minElevationDeg = 0, maxResults = 64): void {
  if (![timestamp, observer.lat, observer.lon, observer.altitudeKm].every(Number.isFinite)) {
    post({ type: 'ERROR', sequence, message: 'Observer sky request contained invalid coordinates or time.' });
    return;
  }
  const visible: Array<{ record: WorkerRecord; look: ObserverLook }> = [];
  for (const record of activeCatalog()) {
    try {
      const look = lookAnglesFor(record, timestamp, observer);
      if (look && look.elevationDeg >= minElevationDeg) visible.push({ record, look });
    } catch { /* one bad record should not poison the sky snapshot */ }
  }
  visible.sort((a, b) => b.look.elevationDeg - a.look.elevationDeg);
  const selected = visible.slice(0, Math.max(1, Math.min(128, Math.round(maxResults))));
  const indices = new Uint32Array(selected.length);
  const lookAngles = new Float32Array(selected.length * 5);
  selected.forEach(({ record, look }, slot) => {
    indices[slot] = record.sourceIndex;
    lookAngles.set([look.azimuthDeg, look.elevationDeg, look.rangeKm, look.altitudeKm, look.speedKmS], slot * 5);
  });
  post({ type: 'OBSERVER_SKY', sequence, timestamp, visibleCount: visible.length, indices, lookAngles }, [indices.buffer, lookAngles.buffer]);
}

function refineElevationCrossing(record: WorkerRecord, observer: { lat: number; lon: number; altitudeKm: number }, a: number, b: number, minElevationDeg: number): { time: number; azimuthDeg: number } {
  let low = a; let high = b;
  let lowLook = lookAnglesFor(record, low, observer);
  let lowValue = (lowLook?.elevationDeg ?? -90) - minElevationDeg;
  for (let i = 0; i < 9; i += 1) {
    const mid = (low + high) / 2;
    const look = lookAnglesFor(record, mid, observer);
    const value = (look?.elevationDeg ?? -90) - minElevationDeg;
    if ((lowValue <= 0 && value <= 0) || (lowValue >= 0 && value >= 0)) {
      low = mid; lowLook = look; lowValue = value;
    } else high = mid;
  }
  const time = Math.round((low + high) / 2);
  const look = lookAnglesFor(record, time, observer) ?? lowLook;
  return { time, azimuthDeg: look?.azimuthDeg ?? 0 };
}

function predictPasses(satelliteId: string, startTimestamp: number, sequence: number, observer: { lat: number; lon: number; altitudeKm: number }, horizonHours = 24, minElevationDeg = 5): void {
  const record = catalog.find((item) => item.id === satelliteId);
  if (!record) {
    post({ type: 'ERROR', sequence, message: `Pass target is not loaded: ${satelliteId}` });
    return;
  }
  const hours = Math.max(1, Math.min(48, horizonHours));
  const threshold = Math.max(0, Math.min(30, minElevationDeg));
  const stepMs = 30_000;
  const end = startTimestamp + hours * 60 * 60_000;
  const passes: Array<{ startTime: number; endTime: number; maxTime: number; maxElevationDeg: number; riseAzimuthDeg: number; maxAzimuthDeg: number; setAzimuthDeg: number; maxShadowFraction: number }> = [];
  let previousTime = startTimestamp;
  let previous = lookAnglesFor(record, previousTime, observer);
  let above = (previous?.elevationDeg ?? -90) >= threshold;
  let currentPass: null | { startTime: number; riseAzimuthDeg: number; maxTime: number; maxElevationDeg: number; maxAzimuthDeg: number; maxShadowFraction: number } = above && previous
    ? { startTime: startTimestamp, riseAzimuthDeg: previous.azimuthDeg, maxTime: startTimestamp, maxElevationDeg: previous.elevationDeg, maxAzimuthDeg: previous.azimuthDeg, maxShadowFraction: previous.shadowFraction }
    : null;

  for (let time = startTimestamp + stepMs; time <= end && passes.length < 8; time += stepMs) {
    const look = lookAnglesFor(record, time, observer);
    const isAbove = (look?.elevationDeg ?? -90) >= threshold;
    if (!above && isAbove && look) {
      const rise = refineElevationCrossing(record, observer, previousTime, time, threshold);
      currentPass = { startTime: rise.time, riseAzimuthDeg: rise.azimuthDeg, maxTime: time, maxElevationDeg: look.elevationDeg, maxAzimuthDeg: look.azimuthDeg, maxShadowFraction: look.shadowFraction };
    }
    if (isAbove && look && currentPass && look.elevationDeg > currentPass.maxElevationDeg) {
      currentPass.maxTime = time;
      currentPass.maxElevationDeg = look.elevationDeg;
      currentPass.maxAzimuthDeg = look.azimuthDeg;
      currentPass.maxShadowFraction = look.shadowFraction;
    }
    if (above && !isAbove && currentPass) {
      const set = refineElevationCrossing(record, observer, previousTime, time, threshold);
      passes.push({ ...currentPass, endTime: set.time, setAzimuthDeg: set.azimuthDeg });
      currentPass = null;
    }
    above = isAbove;
    previous = look;
    previousTime = time;
  }
  if (currentPass && passes.length < 8) {
    const endLook = lookAnglesFor(record, end, observer);
    passes.push({ ...currentPass, endTime: end, setAzimuthDeg: endLook?.azimuthDeg ?? currentPass.maxAzimuthDeg });
  }
  post({ type: 'PASSES', sequence, satelliteId, startTime: startTimestamp, horizonHours: hours, passes });
}

workerScope.addEventListener('message', (event: MessageEvent<OrbitWorkerRequest>) => {
  const request = event.data;
  try {
    switch (request.type) {
      case 'LOAD_CATALOG':
        loadCatalog(request.satellites);
        break;
      case 'SET_ACTIVE_CATEGORIES':
        activeCategories = new Set(request.categories);
        break;
      case 'PROPAGATE':
        propagateCatalog(request.timestamp, request.sequence);
        break;
      case 'PROPAGATE_WINDOW':
        propagateWindow(request.startTimestamp, request.endTimestamp, request.sampleCount, request.sequence);
        break;
      case 'GENERATE_TRACK':
        generateTrack(request.satelliteId, request.timestamp, request.sequence, request.kind ?? 'orbit', request.samples);
        break;
      case 'OBSERVER_SKY':
        observerSky(request.timestamp, request.sequence, request.observer, request.minElevationDeg, request.maxResults);
        break;
      case 'PREDICT_PASSES':
        predictPasses(request.satelliteId, request.startTimestamp, request.sequence, request.observer, request.horizonHours, request.minElevationDeg);
        break;
      case 'CLEAR':
        catalog = [];
        break;
    }
  } catch (error) {
    post({ type: 'ERROR', message: error instanceof Error ? error.message : String(error) });
  }
});

post({ type: 'READY' });
