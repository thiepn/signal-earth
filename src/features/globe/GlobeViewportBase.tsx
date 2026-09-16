import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CameraState } from '../../core/engine/camera.types';
import { EarthRenderer } from '../../core/engine/EarthRenderer';
import { GeoContextRenderer } from '../../core/engine/GeoContextRenderer';
import { AtmosphereRenderer } from '../../core/engine/AtmosphereRenderer';
import { AuroraRenderer } from '../../core/engine/AuroraRenderer';
import { GlobeEngine } from '../../core/engine/GlobeEngine';
import { OrbitRenderer } from '../../core/engine/OrbitRenderer';
import { ObserverRenderer } from '../../core/engine/ObserverRenderer';
import { NaturalEventRenderer } from '../../core/engine/NaturalEventRenderer';
import { QualityManager, type QualityLevel, type QualityMode } from '../../core/engine/QualityManager';
import { SeismicRenderer } from '../../core/engine/SeismicRenderer';
import type { GlobeEngineMetrics, GlobePointOfView } from '../../core/engine/globe.types';
import type { SimulationClockSnapshot } from '../../core/time/temporal';
import type { EntityId, GeoCoordinates } from '../../shared/types/entities';
import type { VisualMode } from '../../shared/types/layers';
import type { SatelliteCategory } from '../../shared/types/orbit';
import { type OrbitScaleMode } from '../orbit/interaction';
import { isTemporalDiscontinuity, makeTemporalSamplePlan, orbitPlaybackProfile, type OrbitTrailMode, type TemporalContinuitySample } from '../orbit/playback';
import type { OrbitCatalog, SatelliteRecord, SatelliteTelemetry } from '../orbit/types';
import { OrbitWorkerClient, type OrbitFrame } from '../orbit/OrbitWorkerClient';
import type { EarthquakeRecord } from '../seismic/types';
import type { NaturalEventCategory, NaturalEventRecord } from '../natural-events/types';
import type { AuroraHemispheres, AuroraModel } from '../space-weather/types';
import type { ObserverLocation, ObserverPassForecast, ObserverSkySnapshot, ObserverSkySatellite } from '../above-me/types';
import type { AtmosphereStatus, WeatherLayerSettings } from '../weather/types';
import type { GeoContextLabel } from './geoContext';

export interface GlobeViewportQuality { level: QualityLevel; mode: QualityMode; }

export interface GlobeViewportHandle {
  frameEarth(): void;
  flyToPointOfView(pointOfView: GlobePointOfView, durationMs?: number): void;
  focusCoordinates(coordinates: GeoCoordinates, altitude?: number): void;
  setQuality(value: 'auto' | QualityLevel): void;
  getQuality(): GlobeViewportQuality | null;
  followSelectedSatellite(): boolean;
  frameSelectedOrbit(): boolean;
  stopOrbitCamera(): void;
  captureImage(): Promise<Blob>;
  captureStream(fps?: number): MediaStream | null;
  refreshAtmosphere(): void;
}

interface GlobeViewportProps {
  visualMode: VisualMode;
  reducedMotion: boolean;
  getSimulationTime(): number;
  clock: SimulationClockSnapshot | null;
  earthquakes: EarthquakeRecord[];
  earthquakesEnabled: boolean;
  naturalEvents: NaturalEventRecord[];
  naturalEventsEnabled: boolean;
  weatherEnabled: boolean;
  weatherSettings: WeatherLayerSettings;
  weatherStorms: NaturalEventRecord[];
  activeNaturalEventCategories: Record<NaturalEventCategory, boolean>;
  simulationTime: number;
  selectedEntityId: EntityId | null;
  orbitCatalog: OrbitCatalog | null;
  orbitEnabled: boolean;
  orbitTemporalAvailable: boolean;
  activeOrbitCategories: SatelliteCategory[];
  orbitScaleMode: OrbitScaleMode;
  orbitTrailMode: OrbitTrailMode;
  showOrbitPath: boolean;
  showGroundTrack: boolean;
  auroraModel: AuroraModel | null;
  auroraEnabled: boolean;
  auroraHemispheres: AuroraHemispheres;
  observerLocation: ObserverLocation | null;
  observerPassAnchor: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPointOfView?: (pointOfView: GlobePointOfView) => void;
  onMetrics?: (metrics: GlobeEngineMetrics) => void;
  onGlobeClick?: (coordinates: { lat: number; lon: number }) => void;
  onEarthquakeClick?: (earthquake: EarthquakeRecord) => void;
  onEarthquakeHover?: (earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => void;
  onNaturalEventClick?: (event: NaturalEventRecord) => void;
  onNaturalEventHover?: (event: NaturalEventRecord | null, position?: { x: number; y: number }) => void;
  onSatelliteClick?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;
  onSatelliteHover?: (satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => void;
  onGeoContextNavigate?: (label: GeoContextLabel) => void;
  onSelectedSatelliteTelemetry?: (telemetry: SatelliteTelemetry | null) => void;
  onOrbitStats?: (stats: { validCount: number; errorCount: number; workerLoaded: number; workerRejected: number }) => void;
  onOrbitWorkerError?: (message: string) => void;
  onObserverSky?: (snapshot: ObserverSkySnapshot | null) => void;
  onObserverPasses?: (forecast: ObserverPassForecast | null) => void;
  onAtmosphereStatus?: (status: AtmosphereStatus) => void;
  onCameraState?: (state: Readonly<CameraState>) => void;
  onManualCameraInput?: () => void;
  onQualityChange?: (quality: GlobeViewportQuality) => void;
}

export const GlobeViewport = forwardRef<GlobeViewportHandle, GlobeViewportProps>(function GlobeViewport(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const geoContextRef = useRef<GeoContextRenderer | null>(null);
  const atmosphereRef = useRef<AtmosphereRenderer | null>(null);
  const seismicRef = useRef<SeismicRenderer | null>(null);
  const naturalEventsRef = useRef<NaturalEventRenderer | null>(null);
  const orbitRef = useRef<OrbitRenderer | null>(null);
  const auroraRef = useRef<AuroraRenderer | null>(null);
  const observerRef = useRef<ObserverRenderer | null>(null);
  const orbitClientRef = useRef<OrbitWorkerClient | null>(null);
  const requestOrbitUpdateRef = useRef<((force?: boolean) => void) | null>(null);
  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  useImperativeHandle(ref, () => ({
    frameEarth: () => engineRef.current?.frameEarth(),
    flyToPointOfView: (pointOfView, durationMs = 1_100) => engineRef.current?.flyToPointOfView(pointOfView, durationMs),
    focusCoordinates: (coordinates, altitude = 0.82) => engineRef.current?.focusCoordinates(coordinates, altitude),
    setQuality: (value) => {
      const manager = engineRef.current?.qualityManager;
      if (!manager) return;
      if (value === 'auto') manager.setAuto(); else manager.set(value, 'manual');
      callbacksRef.current.onQualityChange?.({ level: manager.level, mode: manager.mode });
    },
    getQuality: () => {
      const manager = engineRef.current?.qualityManager;
      return manager ? { level: manager.level, mode: manager.mode } : null;
    },
    followSelectedSatellite: () => {
      const engine = engineRef.current;
      const orbit = orbitRef.current;
      const id = callbacksRef.current.selectedEntityId;
      if (!engine || !orbit || !id || !String(id).startsWith('satellite:') || !orbit.getSelectedWorldPosition()) return false;
      engine.followWorldTarget(id, () => orbit.getSelectedWorldPosition());
      return true;
    },
    frameSelectedOrbit: () => {
      const engine = engineRef.current;
      const orbit = orbitRef.current;
      const id = callbacksRef.current.selectedEntityId;
      const normal = orbit?.getOrbitPlaneNormal() ?? null;
      const radius = orbit?.getOrbitPathRadius() ?? null;
      if (!engine || !id || !String(id).startsWith('satellite:') || !normal || !radius) return false;
      engine.frameOrbitPlane(id, normal, radius);
      return true;
    },
    stopOrbitCamera: () => engineRef.current?.stopWorldTracking(true),
    captureImage: () => engineRef.current?.captureImage('image/png') ?? Promise.reject(new Error('Globe renderer is not ready.')),
    captureStream: (fps = 30) => engineRef.current?.captureStream(fps) ?? null,
    refreshAtmosphere: () => atmosphereRef.current?.refresh(),
  }), []);

  useEffect(() => {
    engineRef.current?.setReducedMotion(props.reducedMotion);
    seismicRef.current?.setReducedMotion(props.reducedMotion);
    observerRef.current?.setReducedMotion(props.reducedMotion);
  }, [props.reducedMotion]);
  useEffect(() => { seismicRef.current?.setEarthquakes(props.earthquakes); }, [props.earthquakes]);
  useEffect(() => { seismicRef.current?.setEnabled(props.earthquakesEnabled); }, [props.earthquakesEnabled]);
  useEffect(() => { if (props.earthquakesEnabled) seismicRef.current?.setSimulationTime(props.simulationTime); }, [props.earthquakesEnabled, props.simulationTime]);
  useEffect(() => { seismicRef.current?.setSelected(props.selectedEntityId); }, [props.selectedEntityId]);
  useEffect(() => { naturalEventsRef.current?.setEvents(props.naturalEvents); }, [props.naturalEvents]);
  useEffect(() => { naturalEventsRef.current?.setEnabled(props.naturalEventsEnabled); }, [props.naturalEventsEnabled]);
  useEffect(() => { naturalEventsRef.current?.setActiveCategories(props.activeNaturalEventCategories); }, [props.activeNaturalEventCategories]);
  useEffect(() => { if (props.naturalEventsEnabled) naturalEventsRef.current?.setSimulationTime(props.simulationTime); }, [props.naturalEventsEnabled, props.simulationTime]);
  useEffect(() => { naturalEventsRef.current?.setSelected(props.selectedEntityId); }, [props.selectedEntityId]);
  useEffect(() => { atmosphereRef.current?.setEnabled(props.weatherEnabled); }, [props.weatherEnabled]);
  useEffect(() => { atmosphereRef.current?.setSettings(props.weatherSettings); }, [props.weatherSettings]);
  useEffect(() => { atmosphereRef.current?.setStormEvents(props.weatherStorms); }, [props.weatherStorms]);

  useEffect(() => { auroraRef.current?.setModel(props.auroraModel); }, [props.auroraModel]);
  useEffect(() => { auroraRef.current?.setEnabled(props.auroraEnabled); }, [props.auroraEnabled]);
  useEffect(() => { if (props.auroraEnabled) auroraRef.current?.setSimulationTime(props.simulationTime); }, [props.auroraEnabled, props.simulationTime]);
  useEffect(() => { auroraRef.current?.setHemispheres(props.auroraHemispheres); }, [props.auroraHemispheres]);
  useEffect(() => {
    auroraRef.current?.setVisualMode(props.visualMode);
    geoContextRef.current?.refreshVisualMode();
  }, [props.visualMode]);
  useEffect(() => {
    observerRef.current?.setLocation(props.observerLocation);
    if (!props.observerLocation) callbacksRef.current.onObserverSky?.(null);
    else requestOrbitUpdateRef.current?.(true);
  }, [props.observerLocation]);

  useEffect(() => {
    const orbit = orbitRef.current;
    const client = orbitClientRef.current;
    orbit?.setCatalog(props.orbitCatalog?.satellites ?? []);
    if (props.orbitCatalog?.satellites) {
      client?.loadCatalog(props.orbitCatalog.satellites);
      requestOrbitUpdateRef.current?.(true);
    } else {
      client?.clear();
    }
  }, [props.orbitCatalog]);

  useEffect(() => { orbitRef.current?.setEnabled(props.orbitEnabled); requestOrbitUpdateRef.current?.(true); }, [props.orbitEnabled]);
  useEffect(() => {
    if (!props.orbitTemporalAvailable) {
      callbacksRef.current.onObserverSky?.(null);
      callbacksRef.current.onObserverPasses?.(null);
    }
    requestOrbitUpdateRef.current?.(true);
  }, [props.orbitTemporalAvailable]);
  useEffect(() => {
    orbitRef.current?.setActiveCategories(props.activeOrbitCategories);
    orbitClientRef.current?.setActiveCategories(props.activeOrbitCategories);
    requestOrbitUpdateRef.current?.(true);
  }, [props.activeOrbitCategories]);
  useEffect(() => { orbitRef.current?.setScaleMode(props.orbitScaleMode); }, [props.orbitScaleMode]);
  useEffect(() => { orbitRef.current?.setTrackVisibility({ orbitPath: props.showOrbitPath, groundTrack: props.showGroundTrack }); }, [props.showGroundTrack, props.showOrbitPath]);

  useEffect(() => {
    const orbit = orbitRef.current;
    const client = orbitClientRef.current;
    orbit?.setSelected(props.selectedEntityId);
    const id = props.selectedEntityId;
    if (id && String(id).startsWith('satellite:') && props.orbitTemporalAvailable) {
      const timestamp = callbacksRef.current.getSimulationTime();
      client?.requestTrack(id, timestamp, { force: true, kind: 'orbit' });
      if (props.orbitTrailMode !== 'off') client?.requestTrail(id, timestamp, props.orbitTrailMode, { force: true });
      else orbit?.setTrail(null);
      requestOrbitUpdateRef.current?.(true);
    } else {
      orbit?.setTrack(null);
      orbit?.setTrail(null);
      client?.clearTrackRequest();
      engineRef.current?.stopWorldTracking(true);
    }
  }, [props.orbitTemporalAvailable, props.selectedEntityId]);

  useEffect(() => {
    const id = props.selectedEntityId;
    const client = orbitClientRef.current;
    const orbit = orbitRef.current;
    if (!props.orbitTemporalAvailable || !id || !String(id).startsWith('satellite:') || props.orbitTrailMode === 'off') {
      orbit?.setTrail(null);
      return;
    }
    client?.requestTrail(id, callbacksRef.current.getSimulationTime(), props.orbitTrailMode, { force: true });
  }, [props.orbitTemporalAvailable, props.orbitTrailMode, props.selectedEntityId]);

  useEffect(() => {
    // Playback-profile changes should be reflected immediately. Timeline seeks
    // are detected by the scheduler's continuity check, avoiding a forced reset
    // on every 250 ms React clock snapshot.
    requestOrbitUpdateRef.current?.(false);
  }, [props.clock?.speed, props.clock?.isPlaying]);

  useEffect(() => {
    // While paused, simulationTime only changes on an explicit seek, so we can
    // respond immediately without turning the 250 ms display clock sync into
    // an orbit-propagation loop during playback.
    if (props.clock?.isPlaying === false) requestOrbitUpdateRef.current?.(false);
  }, [props.clock?.isPlaying, props.simulationTime]);

  useEffect(() => {
    const client = orbitClientRef.current;
    if (!props.orbitTemporalAvailable || !client || !props.observerLocation || !props.orbitCatalog?.satellites.length) {
      callbacksRef.current.onObserverPasses?.(null);
      return;
    }
    const iss = props.orbitCatalog.satellites.find((satellite) => satellite.noradId === '25544' || /ISS \(ZARYA\)|INTERNATIONAL SPACE STATION/i.test(satellite.name));
    if (!iss) { callbacksRef.current.onObserverPasses?.(null); return; }
    client.requestPasses(iss.id, props.observerLocation, props.observerPassAnchor, { horizonHours: 24, minElevationDeg: 5 });
  }, [props.observerLocation, props.observerPassAnchor, props.orbitCatalog, props.orbitTemporalAvailable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const qualityManager = new QualityManager();
    const engine = new GlobeEngine(host, { qualityManager });
    engine.setReducedMotion(callbacksRef.current.reducedMotion);
    const earth = new EarthRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), getVisualMode: () => callbacksRef.current.visualMode });
    const geoContext = new GeoContextRenderer({ getVisualMode: () => callbacksRef.current.visualMode, onNavigate: (label) => callbacksRef.current.onGeoContextNavigate?.(label) });
    const atmosphere = new AtmosphereRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), onStatus: (status) => callbacksRef.current.onAtmosphereStatus?.(status) });
    const aurora = new AuroraRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), getVisualMode: () => callbacksRef.current.visualMode });
    const observer = new ObserverRenderer();
    const seismic = new SeismicRenderer({
      onSelect: (earthquake) => callbacksRef.current.onEarthquakeClick?.(earthquake),
      onHover: (earthquake, position) => callbacksRef.current.onEarthquakeHover?.(earthquake, position),
      getSimulationTime: () => callbacksRef.current.getSimulationTime(),
    });
    const naturalEvents = new NaturalEventRenderer({
      onSelect: (event) => callbacksRef.current.onNaturalEventClick?.(event),
      onHover: (event, position) => callbacksRef.current.onNaturalEventHover?.(event, position),
      getSimulationTime: () => callbacksRef.current.getSimulationTime(),
    });
    const orbit = new OrbitRenderer({
      onSelect: (satellite, telemetry) => callbacksRef.current.onSatelliteClick?.(satellite, telemetry),
      onHover: (satellite, telemetry, position) => callbacksRef.current.onSatelliteHover?.(satellite, telemetry, position),
      onSelectedTelemetry: (telemetry) => callbacksRef.current.onSelectedSatelliteTelemetry?.(telemetry),
      getSimulationTime: () => callbacksRef.current.getSimulationTime(),
    });
    const workerStats = { validCount: 0, errorCount: 0, workerLoaded: 0, workerRejected: 0 };
    const orbitClient = new OrbitWorkerClient({
      onFrame: (frame: OrbitFrame) => {
        orbit.setFrame(frame);
        workerStats.validCount = frame.validCount;
        workerStats.errorCount = frame.errorCount;
        callbacksRef.current.onOrbitStats?.({ ...workerStats });
      },
      onWindow: (window) => {
        orbit.setPredictionWindow(window);
        workerStats.validCount = window.validCount;
        workerStats.errorCount = window.errorCount;
        callbacksRef.current.onOrbitStats?.({ ...workerStats });
      },
      onTrack: (track) => orbit.setTrack(track),
      onTrail: (trail) => orbit.setTrail(trail),
      onObserverSky: (frame) => {
        const catalog = callbacksRef.current.orbitCatalog?.satellites ?? [];
        const satellites: ObserverSkySatellite[] = [];
        for (let slot = 0; slot < frame.indices.length; slot += 1) {
          const catalogIndex = frame.indices[slot]!;
          const satellite = catalog[catalogIndex];
          const offset = slot * 5;
          if (!satellite) continue;
          const azimuthDeg = frame.lookAngles[offset]!;
          const elevationDeg = frame.lookAngles[offset + 1]!;
          const rangeKm = frame.lookAngles[offset + 2]!;
          const altitudeKm = frame.lookAngles[offset + 3]!;
          const speedKmS = frame.lookAngles[offset + 4]!;
          if (![azimuthDeg, elevationDeg, rangeKm, altitudeKm, speedKmS].every(Number.isFinite)) continue;
          satellites.push({ id: satellite.id, catalogIndex, name: satellite.name, category: satellite.category, azimuthDeg, elevationDeg, rangeKm, altitudeKm, speedKmS });
        }
        callbacksRef.current.onObserverSky?.({ timestamp: frame.timestamp, visibleCount: frame.visibleCount, satellites });
      },
      onPasses: (forecast) => callbacksRef.current.onObserverPasses?.(forecast),
      onCatalogReady: (loaded, rejected) => {
        workerStats.workerLoaded = loaded;
        workerStats.workerRejected = rejected;
        callbacksRef.current.onOrbitStats?.({ ...workerStats });
      },
      onError: (message) => callbacksRef.current.onOrbitWorkerError?.(message),
    });
    engineRef.current = engine;
    geoContextRef.current = geoContext;
    atmosphereRef.current = atmosphere;
    seismicRef.current = seismic;
    naturalEventsRef.current = naturalEvents;
    orbitRef.current = orbit;
    auroraRef.current = aurora;
    observerRef.current = observer;
    orbitClientRef.current = orbitClient;

    let schedulerTimer: number | null = null;
    let disposed = false;
    let lastContinuity: TemporalContinuitySample | null = null;
    let lastTrackRealTime = -Infinity;
    let lastObserverRealTime = -Infinity;

    const requestOrbitUpdate = (force = false) => {
      if (disposed || !callbacksRef.current.orbitCatalog?.satellites.length) return;
      const nowPerformance = performance.now();
      const simulationTime = callbacksRef.current.getSimulationTime();
      const clock = callbacksRef.current.clock;

      if (callbacksRef.current.orbitEnabled) {
        const continuity: TemporalContinuitySample = {
          simulationTime, performanceTime: nowPerformance, speed: clock?.speed ?? 1, playing: clock?.isPlaying ?? true,
        };
        const discontinuity = force || isTemporalDiscontinuity(lastContinuity, continuity);
        if (discontinuity) orbit.markTemporalDiscontinuity();
        lastContinuity = continuity;
        const plan = makeTemporalSamplePlan(simulationTime, clock);
        orbitClient.requestWindow(plan.startTimestamp, plan.endTimestamp, plan.sampleCount);
        const selectedId = callbacksRef.current.selectedEntityId;
        if (callbacksRef.current.orbitTemporalAvailable && selectedId && String(selectedId).startsWith('satellite:')) {
          const profile = orbitPlaybackProfile(clock);
          if (discontinuity || nowPerformance - lastTrackRealTime >= profile.trackCadenceMs) {
            orbitClient.requestTrack(selectedId, simulationTime, { force: true, kind: 'orbit', samples: 145 });
            const trailMode = callbacksRef.current.orbitTrailMode;
            if (trailMode !== 'off') orbitClient.requestTrail(selectedId, simulationTime, trailMode, { force: true, samples: trailMode === 'past-10m' ? 65 : 145 });
            lastTrackRealTime = nowPerformance;
          }
        }
      }

      const observerLocation = callbacksRef.current.observerLocation;
      if (observerLocation && callbacksRef.current.orbitTemporalAvailable && (force || nowPerformance - lastObserverRealTime >= 2_000)) {
        orbitClient.requestObserverSky(observerLocation, simulationTime, { minElevationDeg: 0, maxResults: 64 });
        lastObserverRealTime = nowPerformance;
      }
    };
    requestOrbitUpdateRef.current = requestOrbitUpdate;

    const scheduleOrbitTick = () => {
      if (disposed || document.hidden) return;
      const profile = orbitPlaybackProfile(callbacksRef.current.clock);
      schedulerTimer = window.setTimeout(schedulerTick, profile.cadenceMs);
    };
    const schedulerTick = () => {
      if (disposed || document.hidden) { schedulerTimer = null; return; }
      requestOrbitUpdate(false);
      scheduleOrbitTick();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (schedulerTimer !== null) window.clearTimeout(schedulerTimer);
        schedulerTimer = null;
      } else if (schedulerTimer === null) {
        requestOrbitUpdate(true);
        scheduleOrbitTick();
      }
    };

    const unsubscribeQuality = qualityManager.subscribe((level) => callbacksRef.current.onQualityChange?.({ level, mode: qualityManager.mode }));
    const unsubscribeMetrics = engine.subscribeMetrics((metrics) => callbacksRef.current.onMetrics?.(metrics));
    const unsubscribePov = engine.subscribePointOfView((pov) => callbacksRef.current.onPointOfView?.(pov));
    const unsubscribeClick = engine.subscribeGlobeClick((coordinates) => callbacksRef.current.onGlobeClick?.(coordinates));
    const unsubscribeCamera = engine.subscribeCameraState((state) => callbacksRef.current.onCameraState?.(state));
    const unsubscribeManualCamera = engine.subscribeManualCameraInput(() => callbacksRef.current.onManualCameraInput?.());

    try {
      engine.registerRenderer(earth);
      engine.registerRenderer(geoContext);
      engine.registerRenderer(atmosphere);
      engine.registerRenderer(aurora);
      engine.registerRenderer(observer);
      engine.registerRenderer(seismic);
      engine.registerRenderer(naturalEvents);
      engine.registerRenderer(orbit);
      engine.mount();
      atmosphere.setEnabled(callbacksRef.current.weatherEnabled);
      atmosphere.setSettings(callbacksRef.current.weatherSettings);
      atmosphere.setStormEvents(callbacksRef.current.weatherStorms);
      seismic.setReducedMotion(callbacksRef.current.reducedMotion);
      seismic.setEarthquakes(callbacksRef.current.earthquakes);
      seismic.setEnabled(callbacksRef.current.earthquakesEnabled);
      seismic.setSimulationTime(callbacksRef.current.simulationTime);
      seismic.setSelected(callbacksRef.current.selectedEntityId);
      naturalEvents.setEvents(callbacksRef.current.naturalEvents);
      naturalEvents.setEnabled(callbacksRef.current.naturalEventsEnabled);
      naturalEvents.setActiveCategories(callbacksRef.current.activeNaturalEventCategories);
      naturalEvents.setSimulationTime(callbacksRef.current.simulationTime);
      naturalEvents.setSelected(callbacksRef.current.selectedEntityId);
      aurora.setModel(callbacksRef.current.auroraModel);
      aurora.setEnabled(callbacksRef.current.auroraEnabled);
      aurora.setSimulationTime(callbacksRef.current.simulationTime);
      aurora.setHemispheres(callbacksRef.current.auroraHemispheres);
      aurora.setVisualMode(callbacksRef.current.visualMode);
      observer.setReducedMotion(callbacksRef.current.reducedMotion);
      observer.setLocation(callbacksRef.current.observerLocation);
      orbit.setCatalog(callbacksRef.current.orbitCatalog?.satellites ?? []);
      orbit.setEnabled(callbacksRef.current.orbitEnabled);
      orbit.setActiveCategories(callbacksRef.current.activeOrbitCategories);
      orbit.setSelected(callbacksRef.current.selectedEntityId);
      orbit.setScaleMode(callbacksRef.current.orbitScaleMode);
      orbit.setTrackVisibility({ orbitPath: callbacksRef.current.showOrbitPath, groundTrack: callbacksRef.current.showGroundTrack });
      orbitClient.setActiveCategories(callbacksRef.current.activeOrbitCategories);
      if (callbacksRef.current.orbitCatalog?.satellites) orbitClient.loadCatalog(callbacksRef.current.orbitCatalog.satellites);
      const selectedId = callbacksRef.current.selectedEntityId;
      if (selectedId && String(selectedId).startsWith('satellite:')) {
        const timestamp = callbacksRef.current.getSimulationTime();
        orbitClient.requestTrack(selectedId, timestamp, { force: true, kind: 'orbit' });
        if (callbacksRef.current.orbitTrailMode !== 'off') orbitClient.requestTrail(selectedId, timestamp, callbacksRef.current.orbitTrailMode, { force: true });
      }
      requestOrbitUpdate(true);
      document.addEventListener('visibilitychange', onVisibilityChange);
      scheduleOrbitTick();
      callbacksRef.current.onQualityChange?.({ level: qualityManager.level, mode: qualityManager.mode });
      callbacksRef.current.onReady?.();
    } catch (mountError) {
      callbacksRef.current.onError?.(mountError instanceof Error ? mountError.message : String(mountError));
    }

    return () => {
      disposed = true;
      requestOrbitUpdateRef.current = null;
      if (schedulerTimer !== null) window.clearTimeout(schedulerTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeQuality(); unsubscribeMetrics(); unsubscribePov(); unsubscribeClick(); unsubscribeCamera(); unsubscribeManualCamera();
      orbitClient.dispose(); engine.dispose();
      geoContextRef.current = null; atmosphereRef.current = null; seismicRef.current = null; naturalEventsRef.current = null; orbitRef.current = null; auroraRef.current = null; observerRef.current = null; orbitClientRef.current = null; engineRef.current = null;
    };
  }, []);

  return <div
    className="globe-canvas"
    ref={hostRef}
    role="region"
    tabIndex={0}
    aria-label="Interactive three-dimensional Earth. Use arrow keys to move, Page Up and Page Down to zoom, and Home to reset."
    onKeyDown={(event) => {
      const engine = engineRef.current;
      const pov = engine?.pointOfView();
      if (!engine || !pov) return;
      let next = { ...pov };
      const step = event.shiftKey ? 15 : 5;
      if (event.key === 'ArrowUp') next.lat = Math.min(89, pov.lat + step);
      else if (event.key === 'ArrowDown') next.lat = Math.max(-89, pov.lat - step);
      else if (event.key === 'ArrowLeft') next.lng = ((pov.lng - step + 540) % 360) - 180;
      else if (event.key === 'ArrowRight') next.lng = ((pov.lng + step + 540) % 360) - 180;
      else if (event.key === 'PageUp') next.altitude = Math.max(0.08, pov.altitude - 0.18);
      else if (event.key === 'PageDown') next.altitude = Math.min(15, pov.altitude + 0.18);
      else if (event.key === 'Home') { event.preventDefault(); engine.frameEarth(); return; }
      else return;
      event.preventDefault();
      callbacksRef.current.onManualCameraInput?.();
      engine.flyToPointOfView(next, callbacksRef.current.reducedMotion ? 0 : 180);
    }}
  />;
});
