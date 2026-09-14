import type { EntityId } from '../../shared/types/entities';
import type { ObserverLocation, ObserverPassForecast, SatellitePass } from '../above-me/types';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { OrbitWorkerRequest, OrbitWorkerResponse } from '../../workers/orbit.worker';
import type { OrbitTrack, OrbitTrackKind } from './interaction';
import type { SatelliteRecord } from './types';

export interface OrbitFrame {
  sequence: number;
  timestamp: number;
  indices: Uint32Array;
  positions: Float32Array;
  validCount: number;
  errorCount: number;
}

export interface OrbitPredictionWindow {
  sequence: number;
  startTimestamp: number;
  endTimestamp: number;
  sampleCount: number;
  objectCount: number;
  indices: Uint32Array;
  positions: Float32Array;
  validCount: number;
  errorCount: number;
}

export interface ObserverSkyFrame {
  sequence: number;
  timestamp: number;
  visibleCount: number;
  indices: Uint32Array;
  lookAngles: Float32Array;
}

export interface OrbitWorkerClientOptions {
  onFrame?(frame: OrbitFrame): void;
  onWindow?(window: OrbitPredictionWindow): void;
  onTrack?(track: OrbitTrack): void;
  onTrail?(track: OrbitTrack): void;
  onCatalogReady?(loaded: number, rejected: number): void;
  onObserverSky?(frame: ObserverSkyFrame): void;
  onPasses?(forecast: ObserverPassForecast): void;
  onError?(message: string): void;
}

export class OrbitWorkerClient {
  readonly #worker: Worker;
  readonly #options: OrbitWorkerClientOptions;
  #sequence = 0;
  #trackSequence = 0;
  #trailSequence = 0;
  #lastAppliedSequence = -1;
  #lastAppliedTrackSequence = -1;
  #lastAppliedTrailSequence = -1;
  #observerSequence = 0;
  #passSequence = 0;
  #lastAppliedObserverSequence = -1;
  #lastAppliedPassSequence = -1;
  #lastTrackRequest: { satelliteId: string; timestamp: number; kind: OrbitTrackKind } | null = null;
  #lastTrailRequest: { satelliteId: string; timestamp: number; kind: OrbitTrackKind } | null = null;
  #disposed = false;

  constructor(options: OrbitWorkerClientOptions) {
    this.#options = options;
    this.#worker = new Worker(new URL('../../workers/orbit.worker.ts', import.meta.url), { type: 'module', name: 'signal-earth-orbit' });
    this.#worker.addEventListener('message', this.#onMessage);
    this.#worker.addEventListener('error', this.#onWorkerError);
  }

  loadCatalog(satellites: SatelliteRecord[]): void {
    if (this.#disposed) return;
    this.#lastTrackRequest = null;
    this.#lastTrailRequest = null;
    const request: OrbitWorkerRequest = {
      type: 'LOAD_CATALOG',
      satellites: satellites.map((satellite) => ({
        id: satellite.id,
        category: satellite.category,
        categories: satellite.categories,
        omm: satellite.omm,
      })),
    };
    this.#worker.postMessage(request);
  }

  setActiveCategories(categories: SatelliteCategory[]): void {
    if (this.#disposed) return;
    this.#worker.postMessage({ type: 'SET_ACTIVE_CATEGORIES', categories } satisfies OrbitWorkerRequest);
  }

  requestFrame(timestamp: number): number {
    if (this.#disposed) return -1;
    const sequence = ++this.#sequence;
    this.#worker.postMessage({ type: 'PROPAGATE', timestamp, sequence } satisfies OrbitWorkerRequest);
    return sequence;
  }

  requestWindow(startTimestamp: number, endTimestamp: number, sampleCount: number): number {
    if (this.#disposed) return -1;
    const sequence = ++this.#sequence;
    this.#worker.postMessage({ type: 'PROPAGATE_WINDOW', startTimestamp, endTimestamp, sampleCount, sequence } satisfies OrbitWorkerRequest);
    return sequence;
  }

  requestTrack(satelliteId: EntityId, timestamp: number, options: { force?: boolean; samples?: number; kind?: OrbitTrackKind } = {}): number {
    if (this.#disposed) return -1;
    const id = String(satelliteId);
    const kind = options.kind ?? 'orbit';
    const previous = this.#lastTrackRequest;
    if (!options.force && previous?.satelliteId === id && previous.kind === kind && Math.abs(timestamp - previous.timestamp) < 30_000) return -1;
    this.#lastTrackRequest = { satelliteId: id, timestamp, kind };
    const sequence = ++this.#trackSequence;
    const request: OrbitWorkerRequest = options.samples === undefined
      ? { type: 'GENERATE_TRACK', satelliteId: id, timestamp, sequence, kind }
      : { type: 'GENERATE_TRACK', satelliteId: id, timestamp, sequence, kind, samples: options.samples };
    this.#worker.postMessage(request);
    return sequence;
  }

  requestTrail(satelliteId: EntityId, timestamp: number, kind: OrbitTrackKind, options: { force?: boolean; samples?: number } = {}): number {
    if (this.#disposed || kind === 'off' || kind === 'orbit') return -1;
    const id = String(satelliteId);
    const previous = this.#lastTrailRequest;
    if (!options.force && previous?.satelliteId === id && previous.kind === kind && Math.abs(timestamp - previous.timestamp) < 30_000) return -1;
    this.#lastTrailRequest = { satelliteId: id, timestamp, kind };
    const sequence = ++this.#trailSequence;
    const request: OrbitWorkerRequest = options.samples === undefined
      ? { type: 'GENERATE_TRACK', satelliteId: id, timestamp, sequence, kind }
      : { type: 'GENERATE_TRACK', satelliteId: id, timestamp, sequence, kind, samples: options.samples };
    this.#worker.postMessage(request);
    return sequence;
  }


  requestObserverSky(observer: ObserverLocation, timestamp: number, options: { minElevationDeg?: number; maxResults?: number } = {}): number {
    if (this.#disposed) return -1;
    const sequence = ++this.#observerSequence;
    const request: OrbitWorkerRequest = {
      type: 'OBSERVER_SKY', timestamp, sequence,
      observer: { lat: observer.lat, lon: observer.lon, altitudeKm: observer.altitudeKm },
      ...(options.minElevationDeg === undefined ? {} : { minElevationDeg: options.minElevationDeg }),
      ...(options.maxResults === undefined ? {} : { maxResults: options.maxResults }),
    };
    this.#worker.postMessage(request);
    return sequence;
  }

  requestPasses(satelliteId: EntityId, observer: ObserverLocation, startTimestamp: number, options: { horizonHours?: number; minElevationDeg?: number } = {}): number {
    if (this.#disposed) return -1;
    const sequence = ++this.#passSequence;
    const request: OrbitWorkerRequest = {
      type: 'PREDICT_PASSES', satelliteId: String(satelliteId), startTimestamp, sequence,
      observer: { lat: observer.lat, lon: observer.lon, altitudeKm: observer.altitudeKm },
      ...(options.horizonHours === undefined ? {} : { horizonHours: options.horizonHours }),
      ...(options.minElevationDeg === undefined ? {} : { minElevationDeg: options.minElevationDeg }),
    };
    this.#worker.postMessage(request);
    return sequence;
  }

  clearTrackRequest(): void {
    this.#lastTrackRequest = null;
    this.#lastTrailRequest = null;
  }

  clear(): void {
    if (this.#disposed) return;
    this.#lastTrackRequest = null;
    this.#lastTrailRequest = null;
    this.#worker.postMessage({ type: 'CLEAR' } satisfies OrbitWorkerRequest);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker.removeEventListener('message', this.#onMessage);
    this.#worker.removeEventListener('error', this.#onWorkerError);
    this.#worker.terminate();
  }

  #onMessage = (event: MessageEvent<OrbitWorkerResponse>): void => {
    const response = event.data;
    if (response.type === 'FRAME') {
      if (response.sequence < this.#lastAppliedSequence) return;
      this.#lastAppliedSequence = response.sequence;
      this.#options.onFrame?.(response);
    } else if (response.type === 'WINDOW') {
      if (response.sequence < this.#lastAppliedSequence) return;
      this.#lastAppliedSequence = response.sequence;
      this.#options.onWindow?.(response);
    } else if (response.type === 'TRACK') {
      const track: OrbitTrack = {
        sequence: response.sequence,
        satelliteId: response.satelliteId as EntityId,
        kind: response.kind,
        centerTimestamp: response.centerTimestamp,
        startTimestamp: response.startTimestamp,
        endTimestamp: response.endTimestamp,
        periodMinutes: response.periodMinutes,
        sampleCount: response.sampleCount,
        positions: response.positions,
      };
      if (response.kind === 'orbit') {
        if (response.sequence < this.#lastAppliedTrackSequence) return;
        this.#lastAppliedTrackSequence = response.sequence;
        this.#options.onTrack?.(track);
      } else {
        if (response.sequence < this.#lastAppliedTrailSequence) return;
        this.#lastAppliedTrailSequence = response.sequence;
        this.#options.onTrail?.(track);
      }
    } else if (response.type === 'OBSERVER_SKY') {
      if (response.sequence < this.#lastAppliedObserverSequence) return;
      this.#lastAppliedObserverSequence = response.sequence;
      this.#options.onObserverSky?.(response);
    } else if (response.type === 'PASSES') {
      if (response.sequence < this.#lastAppliedPassSequence) return;
      this.#lastAppliedPassSequence = response.sequence;
      const passes: SatellitePass[] = response.passes.map((pass) => ({ ...pass, satelliteId: response.satelliteId as EntityId }));
      this.#options.onPasses?.({ generatedAt: Date.now(), startTime: response.startTime, horizonHours: response.horizonHours, satelliteId: response.satelliteId as EntityId, passes });
    } else if (response.type === 'CATALOG_READY') {
      this.#options.onCatalogReady?.(response.loaded, response.rejected);
    } else if (response.type === 'ERROR') {
      this.#options.onError?.(response.message);
    }
  };

  #onWorkerError = (event: ErrorEvent): void => {
    this.#options.onError?.(event.message || 'Orbit worker failed.');
  };
}
