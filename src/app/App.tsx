import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActionBus } from './ActionBus';
import { APP_VERSION } from './version';
import {
  detectSystemAccessibilityPreferences,
  effectiveHighContrast,
  effectiveReducedMotion,
  loadAccessibilityPreferences,
  saveAccessibilityPreferences,
  subscribeSystemAccessibilityPreferences,
  type ContrastPreference,
  type MotionPreference,
  type SystemAccessibilityPreferences,
} from '../core/accessibility/preferences';
import { detectDeviceCapabilities } from '../core/device/capabilities';
import type { AppAction } from './actions';
import type { DataSnapshot } from '../core/data/ProviderAdapter';
import type { QualityLevel } from '../core/engine/QualityManager';
import type { GlobeEngineMetrics, GlobePointOfView } from '../core/engine/globe.types';
import { INITIAL_APP_STATE, reduceAppState } from '../core/state/store';
import { TimeEngine } from '../core/time/TimeEngine';
import type { SimulationSpeed } from '../core/time/temporal';
import { GlobeViewport, type GlobeViewportHandle, type GlobeViewportQuality } from '../features/globe/GlobeViewport';
import type { EarthquakeFeed, EarthquakeRecord, EarthquakeTimeWindow } from '../features/seismic/types';
import { filterEarthquakesAtSimulationTime, filterEarthquakesByMagnitude } from '../features/seismic/filter';
import { earthquakeToSignalEntity } from '../features/seismic/types';
import { TimelineControls } from '../features/timeline/TimelineControls';
import { EarthquakeService } from '../providers/usgs';
import { NaturalEventService, EONET_CACHE_POLICY } from '../providers/eonet';
import { CelesTrakService } from '../providers/celestrak';
import { SpaceWeatherService, SWPC_CACHE_POLICY } from '../providers/swpc';
import { LocalWeatherService, OPEN_METEO_CACHE_POLICY } from '../providers/openmeteo';
import { USGS_FEED_POLICY } from '../providers/usgs/UsgsEarthquakeProvider';
import { SOURCE_REGISTRY } from '../core/data/sourceRegistry';
import { asEntityId, type EntityId, type SignalEntity } from '../shared/types/entities';
import type { LayerId, VisualMode } from '../shared/types/layers';
import type { SatelliteCategory } from '../shared/types/orbit';
import type { OrbitCameraMode, OrbitScaleMode } from '../features/orbit/interaction';
import type { OrbitTrailMode } from '../features/orbit/playback';
import type { OrbitCatalog, SatelliteRecord, SatelliteTelemetry } from '../features/orbit/types';
import { ORBIT_CATEGORIES, satelliteToSignalEntity } from '../features/orbit/types';
import type { NaturalEventCategory, NaturalEventFeed, NaturalEventRecord } from '../features/natural-events/types';
import { naturalEventToSignalEntity } from '../features/natural-events/types';
import { filterNaturalEventsAtTime, filterNaturalEventsByCategories, geometryFrameAt } from '../features/natural-events/timeline';
import type { AuroraHemispheres, SpaceWeatherFeed } from '../features/space-weather/types';
import { AboveMeControls } from '../features/above-me/AboveMeControls';
import { observerAstronomy } from '../features/above-me/astronomy';
import { nextSolarEvents } from '../core/astronomy/observer';
import { auroraModelValueAt } from '../features/above-me/aurora';
import { clearSavedObserverLocation, loadSavedObserverLocation, requestBrowserLocation, saveObserverLocation } from '../features/above-me/geolocation';
import type { GeolocationState, LocalWeather, ObserverLocation, ObserverPassForecast, ObserverSkySnapshot } from '../features/above-me/types';
import { isAuroraModelApplicable } from '../features/space-weather/timeline';
import { BRIEFINGS, BriefingLauncher, BriefingOverlay, TourEngine, type BriefingId, type BriefingInstruction, type BriefingStep, type TourState } from '../features/briefings';
import { buildSearchDocuments, searchDocuments } from '../features/search';
import { buildShareUrl, parseShareView, type ShareViewState } from '../features/share/shareState';
import { composeSignalEarthCapture, downloadBlob, preferredRecordingMimeType, recordCanvas, releaseFilename } from '../features/capture/capture';
import { loadSearchCountries, type SearchCountry } from '../features/search/countries';
import type { ParsedCommand, RankedSearchResult } from '../features/search/types';
import { BottomSheet } from '../ui/components/BottomSheet';
import { LoadingState } from '../ui/components/LoadingState';
import { RendererError } from '../ui/components/RendererError';
import { SearchOverlay } from '../ui/components/SearchOverlay';
import { ToastHost, type ToastMessage } from '../ui/components/ToastHost';
import { TopBar } from '../ui/components/TopBar';
import { InspectorPanel } from '../ui/panels/InspectorPanel';
import { LayerPanel } from '../ui/panels/LayerPanel';
import { SettingsPanel } from '../ui/panels/SettingsPanel';
import { useVisibilityAwareInterval } from '../ui/hooks/useVisibilityAwareInterval';

const INITIAL_POV: GlobePointOfView = { lat: 18, lng: 8, altitude: 2.35 };

type MobileSheet = 'layers' | 'inspector' | 'time' | 'here' | 'settings' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface BriefingRestoreSnapshot {
  layers: Record<LayerId, boolean>;
  visualMode: VisualMode;
  clock: ReturnType<TimeEngine['snapshot']>;
  selectionId: EntityId | null;
  pointOfView: GlobePointOfView;
  activeOrbitCategories: Record<SatelliteCategory, boolean>;
  activeNaturalEventCategories: Record<NaturalEventCategory, boolean>;
  orbitScaleMode: OrbitScaleMode;
  orbitTrailMode: OrbitTrailMode;
  showOrbitPath: boolean;
  showGroundTrack: boolean;
  earthquakeMagnitude: number;
  earthquakeWindow: EarthquakeTimeWindow;
}

interface BriefingSelectionTarget {
  id: EntityId;
  kind: 'earthquake' | 'natural-event' | 'satellite';
  coordinates?: { lat: number; lon: number };
}

async function waitForValue<T>(getter: () => T | null | undefined, signal: AbortSignal, timeoutMs = 6_000, intervalMs = 80): Promise<T | null> {
  const startedAt = performance.now();
  while (!signal.aborted && performance.now() - startedAt < timeoutMs) {
    const value = getter();
    if (value !== null && value !== undefined) return value;
    await new Promise<void>((resolve) => window.setTimeout(resolve, intervalMs));
  }
  return null;
}

function makeLocationEntity(lat: number, lon: number, name = 'Surface target'): SignalEntity {
  return {
    id: asEntityId(`location:${lat.toFixed(5)},${lon.toFixed(5)}`),
    kind: 'location',
    name,
    source: SOURCE_REGISTRY.local,
    temporalType: 'static',
    coordinates: { lat, lon },
  };
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard access is unavailable.');
}

export function App() {
  const initialShareRef = useRef(parseShareView(window.location.href));
  const initialAppStateRef = useRef({
    ...INITIAL_APP_STATE,
    layers: initialShareRef.current?.layers ?? INITIAL_APP_STATE.layers,
    visualMode: initialShareRef.current?.visualMode ?? INITIAL_APP_STATE.visualMode,
  });
  const pendingSharedTargetRef = useRef<EntityId | null>(initialShareRef.current?.selectedEntityId ?? null);
  const sharedPointOfViewAppliedRef = useRef(false);
  const viewportRef = useRef<GlobeViewportHandle>(null);
  const actionBusRef = useRef(new ActionBus());
  const timeEngineRef = useRef(new TimeEngine());
  const earthquakeServiceRef = useRef(new EarthquakeService());
  const naturalEventServiceRef = useRef(new NaturalEventService());
  const celestrakServiceRef = useRef(new CelesTrakService());
  const spaceWeatherServiceRef = useRef(new SpaceWeatherService());
  const localWeatherServiceRef = useRef(new LocalWeatherService());
  const tourEngineRef = useRef(new TourEngine());
  const briefingRestoreRef = useRef<BriefingRestoreSnapshot | null>(null);
  const briefingSelectionRef = useRef<BriefingSelectionTarget | null>(null);
  const briefingCancelReasonRef = useRef<'manual' | 'user' | 'new' | null>(null);
  const briefingEarthquakesRef = useRef<EarthquakeRecord[]>([]);
  const briefingEarthquakeSnapshotRef = useRef<DataSnapshot<EarthquakeFeed> | null>(null);
  const briefingExpectedEarthquakeWindowRef = useRef<EarthquakeTimeWindow | null>(null);
  const briefingNaturalEventsRef = useRef<NaturalEventRecord[]>([]);
  const briefingOrbitSnapshotRef = useRef<DataSnapshot<OrbitCatalog> | null>(null);
  const briefingTelemetryRef = useRef<SatelliteTelemetry | null>(null);
  const toastIdRef = useRef(0);
  const [appState, dispatch] = useReducer(reduceAppState, initialAppStateRef.current);
  const [ready, setReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [pointOfView, setPointOfView] = useState<GlobePointOfView>(initialShareRef.current?.pointOfView ?? INITIAL_POV);
  const [metrics, setMetrics] = useState<GlobeEngineMetrics | null>(null);
  const [quality, setQuality] = useState<GlobeViewportQuality>({ level: 'medium', mode: 'auto' });
  const [accessibilityPreferences, setAccessibilityPreferences] = useState(() => loadAccessibilityPreferences());
  const [systemAccessibility, setSystemAccessibility] = useState<SystemAccessibilityPreferences>(() => detectSystemAccessibilityPreferences());
  const [deviceCapabilities, setDeviceCapabilities] = useState(() => detectDeviceCapabilities());
  const [entityRegistry, setEntityRegistry] = useState<Map<string, SignalEntity>>(() => new Map());
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCountries, setSearchCountries] = useState<SearchCountry[]>([]);
  const [pendingSearchIntent, setPendingSearchIntent] = useState<{ mode: 'navigate' | 'follow'; query: string } | null>(null);
  const [pendingSatelliteAction, setPendingSatelliteAction] = useState<{ id: EntityId; mode: 'focus' | 'follow' } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hereOpen, setHereOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [briefingLauncherOpen, setBriefingLauncherOpen] = useState(false);
  const [tourState, setTourState] = useState<TourState>(() => ({ ...tourEngineRef.current.state }));
  const [recording, setRecording] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [earthquakeWindow, setEarthquakeWindow] = useState<EarthquakeTimeWindow>(initialShareRef.current?.earthquakeWindow ?? 'day');
  const [earthquakeMagnitude, setEarthquakeMagnitude] = useState(initialShareRef.current?.earthquakeMagnitude ?? 2.5);
  const [earthquakeSnapshot, setEarthquakeSnapshot] = useState<DataSnapshot<EarthquakeFeed> | null>(null);
  const [earthquakeLoading, setEarthquakeLoading] = useState(false);
  const [earthquakeError, setEarthquakeError] = useState<string | null>(null);
  const [earthquakeRefresh, setEarthquakeRefresh] = useState({ seq: 0, force: false });

  const [naturalEventSnapshot, setNaturalEventSnapshot] = useState<DataSnapshot<NaturalEventFeed> | null>(null);
  const [naturalEventLoading, setNaturalEventLoading] = useState(false);
  const [naturalEventError, setNaturalEventError] = useState<string | null>(null);
  const [naturalEventRefresh, setNaturalEventRefresh] = useState({ seq: 0, force: false });
  const [activeNaturalEventCategories, setActiveNaturalEventCategories] = useState<Record<NaturalEventCategory, boolean>>(initialShareRef.current?.naturalEventCategories ?? {
    'severe-storm': true, wildfire: true, volcano: true,
  });

  const [orbitSnapshot, setOrbitSnapshot] = useState<DataSnapshot<OrbitCatalog> | null>(null);
  const [orbitLoading, setOrbitLoading] = useState(false);
  const [orbitError, setOrbitError] = useState<string | null>(null);
  const [orbitStats, setOrbitStats] = useState({ validCount: 0, errorCount: 0, workerLoaded: 0, workerRejected: 0 });
  const [selectedSatelliteTelemetry, setSelectedSatelliteTelemetry] = useState<SatelliteTelemetry | null>(null);
  const [activeOrbitCategories, setActiveOrbitCategories] = useState<Record<SatelliteCategory, boolean>>(initialShareRef.current?.orbitCategories ?? {
    stations: true, weather: true, 'earth-observation': true, navigation: true, science: true, communications: false,
  });
  const [orbitScaleMode, setOrbitScaleMode] = useState<OrbitScaleMode>(initialShareRef.current?.orbitScaleMode ?? 'true');
  const [showOrbitPath, setShowOrbitPath] = useState(initialShareRef.current?.showOrbitPath ?? true);
  const [showGroundTrack, setShowGroundTrack] = useState(initialShareRef.current?.showGroundTrack ?? true);
  const [orbitTrailMode, setOrbitTrailMode] = useState<OrbitTrailMode>(initialShareRef.current?.orbitTrailMode ?? 'off');
  const [orbitCameraMode, setOrbitCameraMode] = useState<OrbitCameraMode>('none');

  const [spaceWeatherSnapshot, setSpaceWeatherSnapshot] = useState<DataSnapshot<SpaceWeatherFeed> | null>(null);
  const [spaceWeatherLoading, setSpaceWeatherLoading] = useState(false);
  const [spaceWeatherError, setSpaceWeatherError] = useState<string | null>(null);
  const [spaceWeatherRefresh, setSpaceWeatherRefresh] = useState({ seq: 0, force: false });
  const [auroraHemispheres, setAuroraHemispheres] = useState<AuroraHemispheres>(initialShareRef.current?.auroraHemispheres ?? { north: true, south: true });

  const [observerLocation, setObserverLocation] = useState<ObserverLocation | null>(() => loadSavedObserverLocation());
  const [rememberLocation, setRememberLocation] = useState(() => loadSavedObserverLocation() !== null);
  const [geolocationState, setGeolocationState] = useState<GeolocationState>(() => loadSavedObserverLocation() ? 'ready' : 'idle');
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState<DataSnapshot<LocalWeather> | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherRefresh, setWeatherRefresh] = useState({ seq: 0, force: false });
  const [observerSky, setObserverSky] = useState<ObserverSkySnapshot | null>(null);
  const [observerPassForecast, setObserverPassForecast] = useState<ObserverPassForecast | null>(null);
  const [observerPassAnchor, setObserverPassAnchor] = useState(() => timeEngineRef.current.currentTime);

  const reducedMotion = effectiveReducedMotion(accessibilityPreferences, systemAccessibility);
  const highContrast = effectiveHighContrast(accessibilityPreferences, systemAccessibility);

  useEffect(() => subscribeSystemAccessibilityPreferences(setSystemAccessibility), []);

  useEffect(() => {
    saveAccessibilityPreferences(accessibilityPreferences);
    document.documentElement.classList.toggle('se-reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('se-high-contrast', highContrast);
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
    return () => {
      document.documentElement.classList.remove('se-reduced-motion', 'se-high-contrast');
      delete document.documentElement.dataset.motion;
      delete document.documentElement.dataset.contrast;
    };
  }, [accessibilityPreferences, reducedMotion, highContrast]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setDeviceCapabilities(detectDeviceCapabilities()));
    };
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => actionBusRef.current.subscribe((action) => {
    if (action.type === 'SET_TIME') {
      timeEngineRef.current.setTime(action.timestamp);
    } else if (action.type === 'SET_TIME_SPEED') {
      timeEngineRef.current.setSpeed(action.speed);
    } else if (action.type === 'RETURN_LIVE') {
      timeEngineRef.current.returnLive();
    }

    dispatch(action);

    if (action.type === 'SET_TIME' || action.type === 'SET_TIME_SPEED' || action.type === 'RETURN_LIVE') {
      dispatch({ type: 'SYNC_CLOCK', clock: timeEngineRef.current.snapshot() });
    }
  }), []);

  const emit = useCallback((action: AppAction) => {
    actionBusRef.current.dispatch(action);
  }, []);

  useEffect(() => {
    const shared = initialShareRef.current;
    if (!shared?.clock) {
      dispatch({ type: 'SYNC_CLOCK', clock: timeEngineRef.current.snapshot() });
      return;
    }
    if (shared.clock.mode === 'live') {
      timeEngineRef.current.returnLive();
    } else {
      timeEngineRef.current.setTime(shared.clock.simulationTime);
      timeEngineRef.current.setSpeed(shared.clock.isPlaying ? shared.clock.speed : 0);
    }
    dispatch({ type: 'SYNC_CLOCK', clock: timeEngineRef.current.snapshot() });
  }, []);

  useEffect(() => {
    const shared = initialShareRef.current;
    if (!ready || sharedPointOfViewAppliedRef.current || !shared?.pointOfView) return;
    sharedPointOfViewAppliedRef.current = true;
    viewportRef.current?.flyToPointOfView(shared.pointOfView, 0);
  }, [ready]);

  useEffect(() => {
    const target = pendingSharedTargetRef.current;
    if (!target) return;
    let entity = entityRegistry.get(String(target));
    if (!entity && String(target).startsWith('location:')) {
      const match = String(target).match(/^location:([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)$/);
      if (match) {
        const lat = Number(match[1]);
        const lon = Number(match[2]);
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          entity = makeLocationEntity(lat, lon, 'Shared location');
          setEntityRegistry((current) => new Map(current).set(entity!.id, entity!));
        }
      }
    }
    if (!entity) return;
    pendingSharedTargetRef.current = null;
    emit({ type: 'SELECT_ENTITY', entityId: target });
  }, [emit, entityRegistry]);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => setOfflineReady(false));
      if (navigator.serviceWorker.controller) setOfflineReady(true);
    }
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => tourEngineRef.current.subscribe((state) => setTourState({ ...state })), []);

  useEffect(() => {
    const active = tourState.status === 'running';
    const selectors = ['.top-bar', '.desktop-left', '.desktop-right', '.desktop-timeline', '.desktop-settings', '.desktop-here', '.mobile-dock'];
    const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
    for (const node of nodes) node.inert = active;
    return () => { for (const node of nodes) node.inert = false; };
  }, [tourState.status]);

  const pushToast = useCallback((title: string, detail?: string, tone: ToastMessage['tone'] = 'info') => {
    const id = ++toastIdRef.current;
    const message: ToastMessage = detail === undefined ? { id, title, tone } : { id, title, detail, tone };
    setToasts((current) => [...current.slice(-2), message]);
    window.setTimeout(() => setToasts((current) => current.filter((message) => message.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSearchCountries(controller.signal).then(setSearchCountries).catch(() => {
      // Country navigation is optional context. Search remains fully usable without it.
      setSearchCountries([]);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!appState.layers.earthquakes) return undefined;
    const controller = new AbortController();
    let active = true;
    setEarthquakeLoading(true);
    setEarthquakeError(null);

    earthquakeServiceRef.current.load(earthquakeWindow, {
      signal: controller.signal,
      forceRefresh: earthquakeRefresh.force,
    }).then((snapshot) => {
      if (!active) return;
      setEarthquakeSnapshot(snapshot);
      setEarthquakeLoading(false);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'usgs', status: snapshot.freshness });

      setEntityRegistry((current) => {
        const next = new Map(current);
        for (const key of next.keys()) {
          if (key.startsWith('earthquake:')) next.delete(key);
        }
        for (const earthquake of snapshot.data.earthquakes) {
          const entity = earthquakeToSignalEntity(earthquake);
          next.set(entity.id, entity);
        }
        return next;
      });

      if (snapshot.freshness === 'stale') {
        setEarthquakeError('USGS is temporarily unreachable. Showing the latest cached feed.');
        pushToast('USGS feed is stale', 'Signal Earth is showing the most recent cached earthquake snapshot.', 'warning');
      }
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'USGS earthquake feed is unavailable.';
      setEarthquakeLoading(false);
      setEarthquakeError(message);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'usgs', status: 'unavailable' });
      pushToast('Earthquake feed unavailable', message, 'warning');
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [appState.layers.earthquakes, earthquakeRefresh, earthquakeWindow, emit, pushToast]);

  useEffect(() => {
    const controller = new AbortController();
    loadSearchCountries(controller.signal).then(setSearchCountries).catch(() => {
      // Country navigation is optional context. Search remains fully usable without it.
      setSearchCountries([]);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!appState.layers.events) return undefined;
    const controller = new AbortController();
    let active = true;
    setNaturalEventLoading(true);
    setNaturalEventError(null);

    naturalEventServiceRef.current.load({ signal: controller.signal, forceRefresh: naturalEventRefresh.force }).then((snapshot) => {
      if (!active) return;
      setNaturalEventSnapshot(snapshot);
      setNaturalEventLoading(false);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'eonet', status: snapshot.freshness });
      setEntityRegistry((current) => {
        const next = new Map(current);
        for (const key of next.keys()) if (key.startsWith('event:')) next.delete(key);
        for (const event of snapshot.data.events) {
          const entity = naturalEventToSignalEntity(event);
          next.set(entity.id, entity);
        }
        return next;
      });
      if (snapshot.freshness === 'stale') {
        setNaturalEventError('NASA EONET is temporarily unreachable. Showing the latest cached natural-event snapshot.');
        pushToast('NASA EONET data is stale', 'Signal Earth is showing cached natural-event observations.', 'warning');
      }
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'NASA EONET natural-event feed is unavailable.';
      setNaturalEventLoading(false);
      setNaturalEventError(message);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'eonet', status: 'unavailable' });
      pushToast('Natural-event feed unavailable', message, 'warning');
    });

    return () => { active = false; controller.abort(); };
  }, [appState.layers.events, naturalEventRefresh, emit, pushToast]);

  useEffect(() => {
    if (!appState.layers.orbit && !observerLocation) return undefined;
    const controller = new AbortController();
    let active = true;
    setOrbitLoading(true);
    setOrbitError(null);

    celestrakServiceRef.current.load({ signal: controller.signal }).then((snapshot) => {
      if (!active) return;
      setOrbitSnapshot(snapshot);
      setOrbitLoading(false);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'celestrak', status: snapshot.freshness });
      setEntityRegistry((current) => {
        const next = new Map(current);
        for (const key of next.keys()) if (key.startsWith('satellite:')) next.delete(key);
        for (const satellite of snapshot.data.satellites) {
          const entity = satelliteToSignalEntity(satellite);
          next.set(entity.id, entity);
        }
        return next;
      });
      if (snapshot.freshness === 'stale') setOrbitError('CelesTrak is temporarily unreachable. Showing cached orbital elements.');
      else setOrbitError(null);
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'CelesTrak orbital data is unavailable.';
      setOrbitLoading(false);
      setOrbitError(message);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'celestrak', status: 'unavailable' });
      pushToast('Orbit data unavailable', message, 'warning');
    });

    return () => { active = false; controller.abort(); };
  }, [appState.layers.orbit, observerLocation, emit, pushToast]);

  useEffect(() => {
    if (!appState.layers.aurora && !observerLocation) return undefined;
    const controller = new AbortController();
    let active = true;
    setSpaceWeatherLoading(true);
    setSpaceWeatherError(null);

    spaceWeatherServiceRef.current.load({ signal: controller.signal, forceRefresh: spaceWeatherRefresh.force }).then((snapshot) => {
      if (!active) return;
      setSpaceWeatherSnapshot(snapshot);
      setSpaceWeatherLoading(false);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'swpc', status: snapshot.freshness });
      if (snapshot.freshness === 'stale') {
        setSpaceWeatherError('NOAA SWPC is temporarily unreachable. Showing the latest cached space-weather snapshot.');
        pushToast('Space-weather data is stale', 'Signal Earth is showing cached NOAA SWPC products.', 'warning');
      } else if (snapshot.data.partial) {
        setSpaceWeatherError(`NOAA SWPC partial data: ${snapshot.data.unavailableSources.join(', ')}`);
      } else setSpaceWeatherError(null);
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'NOAA SWPC space-weather products are unavailable.';
      setSpaceWeatherLoading(false);
      setSpaceWeatherError(message);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'swpc', status: 'unavailable' });
      pushToast('Space-weather data unavailable', message, 'warning');
    });

    return () => { active = false; controller.abort(); };
  }, [appState.layers.aurora, observerLocation, spaceWeatherRefresh, emit, pushToast]);

  useEffect(() => {
    if (!observerLocation) return undefined;
    const controller = new AbortController();
    let active = true;
    setWeatherLoading(true);
    setWeatherError(null);
    localWeatherServiceRef.current.load(observerLocation.lat, observerLocation.lon, { signal: controller.signal, forceRefresh: weatherRefresh.force }).then((snapshot) => {
      if (!active) return;
      setWeatherSnapshot(snapshot);
      setWeatherLoading(false);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'openmeteo', status: snapshot.freshness });
      if (snapshot.freshness === 'stale') setWeatherError('Open-Meteo is temporarily unreachable. Showing cached current conditions.');
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Local weather is unavailable.';
      setWeatherLoading(false); setWeatherError(message);
      emit({ type: 'SET_PROVIDER_STATUS', provider: 'openmeteo', status: 'unavailable' });
    });
    return () => { active = false; controller.abort(); };
  }, [observerLocation, weatherRefresh, emit]);

  useVisibilityAwareInterval(() => setEarthquakeRefresh((current) => ({ seq: current.seq + 1, force: false })), USGS_FEED_POLICY[earthquakeWindow].ttlMs, appState.layers.earthquakes, { runOnVisible: true });
  useVisibilityAwareInterval(() => setNaturalEventRefresh((current) => ({ seq: current.seq + 1, force: false })), EONET_CACHE_POLICY.ttlMs, appState.layers.events, { runOnVisible: true });
  useVisibilityAwareInterval(() => setSpaceWeatherRefresh((current) => ({ seq: current.seq + 1, force: false })), SWPC_CACHE_POLICY.ttlMs, appState.layers.aurora || Boolean(observerLocation), { runOnVisible: true });
  useVisibilityAwareInterval(() => setWeatherRefresh((current) => ({ seq: current.seq + 1, force: false })), OPEN_METEO_CACHE_POLICY.ttlMs, Boolean(observerLocation), { runOnVisible: true });

  const earthquakes = earthquakeSnapshot?.data.earthquakes ?? [];
  const naturalEvents = naturalEventSnapshot?.data.events ?? [];
  const simulationTime = appState.clock?.simulationTime ?? timeEngineRef.current.currentTime;

  // Pass prediction is expensive enough that it should not recompute at render-clock cadence.
  // Re-anchor automatically on explicit paused seeks and when returning to LIVE; accelerated
  // playback keeps the last forecast until the user refreshes or reopens Above Me.
  useEffect(() => {
    if (!observerLocation || appState.clock?.isPlaying !== false) return;
    setObserverPassAnchor(simulationTime);
  }, [appState.clock?.isPlaying, observerLocation, simulationTime]);

  useEffect(() => {
    if (!observerLocation || appState.clock?.mode !== 'live') return;
    setObserverPassAnchor(timeEngineRef.current.currentTime);
  }, [appState.clock?.mode, observerLocation]);
  const magnitudeFilteredEarthquakes = useMemo(
    () => filterEarthquakesByMagnitude(earthquakes, earthquakeMagnitude),
    [earthquakeMagnitude, earthquakes],
  );
  const visibleEarthquakes = useMemo(
    () => filterEarthquakesAtSimulationTime(magnitudeFilteredEarthquakes, simulationTime),
    [magnitudeFilteredEarthquakes, simulationTime],
  );
  const categoryFilteredNaturalEvents = useMemo(
    () => filterNaturalEventsByCategories(naturalEvents, activeNaturalEventCategories),
    [activeNaturalEventCategories, naturalEvents],
  );
  const visibleNaturalEvents = useMemo(
    () => filterNaturalEventsAtTime(categoryFilteredNaturalEvents, simulationTime),
    [categoryFilteredNaturalEvents, simulationTime],
  );

  // Briefing execution is asynchronous; keep current live datasets in refs so a
  // running tour can observe provider updates without depending on a stale React closure.
  briefingEarthquakesRef.current = visibleEarthquakes;
  briefingEarthquakeSnapshotRef.current = earthquakeSnapshot;
  briefingNaturalEventsRef.current = visibleNaturalEvents;
  briefingOrbitSnapshotRef.current = orbitSnapshot;
  briefingTelemetryRef.current = selectedSatelliteTelemetry;

  const earthquakeById = useMemo(() => new Map(earthquakes.map((earthquake) => [earthquake.id, earthquake])), [earthquakes]);
  const naturalEventById = useMemo(() => new Map(naturalEvents.map((event) => [event.id, event])), [naturalEvents]);

  const selectedEntity = useMemo(() => {
    const id = appState.selection.selectedId;
    return id ? entityRegistry.get(id) ?? null : null;
  }, [appState.selection.selectedId, entityRegistry]);

  const selectedEarthquake = useMemo(() => {
    const id = appState.selection.selectedId;
    return id ? earthquakeById.get(id) ?? null : null;
  }, [appState.selection.selectedId, earthquakeById]);
  const selectedNaturalEvent = useMemo(() => {
    const id = appState.selection.selectedId;
    return id ? naturalEventById.get(id) ?? null : null;
  }, [appState.selection.selectedId, naturalEventById]);

  const satelliteById = useMemo(() => new Map((orbitSnapshot?.data.satellites ?? []).map((satellite) => [satellite.id, satellite])), [orbitSnapshot]);
  const selectedSatellite = useMemo(() => {
    const id = appState.selection.selectedId;
    return id ? satelliteById.get(id) ?? null : null;
  }, [appState.selection.selectedId, satelliteById]);


  const searchIndex = useMemo(() => buildSearchDocuments({
    earthquakes: visibleEarthquakes,
    naturalEvents: visibleNaturalEvents,
    satellites: orbitSnapshot?.data.satellites ?? [],
    countries: searchCountries,
  }), [visibleEarthquakes, visibleNaturalEvents, orbitSnapshot, searchCountries]);

  const observerSolarEventBucket = Math.floor(simulationTime / (15 * 60_000));
  const observerSolarEvents = useMemo(
    () => observerLocation ? nextSolarEvents(observerLocation.lat, observerLocation.lon, observerSolarEventBucket * 15 * 60_000) : null,
    [observerLocation, observerSolarEventBucket],
  );
  const aboveMeAstronomy = useMemo(
    () => observerLocation ? observerAstronomy(observerLocation.lat, observerLocation.lon, simulationTime, observerSolarEvents ?? undefined) : null,
    [observerLocation, observerSolarEvents, simulationTime],
  );
  const auroraApplicableAtObserver = Boolean(spaceWeatherSnapshot?.data.aurora && isAuroraModelApplicable(spaceWeatherSnapshot.data.aurora, simulationTime));
  const auroraValueAtObserver = useMemo(
    () => observerLocation && auroraApplicableAtObserver ? auroraModelValueAt(spaceWeatherSnapshot?.data.aurora ?? null, observerLocation.lat, observerLocation.lon) : null,
    [auroraApplicableAtObserver, observerLocation, spaceWeatherSnapshot],
  );

  useEffect(() => {
    const id = appState.selection.selectedId;
    if (!id || !String(id).startsWith('earthquake:')) return;
    const earthquake = earthquakeById.get(id);
    if (!earthquake || earthquake.time > simulationTime) {
      emit({ type: 'CLEAR_SELECTION' });
      if (mobileSheet === 'inspector') setMobileSheet(null);
    }
  }, [appState.selection.selectedId, earthquakeById, emit, mobileSheet, simulationTime]);

  useEffect(() => {
    const id = appState.selection.selectedId;
    if (!id || !String(id).startsWith('event:')) return;
    const event = naturalEventById.get(id);
    const categoryVisible = event ? activeNaturalEventCategories[event.category] : false;
    if (!appState.layers.events || !event || !categoryVisible || !geometryFrameAt(event, simulationTime)) {
      emit({ type: 'CLEAR_SELECTION' });
      if (mobileSheet === 'inspector') setMobileSheet(null);
    }
  }, [activeNaturalEventCategories, appState.layers.events, appState.selection.selectedId, emit, mobileSheet, naturalEventById, simulationTime]);

  useEffect(() => {
    const id = appState.selection.selectedId;
    if (!id || !String(id).startsWith('satellite:')) return;
    const satellite = satelliteById.get(id);
    const categoryVisible = satellite?.categories.some((category) => activeOrbitCategories[category]) ?? false;
    if (!appState.layers.orbit || !satellite || !categoryVisible) {
      setSelectedSatelliteTelemetry(null);
      emit({ type: 'CLEAR_SELECTION' });
      if (mobileSheet === 'inspector') setMobileSheet(null);
    }
  }, [activeOrbitCategories, appState.layers.orbit, appState.selection.selectedId, emit, mobileSheet, satelliteById]);


  useEffect(() => {
    if (!pendingSatelliteAction || selectedSatelliteTelemetry?.id !== pendingSatelliteAction.id) return;
    if (pendingSatelliteAction.mode === 'focus') {
      viewportRef.current?.focusCoordinates({ lat: selectedSatelliteTelemetry.lat, lon: selectedSatelliteTelemetry.lon }, 1.15);
      emit({ type: 'FOCUS_ENTITY', entityId: pendingSatelliteAction.id });
      setPendingSatelliteAction(null);
      return;
    }
    const started = viewportRef.current?.followSelectedSatellite() ?? false;
    if (started) {
      setOrbitCameraMode('follow');
      emit({ type: 'FOLLOW_ENTITY', entityId: pendingSatelliteAction.id });
      setPendingSatelliteAction(null);
    }
  }, [emit, pendingSatelliteAction, selectedSatelliteTelemetry]);

  const syncClock = useCallback(() => {
    emit({ type: 'SYNC_CLOCK', clock: timeEngineRef.current.snapshot() });
  }, [emit]);

  useVisibilityAwareInterval(syncClock, 250, true, { runImmediately: true, runOnVisible: true });

  const resetGlobe = useCallback(() => {
    if (tourEngineRef.current.active) {
      briefingCancelReasonRef.current = 'user';
      tourEngineRef.current.cancel();
      return;
    }
    viewportRef.current?.frameEarth();
    setOrbitCameraMode('none');
    emit({ type: 'CLEAR_SELECTION' });
    setMobileSheet(null);
    setHereOpen(false);
  }, [emit]);

  const handleGlobeClick = useCallback(({ lat, lon }: { lat: number; lon: number }) => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    const entity = makeLocationEntity(lat, lon);
    setEntityRegistry((current) => {
      const next = new Map(current);
      next.set(entity.id, entity);
      return next;
    });
    emit({ type: 'SELECT_ENTITY', entityId: entity.id });
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
  }, [emit]);

  const handleEarthquakeClick = useCallback((earthquake: EarthquakeRecord) => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    emit({ type: 'SELECT_ENTITY', entityId: earthquake.id });
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
  }, [emit]);

  const handleNaturalEventClick = useCallback((event: NaturalEventRecord) => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    emit({ type: 'SELECT_ENTITY', entityId: event.id });
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
  }, [emit]);

  const handleSatelliteClick = useCallback((satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    setSelectedSatelliteTelemetry(telemetry);
    emit({ type: 'SELECT_ENTITY', entityId: satellite.id });
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
  }, [emit]);

  const requestObserverLocation = useCallback(async () => {
    setGeolocationState('requesting');
    setGeolocationError(null);
    try {
      const location = await requestBrowserLocation();
      setObserverLocation(location);
      setGeolocationState('ready');
      setObserverPassAnchor(timeEngineRef.current.currentTime);
      if (rememberLocation) saveObserverLocation(location);
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setGeolocationState(denied ? 'denied' : 'error');
      setGeolocationError(error instanceof Error ? error.message : 'Location request failed.');
    }
  }, [rememberLocation]);

  const setRememberObserver = useCallback((value: boolean) => {
    setRememberLocation(value);
    if (value && observerLocation) saveObserverLocation(observerLocation);
    else if (!value) clearSavedObserverLocation();
  }, [observerLocation]);

  const forgetObserver = useCallback(() => {
    clearSavedObserverLocation();
    setRememberLocation(false);
    setObserverLocation(null);
    setObserverSky(null);
    setObserverPassForecast(null);
    setWeatherSnapshot(null);
    setWeatherError(null);
    setGeolocationError(null);
    setGeolocationState('idle');
  }, []);

  const focusObserverLocation = useCallback(() => {
    if (!observerLocation) return;
    viewportRef.current?.focusCoordinates(observerLocation, 0.7);
  }, [observerLocation]);

  const handleAboveMeSatelliteSelect = useCallback((id: EntityId) => {
    const satellite = satelliteById.get(id);
    if (!satellite) return;
    setSelectedSatelliteTelemetry(null);
    const firstCategory = satellite.categories.find((category) => ORBIT_CATEGORIES.includes(category));
    if (firstCategory && !activeOrbitCategories[firstCategory]) setActiveOrbitCategories((current) => ({ ...current, [firstCategory]: true }));
    if (!appState.layers.orbit) emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
    emit({ type: 'SELECT_ENTITY', entityId: id });
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
    else setHereOpen(false);
  }, [activeOrbitCategories, appState.layers.orbit, emit, satelliteById]);

  const openHere = useCallback(() => {
    setObserverPassAnchor(timeEngineRef.current.currentTime);
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      setHereOpen(false);
      setMobileSheet('here');
    } else {
      setSettingsOpen(false);
      setHereOpen((value) => !value);
    }
  }, []);

  const focusSelection = useCallback(() => {
    if (!selectedEntity) return;
    if (selectedEntity.kind === 'satellite' && selectedSatelliteTelemetry) {
      setOrbitCameraMode('none');
      viewportRef.current?.focusCoordinates({ lat: selectedSatelliteTelemetry.lat, lon: selectedSatelliteTelemetry.lon }, 1.15);
      emit({ type: 'FOCUS_ENTITY', entityId: selectedEntity.id });
      return;
    }
    if (selectedEntity.kind === 'natural-event' && selectedNaturalEvent) {
      const frame = geometryFrameAt(selectedNaturalEvent, simulationTime);
      if (!frame) return;
      viewportRef.current?.focusCoordinates(frame.point, 0.78);
      emit({ type: 'FOCUS_ENTITY', entityId: selectedEntity.id });
      return;
    }
    if (!selectedEntity.coordinates) return;
    const altitude = selectedEntity.kind === 'earthquake' ? 0.72 : 0.62;
    viewportRef.current?.focusCoordinates(selectedEntity.coordinates, altitude);
    emit({ type: 'FOCUS_ENTITY', entityId: selectedEntity.id });
  }, [emit, selectedEntity, selectedNaturalEvent, selectedSatelliteTelemetry, simulationTime]);

  const clearSelection = useCallback(() => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    setSelectedSatelliteTelemetry(null);
    emit({ type: 'CLEAR_SELECTION' });
    if (mobileSheet === 'inspector') setMobileSheet(null);
  }, [emit, mobileSheet]);

  const followSelectedSatellite = useCallback(() => {
    if (!selectedSatellite) return;
    if (orbitCameraMode === 'follow') {
      viewportRef.current?.stopOrbitCamera();
      setOrbitCameraMode('none');
      emit({ type: 'SELECT_ENTITY', entityId: selectedSatellite.id });
      return;
    }
    const started = viewportRef.current?.followSelectedSatellite() ?? false;
    if (!started) {
      pushToast('Satellite position unavailable', 'Wait for the next propagated orbit frame and try again.', 'warning');
      return;
    }
    setOrbitCameraMode('follow');
    emit({ type: 'FOLLOW_ENTITY', entityId: selectedSatellite.id });
  }, [emit, orbitCameraMode, pushToast, selectedSatellite]);

  const frameSelectedOrbit = useCallback(() => {
    if (!selectedSatellite) return;
    const started = viewportRef.current?.frameSelectedOrbit() ?? false;
    if (!started) {
      pushToast('Orbit path is still calculating', 'The orbital-plane view becomes available as soon as the selected track is ready.', 'info');
      return;
    }
    setOrbitCameraMode('orbit');
    emit({ type: 'FOCUS_ENTITY', entityId: selectedSatellite.id });
  }, [emit, pushToast, selectedSatellite]);

  const stopOrbitCamera = useCallback(() => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    if (selectedSatellite) emit({ type: 'SELECT_ENTITY', entityId: selectedSatellite.id });
  }, [emit, selectedSatellite]);

  const handleCameraState = useCallback((state: { mode: string }) => {
    if (state.mode === 'following') setOrbitCameraMode('follow');
    else if (state.mode === 'free') {
      setOrbitCameraMode('none');
      if (selectedSatellite && appState.selection.mode === 'follow') emit({ type: 'SELECT_ENTITY', entityId: selectedSatellite.id });
    }
  }, [appState.selection.mode, emit, selectedSatellite]);

  const toggleLayer = useCallback((layer: LayerId, enabled: boolean) => {
    emit({ type: enabled ? 'ENABLE_LAYER' : 'DISABLE_LAYER', layer });
  }, [emit]);

  const setVisualMode = useCallback((mode: VisualMode) => {
    emit({ type: 'SET_VISUAL_MODE', mode });
  }, [emit]);

  const setTimelineOffset = useCallback((hours: number) => {
    if (Math.abs(hours) < 0.01) {
      emit({ type: 'RETURN_LIVE' });
      return;
    }

    // Scrubbing is an explicit seek operation. Freeze at the selected moment
    // so the thumb does not drift underneath the user while they are seeking.
    emit({ type: 'SET_TIME_SPEED', speed: 0 });
    const realTime = timeEngineRef.current.snapshot().realTime;
    emit({ type: 'SET_TIME', timestamp: realTime + hours * 3_600_000 });
  }, [emit]);

  const toggleTimePlayback = useCallback(() => {
    const snapshot = timeEngineRef.current.snapshot();
    emit({ type: 'SET_TIME_SPEED', speed: snapshot.isPlaying ? 0 : 1 });
  }, [emit]);

  const setTimeSpeed = useCallback((speed: SimulationSpeed) => {
    emit({ type: 'SET_TIME_SPEED', speed });
  }, [emit]);

  const returnLive = useCallback(() => {
    emit({ type: 'RETURN_LIVE' });
  }, [emit]);

  const executeBriefingInstruction = useCallback(async (instruction: BriefingInstruction, signal: AbortSignal) => {
    if (signal.aborted) return;
    switch (instruction.type) {
      case 'frame-earth': {
        viewportRef.current?.flyToPointOfView({
          lat: instruction.lat ?? 18,
          lng: instruction.lng ?? 8,
          altitude: instruction.altitude ?? 2.35,
        }, instruction.durationMs ?? 1_100);
        setOrbitCameraMode('none');
        break;
      }
      case 'set-visual-mode':
        emit({ type: 'SET_VISUAL_MODE', mode: instruction.mode });
        break;
      case 'set-layer':
        emit({ type: instruction.enabled ? 'ENABLE_LAYER' : 'DISABLE_LAYER', layer: instruction.layer });
        break;
      case 'set-orbit-categories': {
        const enabled = new Set(instruction.categories);
        setActiveOrbitCategories((current) => {
          const next = { ...current };
          for (const category of ORBIT_CATEGORIES) next[category] = enabled.has(category);
          return next;
        });
        break;
      }
      case 'set-natural-event-categories': {
        const enabled = new Set(instruction.categories);
        setActiveNaturalEventCategories({
          'severe-storm': enabled.has('severe-storm'),
          wildfire: enabled.has('wildfire'),
          volcano: enabled.has('volcano'),
        });
        break;
      }
      case 'set-earthquake-filter':
        setEarthquakeMagnitude(instruction.magnitude);
        if (instruction.window) {
          briefingExpectedEarthquakeWindowRef.current = instruction.window;
          setEarthquakeWindow(instruction.window);
        }
        break;
      case 'clear-selection':
        briefingSelectionRef.current = null;
        setSelectedSatelliteTelemetry(null);
        emit({ type: 'CLEAR_SELECTION' });
        break;
      case 'select-strongest-earthquake': {
        emit({ type: 'ENABLE_LAYER', layer: 'earthquakes' });
        const snapshot = await waitForValue(() => {
          const candidate = briefingEarthquakeSnapshotRef.current;
          const expected = briefingExpectedEarthquakeWindowRef.current;
          return candidate && (!expected || candidate.data.window === expected) ? candidate : null;
        }, signal, 7_000);
        const records = snapshot ? filterEarthquakesAtSimulationTime(snapshot.data.earthquakes, timeEngineRef.current.currentTime).filter((item) => item.magnitude >= 2.5) : briefingEarthquakesRef.current;
        const strongest = records?.reduce<EarthquakeRecord | null>((best, item) => !best || item.magnitude > best.magnitude ? item : best, null) ?? null;
        if (!strongest) break;
        briefingSelectionRef.current = { id: strongest.id, kind: 'earthquake', coordinates: { lat: strongest.coordinates.lat, lon: strongest.coordinates.lon } };
        emit({ type: 'SELECT_ENTITY', entityId: strongest.id });
        break;
      }
      case 'select-featured-natural-event': {
        emit({ type: 'ENABLE_LAYER', layer: 'events' });
        const records = await waitForValue(() => briefingNaturalEventsRef.current.length ? briefingNaturalEventsRef.current : null, signal, 7_000);
        if (!records?.length) break;
        const categoryWeight: Record<NaturalEventCategory, number> = { 'severe-storm': 3, volcano: 2, wildfire: 1 };
        const featured = [...records].sort((a, b) => {
          const aScore = categoryWeight[a.category] * 1_000_000 + a.geometry.length * 10_000 + a.updatedAt / 1e9;
          const bScore = categoryWeight[b.category] * 1_000_000 + b.geometry.length * 10_000 + b.updatedAt / 1e9;
          return bScore - aScore;
        })[0] ?? null;
        if (!featured) break;
        const frame = geometryFrameAt(featured, timeEngineRef.current.currentTime);
        if (!frame) break;
        briefingSelectionRef.current = { id: featured.id, kind: 'natural-event', coordinates: { ...frame.point } };
        emit({ type: 'SELECT_ENTITY', entityId: featured.id });
        break;
      }
      case 'select-satellite': {
        emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
        const categoryForTarget: Partial<Record<typeof instruction.target, SatelliteCategory>> = {
          iss: 'stations', weather: 'weather', navigation: 'navigation', 'earth-observation': 'earth-observation', science: 'science',
        };
        const requiredCategory = categoryForTarget[instruction.target];
        if (requiredCategory) setActiveOrbitCategories((current) => ({ ...current, [requiredCategory]: true }));
        const snapshot = await waitForValue(() => briefingOrbitSnapshotRef.current?.data.satellites.length ? briefingOrbitSnapshotRef.current : null, signal, 8_000);
        const satellites = snapshot?.data.satellites ?? [];
        const preferred = (satellite: SatelliteRecord): number => {
          const name = satellite.name.toUpperCase();
          if (instruction.target === 'iss') return satellite.noradId === '25544' || name.includes('ISS') ? 100 : satellite.categories.includes('stations') ? 10 : 0;
          if (instruction.target === 'weather') return /NOAA|METEOR|GOES|METOP|HIMAWARI/.test(name) ? 100 : satellite.categories.includes('weather') ? 10 : 0;
          if (instruction.target === 'navigation') return /GPS|GALILEO|GLONASS|BEIDOU/.test(name) ? 100 : satellite.categories.includes('navigation') ? 10 : 0;
          if (instruction.target === 'earth-observation') return /LANDSAT|SENTINEL|TERRA|AQUA/.test(name) ? 100 : satellite.categories.includes('earth-observation') ? 10 : 0;
          return /HST|HUBBLE|SWIFT|FERMI/.test(name) ? 100 : satellite.categories.includes('science') ? 10 : 0;
        };
        const candidate = [...satellites].map((satellite) => ({ satellite, score: preferred(satellite) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0]?.satellite ?? null;
        if (!candidate) break;
        briefingSelectionRef.current = { id: candidate.id, kind: 'satellite' };
        setSelectedSatelliteTelemetry(null);
        emit({ type: 'SELECT_ENTITY', entityId: candidate.id });
        break;
      }
      case 'focus-selection': {
        const target = briefingSelectionRef.current;
        if (!target) break;
        if (target.kind === 'satellite') {
          const telemetry = await waitForValue(() => briefingTelemetryRef.current?.id === target.id ? briefingTelemetryRef.current : null, signal, 5_000);
          if (telemetry) viewportRef.current?.focusCoordinates({ lat: telemetry.lat, lon: telemetry.lon }, 1.05);
        } else if (target.coordinates) {
          viewportRef.current?.focusCoordinates(target.coordinates, target.kind === 'earthquake' ? 0.72 : 0.8);
        }
        emit({ type: 'FOCUS_ENTITY', entityId: target.id });
        break;
      }
      case 'follow-selected-satellite': {
        const target = briefingSelectionRef.current;
        if (!target || target.kind !== 'satellite') break;
        const started = await waitForValue(() => viewportRef.current?.followSelectedSatellite() ? true : null, signal, 6_000, 120);
        if (started) {
          setOrbitCameraMode('follow');
          emit({ type: 'FOLLOW_ENTITY', entityId: target.id });
        }
        break;
      }
      case 'frame-selected-orbit': {
        const target = briefingSelectionRef.current;
        if (!target || target.kind !== 'satellite') break;
        const started = await waitForValue(() => viewportRef.current?.frameSelectedOrbit() ? true : null, signal, 6_000, 140);
        if (started) {
          setOrbitCameraMode('orbit');
          emit({ type: 'FOCUS_ENTITY', entityId: target.id });
        }
        break;
      }
      case 'set-speed':
        emit({ type: 'SET_TIME_SPEED', speed: instruction.speed });
        break;
      case 'seek-hours': {
        emit({ type: 'SET_TIME_SPEED', speed: 0 });
        const now = timeEngineRef.current.snapshot().realTime;
        emit({ type: 'SET_TIME', timestamp: now + instruction.hours * 3_600_000 });
        break;
      }
      case 'return-live':
        emit({ type: 'RETURN_LIVE' });
        break;
      case 'stop-camera':
        viewportRef.current?.stopOrbitCamera();
        setOrbitCameraMode('none');
        break;
    }
  }, [emit]);

  const executeBriefingStep = useCallback(async (step: BriefingStep, signal: AbortSignal) => {
    for (const instruction of step.instructions) {
      if (signal.aborted) return;
      await executeBriefingInstruction(instruction, signal);
    }
  }, [executeBriefingInstruction]);

  const restoreBriefingState = useCallback((snapshot: BriefingRestoreSnapshot, preserveCamera: boolean) => {
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    setActiveOrbitCategories(snapshot.activeOrbitCategories);
    setActiveNaturalEventCategories(snapshot.activeNaturalEventCategories);
    setOrbitScaleMode(snapshot.orbitScaleMode);
    setOrbitTrailMode(snapshot.orbitTrailMode);
    setShowOrbitPath(snapshot.showOrbitPath);
    setShowGroundTrack(snapshot.showGroundTrack);
    setEarthquakeMagnitude(snapshot.earthquakeMagnitude);
    setEarthquakeWindow(snapshot.earthquakeWindow);
    for (const layer of ['earthquakes', 'events', 'orbit', 'aurora'] as LayerId[]) {
      emit({ type: snapshot.layers[layer] ? 'ENABLE_LAYER' : 'DISABLE_LAYER', layer });
    }
    emit({ type: 'SET_VISUAL_MODE', mode: snapshot.visualMode });
    if (snapshot.clock.mode === 'live') {
      emit({ type: 'RETURN_LIVE' });
    } else {
      emit({ type: 'SET_TIME_SPEED', speed: 0 });
      emit({ type: 'SET_TIME', timestamp: snapshot.clock.simulationTime });
      emit({ type: 'SET_TIME_SPEED', speed: snapshot.clock.speed });
    }
    if (snapshot.selectionId) emit({ type: 'SELECT_ENTITY', entityId: snapshot.selectionId });
    else emit({ type: 'CLEAR_SELECTION' });
    if (!preserveCamera) viewportRef.current?.flyToPointOfView(snapshot.pointOfView, 850);
    briefingSelectionRef.current = null;
    briefingExpectedEarthquakeWindowRef.current = null;
  }, [emit]);

  const startBriefing = useCallback(async (id: BriefingId) => {
    if (tourEngineRef.current.active) return;
    const definition = BRIEFINGS[id];
    const restoreSnapshot: BriefingRestoreSnapshot = {
      layers: { ...appState.layers },
      visualMode: appState.visualMode,
      clock: timeEngineRef.current.snapshot(),
      selectionId: appState.selection.selectedId,
      pointOfView: { ...pointOfView },
      activeOrbitCategories: { ...activeOrbitCategories },
      activeNaturalEventCategories: { ...activeNaturalEventCategories },
      orbitScaleMode,
      orbitTrailMode,
      showOrbitPath,
      showGroundTrack,
      earthquakeMagnitude,
      earthquakeWindow,
    };
    briefingRestoreRef.current = restoreSnapshot;
    briefingCancelReasonRef.current = null;
    briefingSelectionRef.current = null;
    setBriefingLauncherOpen(false);
    setSearchOpen(false);
    setSettingsOpen(false);
    setHereOpen(false);
    setMobileSheet(null);
    emit({ type: 'START_BRIEFING', briefingId: id });

    const outcome = await tourEngineRef.current.start(definition, executeBriefingStep);
    const snapshot = briefingRestoreRef.current;
    const cancelReason = briefingCancelReasonRef.current;
    briefingRestoreRef.current = null;
    briefingCancelReasonRef.current = null;
    if (snapshot) restoreBriefingState(snapshot, cancelReason === 'manual');
    if (outcome === 'completed') pushToast(`${definition.title} complete`, 'Returned to your previous Signal Earth state.', 'success');
    else if (outcome === 'failed') pushToast('Briefing stopped', tourEngineRef.current.state.error ?? 'A cinematic step failed.', 'warning');
    window.setTimeout(() => tourEngineRef.current.reset(), 80);
  }, [activeNaturalEventCategories, activeOrbitCategories, appState.layers, appState.selection.selectedId, appState.visualMode, earthquakeMagnitude, earthquakeWindow, executeBriefingStep, orbitScaleMode, orbitTrailMode, pointOfView, pushToast, restoreBriefingState, showGroundTrack, showOrbitPath, emit]);

  const cancelBriefing = useCallback((reason: 'manual' | 'user' | 'new' = 'user') => {
    if (!tourEngineRef.current.active) return;
    briefingCancelReasonRef.current = reason;
    tourEngineRef.current.cancel();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && tourEngineRef.current.active) cancelBriefing('user');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [cancelBriefing]);

  const handleManualCameraInput = useCallback(() => {
    if (tourEngineRef.current.active) cancelBriefing('manual');
  }, [cancelBriefing]);

  const setRenderingQuality = useCallback((value: 'auto' | QualityLevel) => {
    viewportRef.current?.setQuality(value);
  }, []);

  const setMotionPreference = useCallback((motion: MotionPreference) => {
    setAccessibilityPreferences((current) => ({ ...current, motion }));
  }, []);

  const setContrastPreference = useCallback((contrast: ContrastPreference) => {
    setAccessibilityPreferences((current) => ({ ...current, contrast }));
  }, []);

  const openSettings = useCallback(() => {
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      setSettingsOpen(false);
      setMobileSheet('settings');
    } else {
      setHereOpen(false);
      setSettingsOpen((value) => !value);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      pushToast('Fullscreen unavailable', 'The browser blocked the fullscreen request.', 'warning');
    }
  }, [pushToast]);

  const shareCurrentView = useCallback(async () => {
    const shareState: ShareViewState = {
      pointOfView,
      visualMode: appState.visualMode,
      layers: appState.layers,
      clock: appState.clock,
      selectedEntityId: appState.selection.selectedId,
      earthquakeWindow,
      earthquakeMagnitude,
      orbitCategories: activeOrbitCategories,
      naturalEventCategories: activeNaturalEventCategories,
      orbitScaleMode,
      orbitTrailMode,
      showOrbitPath,
      showGroundTrack,
      auroraHemispheres,
    };
    try {
      const url = buildShareUrl(window.location.href, shareState);
      await copyTextToClipboard(url);
      pushToast('View link copied', 'Camera, layers, time and public signal settings are encoded in the URL.', 'success');
    } catch (error) {
      pushToast('Could not copy view link', error instanceof Error ? error.message : 'Clipboard access failed.', 'warning');
    }
  }, [activeNaturalEventCategories, activeOrbitCategories, appState.clock, appState.layers, appState.selection.selectedId, appState.visualMode, auroraHemispheres, earthquakeMagnitude, earthquakeWindow, orbitScaleMode, orbitTrailMode, pointOfView, pushToast, showGroundTrack, showOrbitPath]);

  const captureSnapshot = useCallback(async () => {
    try {
      const raw = await viewportRef.current?.captureImage();
      if (!raw) throw new Error('The globe renderer is not ready.');
      const capture = await composeSignalEarthCapture(raw, { timestamp: simulationTime, visualMode: appState.visualMode, pointOfView });
      downloadBlob(capture, releaseFilename('snapshot', simulationTime, 'png'));
      pushToast('Snapshot captured', 'Saved a clean Signal Earth PNG from the current globe view.', 'success');
    } catch (error) {
      pushToast('Capture unavailable', error instanceof Error ? error.message : 'The browser could not capture the WebGL canvas.', 'warning');
    }
  }, [appState.visualMode, pointOfView, pushToast, simulationTime]);

  const recordClip = useCallback(async () => {
    if (recording) return;
    const stream = viewportRef.current?.captureStream(30);
    if (!stream) {
      pushToast('Recording unavailable', 'This browser does not expose canvas recording for the globe.', 'warning');
      return;
    }
    setRecording(true);
    pushToast('Recording started', 'Capturing 10 seconds of the globe canvas.', 'info');
    try {
      const result = await recordCanvas(stream, 10_000);
      downloadBlob(result.blob, releaseFilename('recording', Date.now(), result.extension));
      pushToast('Recording saved', `Saved a 10-second ${result.extension.toUpperCase()} clip.`, 'success');
    } catch (error) {
      pushToast('Recording stopped', error instanceof Error ? error.message : 'The browser could not complete the recording.', 'warning');
    } finally {
      setRecording(false);
    }
  }, [pushToast, recording]);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') pushToast('Signal Earth installed', 'The browser accepted the install request.', 'success');
    } catch {
      setInstallPrompt(null);
      pushToast('Install unavailable', 'The browser could not open the install prompt.', 'warning');
    }
  }, [installPrompt, pushToast]);

  const executeSearchResult = useCallback((result: RankedSearchResult, mode: 'select' | 'navigate' | 'follow' = 'navigate') => {
    if (result.kind === 'city' || result.kind === 'country' || result.kind === 'location') {
      if (!result.coordinates) return;
      const entity = makeLocationEntity(result.coordinates.lat, result.coordinates.lon, result.title);
      setEntityRegistry((current) => new Map(current).set(entity.id, entity));
      emit({ type: 'SELECT_ENTITY', entityId: entity.id });
      viewportRef.current?.focusCoordinates(result.coordinates, result.kind === 'country' ? 1.15 : 0.58);
      emit({ type: 'FOCUS_ENTITY', entityId: entity.id });
      return;
    }

    if (result.kind === 'layer' && result.layer) {
      emit({ type: 'ENABLE_LAYER', layer: result.layer });
      return;
    }

    if (result.kind === 'visual-mode' && result.visualMode) {
      emit({ type: 'SET_VISUAL_MODE', mode: result.visualMode });
      return;
    }

    if (result.kind === 'satellite-category' && result.satelliteCategory) {
      emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
      setActiveOrbitCategories((current) => ({ ...current, [result.satelliteCategory!]: true }));
      return;
    }

    if (!result.entityId) return;
    if (result.kind === 'earthquake') emit({ type: 'ENABLE_LAYER', layer: 'earthquakes' });
    if (result.kind === 'natural-event') {
      emit({ type: 'ENABLE_LAYER', layer: 'events' });
      const event = naturalEventById.get(result.entityId);
      if (event) setActiveNaturalEventCategories((current) => ({ ...current, [event.category]: true }));
    }
    if (result.kind === 'satellite') {
      emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
      const satellite = satelliteById.get(result.entityId);
      const category = satellite?.categories.find((candidate) => ORBIT_CATEGORIES.includes(candidate));
      if (category) setActiveOrbitCategories((current) => ({ ...current, [category]: true }));
      setSelectedSatelliteTelemetry(null);
      if (mode === 'follow' || mode === 'navigate') setPendingSatelliteAction({ id: result.entityId, mode: mode === 'follow' ? 'follow' : 'focus' });
    }

    emit({ type: 'SELECT_ENTITY', entityId: result.entityId });
    if (result.kind !== 'satellite' && mode !== 'select') {
      const naturalRecord = result.kind === 'natural-event' ? naturalEventById.get(result.entityId) : null;
      const naturalFrame = naturalRecord ? geometryFrameAt(naturalRecord, simulationTime) : null;
      const coordinates = naturalFrame?.point ?? result.coordinates;
      if (coordinates) {
        viewportRef.current?.focusCoordinates(coordinates, result.kind === 'earthquake' ? 0.72 : 0.78);
        emit({ type: 'FOCUS_ENTITY', entityId: result.entityId });
      }
    }
    if (window.matchMedia?.('(max-width: 760px)').matches && mode === 'select') setMobileSheet('inspector');
  }, [emit, naturalEventById, satelliteById, simulationTime]);

  const executeCommand = useCallback((command: ParsedCommand) => {
    const intent = command.intent;
    if (intent.type === 'help') {
      pushToast('Command palette', 'Try: goto tokyo · follow iss · show earthquakes · mode night · speed 100x · share · capture · record · earth now · live', 'info');
      return;
    }
    if (intent.type === 'reset') { resetGlobe(); return; }
    if (intent.type === 'live') { emit({ type: 'RETURN_LIVE' }); return; }
    if (intent.type === 'pause') { emit({ type: 'SET_TIME_SPEED', speed: 0 }); return; }
    if (intent.type === 'play') { emit({ type: 'SET_TIME_SPEED', speed: 1 }); return; }
    if (intent.type === 'speed') { emit({ type: 'SET_TIME_SPEED', speed: intent.speed }); return; }
    if (intent.type === 'time-offset') { setTimelineOffset(intent.hours); return; }
    if (intent.type === 'visual-mode') { emit({ type: 'SET_VISUAL_MODE', mode: intent.mode }); return; }
    if (intent.type === 'here') { openHere(); return; }
    if (intent.type === 'share') { void shareCurrentView(); return; }
    if (intent.type === 'capture') { void captureSnapshot(); return; }
    if (intent.type === 'record') { void recordClip(); return; }
    if (intent.type === 'install') {
      if (installPrompt) void installApp();
      else pushToast('Install not offered', 'Use your browser’s install/add-to-home-screen action if available.', 'info');
      return;
    }

    if (intent.type === 'briefings') {
      if (intent.briefingId) void startBriefing(intent.briefingId);
      else setBriefingLauncherOpen(true);
      return;
    }

    if (intent.type === 'layer') {
      const layers: LayerId[] = ['earthquakes', 'events', 'orbit', 'aurora'];
      if (intent.operation === 'only') {
        for (const layer of layers) emit({ type: layer === intent.layer ? 'ENABLE_LAYER' : 'DISABLE_LAYER', layer });
      } else emit({ type: intent.operation === 'show' ? 'ENABLE_LAYER' : 'DISABLE_LAYER', layer: intent.layer });
      return;
    }

    if (intent.type === 'satellite-category') {
      emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
      if (intent.operation === 'only') {
        setActiveOrbitCategories((current) => Object.fromEntries(Object.keys(current).map((category) => [category, category === intent.category])) as Record<SatelliteCategory, boolean>);
      } else {
        setActiveOrbitCategories((current) => ({ ...current, [intent.category]: intent.operation === 'show' }));
      }
      return;
    }

    if (intent.type === 'navigate' || intent.type === 'follow' || intent.type === 'search') {
      const candidates = searchDocuments(searchIndex, intent.query, 16);
      const eligible = candidates.filter((result) => intent.type === 'follow' ? result.kind === 'satellite' : !['layer', 'visual-mode', 'satellite-category'].includes(result.kind));
      const best = eligible[0];
      if (best) {
        executeSearchResult(best, intent.type === 'follow' ? 'follow' : intent.type === 'search' ? 'select' : 'navigate');
        return;
      }
      if ((intent.type === 'follow' || /iss|satellite|gps|gnss|sentinel|landsat/i.test(intent.query)) && !orbitSnapshot) {
        setPendingSearchIntent({ mode: intent.type === 'follow' ? 'follow' : 'navigate', query: intent.query });
        emit({ type: 'ENABLE_LAYER', layer: 'orbit' });
        pushToast('Loading orbit catalog', `Signal Earth will resolve “${intent.query}” when the cached CelesTrak catalog is ready.`, 'info');
        return;
      }
      pushToast('No local match', `No loaded signal, city, country, category or command matches “${intent.query}”.`, 'warning');
    }
  }, [captureSnapshot, emit, executeSearchResult, installApp, installPrompt, openHere, orbitSnapshot, pushToast, recordClip, resetGlobe, searchIndex, setTimelineOffset, shareCurrentView, startBriefing]);

  useEffect(() => {
    if (!pendingSearchIntent || !orbitSnapshot) return;
    const result = searchDocuments(searchIndex, pendingSearchIntent.query, 16).find((candidate) => candidate.kind === 'satellite');
    if (result) executeSearchResult(result, pendingSearchIntent.mode);
    else pushToast('Satellite not found', `The loaded CelesTrak groups do not contain “${pendingSearchIntent.query}”.`, 'warning');
    setPendingSearchIntent(null);
  }, [executeSearchResult, orbitSnapshot, pendingSearchIntent, pushToast, searchIndex]);

  const handleSearchResult = useCallback((result: RankedSearchResult) => {
    executeSearchResult(result, 'navigate');
    setSearchOpen(false);
  }, [executeSearchResult]);

  const handleSearchCommand = useCallback((command: ParsedCommand) => {
    executeCommand(command);
    setSearchOpen(false);
  }, [executeCommand]);

  const earthquakePanelProps = {
    window: earthquakeWindow,
    magnitude: earthquakeMagnitude,
    visibleCount: visibleEarthquakes.length,
    totalCount: earthquakes.length,
    freshness: appState.providerStatus.usgs,
    sourceUpdatedAt: earthquakeSnapshot?.sourceUpdatedAt,
    loading: earthquakeLoading,
    error: earthquakeError,
    simulationTime,
    timeMode: appState.clock?.mode ?? 'live',
    onWindowChange: (window: EarthquakeTimeWindow) => {
      setEarthquakeWindow(window);
      setEarthquakeRefresh((current) => ({ seq: current.seq + 1, force: false }));
    },
    onMagnitudeChange: setEarthquakeMagnitude,
    onRefresh: () => setEarthquakeRefresh((current) => ({ seq: current.seq + 1, force: true })),
  };

  const emptyNaturalEventCounts: Record<NaturalEventCategory, number> = { 'severe-storm': 0, wildfire: 0, volcano: 0 };
  const naturalEventPanelProps = {
    activeCategories: activeNaturalEventCategories,
    categoryCounts: naturalEventSnapshot?.data.categoryCounts ?? emptyNaturalEventCounts,
    visibleCount: visibleNaturalEvents.length,
    totalCount: naturalEvents.length,
    freshness: appState.providerStatus.eonet,
    sourceUpdatedAt: naturalEventSnapshot?.sourceUpdatedAt,
    loading: naturalEventLoading,
    error: naturalEventError,
    partial: naturalEventSnapshot?.data.partial ?? false,
    timeMode: appState.clock?.mode ?? 'live',
    onToggleCategory: (category: NaturalEventCategory, enabled: boolean) => setActiveNaturalEventCategories((current) => ({ ...current, [category]: enabled })),
    onRefresh: () => setNaturalEventRefresh((current) => ({ seq: current.seq + 1, force: true })),
  };

  const activeOrbitCategoryList = useMemo(() => ORBIT_CATEGORIES.filter((category) => activeOrbitCategories[category]), [activeOrbitCategories]);
  const emptyOrbitCounts: Record<SatelliteCategory, number> = { stations: 0, weather: 0, 'earth-observation': 0, navigation: 0, science: 0, communications: 0 };
  const orbitPanelProps = {
    activeCategories: activeOrbitCategories,
    categoryCounts: orbitSnapshot?.data.categoryCounts ?? emptyOrbitCounts,
    totalCount: orbitSnapshot?.data.satellites.length ?? 0,
    validCount: orbitStats.validCount,
    freshness: appState.providerStatus.celestrak,
    sourceUpdatedAt: orbitSnapshot?.sourceUpdatedAt,
    loading: orbitLoading,
    error: orbitError,
    partial: orbitSnapshot?.data.partial ?? false,
    scaleMode: orbitScaleMode,
    onScaleModeChange: setOrbitScaleMode,
    onToggleCategory: (category: SatelliteCategory, enabled: boolean) => setActiveOrbitCategories((current) => ({ ...current, [category]: enabled })),
  };

  const spaceWeatherPanelProps = {
    feed: spaceWeatherSnapshot?.data ?? null,
    freshness: appState.providerStatus.swpc,
    loading: spaceWeatherLoading,
    error: spaceWeatherError,
    simulationTime,
    timeMode: appState.clock?.mode ?? 'live',
    hemispheres: auroraHemispheres,
    visualMode: appState.visualMode,
    onToggleHemisphere: (hemisphere: keyof AuroraHemispheres, enabled: boolean) => setAuroraHemispheres((current) => ({ ...current, [hemisphere]: enabled })),
    onRefresh: () => setSpaceWeatherRefresh((current) => ({ seq: current.seq + 1, force: true })),
    onNightMode: () => setVisualMode('night'),
  };

  const aboveMePanelProps = {
    location: observerLocation, geolocationState, geolocationError, rememberLocation,
    weather: weatherSnapshot, weatherLoading, weatherError, astronomy: aboveMeAstronomy,
    sky: observerSky, passForecast: observerPassForecast, orbitFreshness: appState.providerStatus.celestrak,
    simulationTime, timeMode: appState.clock?.mode ?? 'live',
    auroraValue: auroraValueAtObserver, auroraApplicable: auroraApplicableAtObserver,
    onRequestLocation: requestObserverLocation, onForgetLocation: forgetObserver, onRememberLocation: setRememberObserver,
    onRefreshWeather: () => setWeatherRefresh((current) => ({ seq: current.seq + 1, force: true })),
    onRefreshPasses: () => setObserverPassAnchor(timeEngineRef.current.currentTime),
    onFocusLocation: focusObserverLocation, onSelectSatellite: handleAboveMeSatelliteSelect,
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing && event.key !== 'Escape') return;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        if (!tourEngineRef.current.active) setSearchOpen(true);
      } else if (event.key === 'Escape') {
        if (tourEngineRef.current.active) {
          cancelBriefing('user');
          return;
        }
        setSearchOpen(false);
        setBriefingLauncherOpen(false);
        setSettingsOpen(false);
        setHereOpen(false);
        setMobileSheet(null);
      } else if (event.key.toLowerCase() === 'b' && !typing) {
        setBriefingLauncherOpen((value) => !value);
      } else if (event.code === 'Space' && !typing) {
        event.preventDefault();
        toggleTimePlayback();
      } else if (event.key.toLowerCase() === 'r' && !typing) {
        resetGlobe();
      } else if (!typing && ['1', '2', '3', '4'].includes(event.key)) {
        const modes: VisualMode[] = ['earth', 'signal', 'night', 'wireframe'];
        setVisualMode(modes[Number(event.key) - 1]!);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelBriefing, resetGlobe, setVisualMode, toggleTimePlayback]);

  return (
    <main className={`app-shell mode-${appState.visualMode}${tourState.status === 'running' ? ' briefing-active' : ''}`}>
      <div className="visual-stage">
        <GlobeViewport
          ref={viewportRef}
          visualMode={appState.visualMode}
          reducedMotion={reducedMotion}
          getSimulationTime={() => timeEngineRef.current.currentTime}
          clock={appState.clock}
          earthquakes={magnitudeFilteredEarthquakes}
          earthquakesEnabled={appState.layers.earthquakes}
          naturalEvents={categoryFilteredNaturalEvents}
          naturalEventsEnabled={appState.layers.events}
          activeNaturalEventCategories={activeNaturalEventCategories}
          simulationTime={simulationTime}
          selectedEntityId={appState.selection.selectedId}
          orbitCatalog={orbitSnapshot?.data ?? null}
          orbitEnabled={appState.layers.orbit}
          activeOrbitCategories={activeOrbitCategoryList}
          orbitScaleMode={orbitScaleMode}
          orbitTrailMode={orbitTrailMode}
          showOrbitPath={showOrbitPath}
          showGroundTrack={showGroundTrack}
          auroraModel={spaceWeatherSnapshot?.data.aurora ?? null}
          auroraEnabled={appState.layers.aurora}
          auroraHemispheres={auroraHemispheres}
          observerLocation={observerLocation}
          observerPassAnchor={observerPassAnchor}
          onReady={() => { setReady(true); setRendererError(null); }}
          onError={(message) => setRendererError(message)}
          onPointOfView={setPointOfView}
          onMetrics={setMetrics}
          onGlobeClick={handleGlobeClick}
          onEarthquakeClick={handleEarthquakeClick}
          onNaturalEventClick={handleNaturalEventClick}
          onSatelliteClick={handleSatelliteClick}
          onSelectedSatelliteTelemetry={setSelectedSatelliteTelemetry}
          onOrbitStats={setOrbitStats}
          onOrbitWorkerError={(message) => setOrbitError(message)}
          onObserverSky={setObserverSky}
          onObserverPasses={setObserverPassForecast}
          onCameraState={handleCameraState}
          onManualCameraInput={handleManualCameraInput}
          onQualityChange={setQuality}
        />
        <div className="globe-vignette" aria-hidden="true" />
        <div className="globe-grid" aria-hidden="true" />
      </div>

      <TopBar
        ready={ready && !rendererError}
        pointOfView={pointOfView}
        clock={appState.clock}
        visualMode={appState.visualMode}
        onSearch={() => setSearchOpen(true)}
        onBriefings={() => setBriefingLauncherOpen(true)}
        onHere={openHere}
        onSettings={openSettings}
        onReset={resetGlobe}
      />

      <aside className="desktop-left"><LayerPanel layers={appState.layers} earthquake={earthquakePanelProps} naturalEvents={naturalEventPanelProps} orbit={orbitPanelProps} spaceWeather={spaceWeatherPanelProps} onToggle={toggleLayer} /></aside>
      <aside className="desktop-right"><InspectorPanel entity={selectedEntity} earthquake={selectedEarthquake} earthquakeFreshness={appState.providerStatus.usgs} naturalEvent={selectedNaturalEvent} naturalEventFreshness={appState.providerStatus.eonet} simulationTime={simulationTime} satellite={selectedSatellite} satelliteTelemetry={selectedSatelliteTelemetry} orbitFreshness={appState.providerStatus.celestrak} orbitScaleMode={orbitScaleMode} orbitCameraMode={orbitCameraMode} orbitTrailMode={orbitTrailMode} showOrbitPath={showOrbitPath} showGroundTrack={showGroundTrack} onTrailModeChange={setOrbitTrailMode} onFocus={focusSelection} onFollowSatellite={followSelectedSatellite} onOrbitView={frameSelectedOrbit} onStopOrbitCamera={stopOrbitCamera} onToggleOrbitPath={setShowOrbitPath} onToggleGroundTrack={setShowGroundTrack} onClear={clearSelection} /></aside>

      <div className="desktop-timeline">
        <TimelineControls
          clock={appState.clock}
          onSetOffsetHours={setTimelineOffset}
          onTogglePlay={toggleTimePlayback}
          onSetSpeed={setTimeSpeed}
          onReturnLive={returnLive}
        />
      </div>

      <div className="interaction-hint" aria-hidden="true">DRAG ORBIT · SCROLL ZOOM · CLICK SIGNAL · / SEARCH · B BRIEFING</div>

      {hereOpen && (
        <aside className="desktop-here panel-surface">
          <header className="panel-header"><div><div className="panel-eyebrow">LOCAL OBSERVATORY</div><h2>Above Me</h2></div><button className="icon-button" type="button" onClick={() => setHereOpen(false)} aria-label="Close Above Me">×</button></header>
          <div className="desktop-here__scroll"><AboveMeControls {...aboveMePanelProps} /></div>
        </aside>
      )}

      {settingsOpen && (
        <aside className="desktop-settings panel-surface">
          <header className="panel-header">
            <div><div className="panel-eyebrow">SYSTEM</div><h2>Display</h2></div>
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
          </header>
          <SettingsPanel quality={quality} metrics={metrics} visualMode={appState.visualMode} accessibility={accessibilityPreferences} systemAccessibility={systemAccessibility} reducedMotion={reducedMotion} highContrast={highContrast} device={deviceCapabilities} releaseVersion={APP_VERSION} offlineReady={offlineReady} online={online} installAvailable={installPrompt !== null} recording={recording} recordingSupported={preferredRecordingMimeType() !== null} onVisualMode={setVisualMode} onQuality={setRenderingQuality} onMotionPreference={setMotionPreference} onContrastPreference={setContrastPreference} onShare={() => void shareCurrentView()} onCapture={() => void captureSnapshot()} onRecord={() => void recordClip()} onInstall={() => void installApp()} onFullscreen={toggleFullscreen} onReset={resetGlobe} />
        </aside>
      )}

      <nav className="mobile-dock" aria-label="Signal Earth controls">
        <button type="button" aria-pressed={mobileSheet === 'layers'} className={mobileSheet === 'layers' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'layers' ? null : 'layers')}><span>◫</span>Layers</button>
        <button type="button" aria-pressed={mobileSheet === 'here'} className={mobileSheet === 'here' ? 'is-active' : ''} onClick={() => { if (mobileSheet === 'here') setMobileSheet(null); else openHere(); }}><span>⌖</span>Here</button>
        <button type="button" aria-pressed={mobileSheet === 'time'} className={mobileSheet === 'time' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'time' ? null : 'time')}><span>◷</span>Time</button>
        <button type="button" aria-pressed={mobileSheet === 'inspector'} className={mobileSheet === 'inspector' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'inspector' ? null : 'inspector')}><span>◎</span>Inspect</button>
      </nav>

      <BottomSheet open={mobileSheet === 'layers'} eyebrow="SIGNALS" title="Layers" onClose={() => setMobileSheet(null)}>
        <LayerPanel compact layers={appState.layers} earthquake={earthquakePanelProps} naturalEvents={naturalEventPanelProps} orbit={orbitPanelProps} spaceWeather={spaceWeatherPanelProps} onToggle={toggleLayer} />
      </BottomSheet>

      <BottomSheet open={mobileSheet === 'inspector'} eyebrow="INSPECTOR" title={selectedEntity?.name ?? 'Selection'} onClose={() => setMobileSheet(null)}>
        <InspectorPanel compact entity={selectedEntity} earthquake={selectedEarthquake} earthquakeFreshness={appState.providerStatus.usgs} naturalEvent={selectedNaturalEvent} naturalEventFreshness={appState.providerStatus.eonet} simulationTime={simulationTime} satellite={selectedSatellite} satelliteTelemetry={selectedSatelliteTelemetry} orbitFreshness={appState.providerStatus.celestrak} orbitScaleMode={orbitScaleMode} orbitCameraMode={orbitCameraMode} orbitTrailMode={orbitTrailMode} showOrbitPath={showOrbitPath} showGroundTrack={showGroundTrack} onTrailModeChange={setOrbitTrailMode} onFocus={focusSelection} onFollowSatellite={followSelectedSatellite} onOrbitView={frameSelectedOrbit} onStopOrbitCamera={stopOrbitCamera} onToggleOrbitPath={setShowOrbitPath} onToggleGroundTrack={setShowGroundTrack} onClear={clearSelection} />
      </BottomSheet>

      <BottomSheet open={mobileSheet === 'time'} eyebrow="SIMULATION" title="Time" onClose={() => setMobileSheet(null)}>
        <TimelineControls compact clock={appState.clock} onSetOffsetHours={setTimelineOffset} onTogglePlay={toggleTimePlayback} onSetSpeed={setTimeSpeed} onReturnLive={returnLive} />
      </BottomSheet>

      <BottomSheet open={mobileSheet === 'here'} eyebrow="LOCAL OBSERVATORY" title="Above Me" onClose={() => setMobileSheet(null)}>
        <AboveMeControls {...aboveMePanelProps} />
      </BottomSheet>

      <BottomSheet open={mobileSheet === 'settings'} eyebrow="SYSTEM" title="Display" onClose={() => setMobileSheet(null)}>
        <SettingsPanel quality={quality} metrics={metrics} visualMode={appState.visualMode} accessibility={accessibilityPreferences} systemAccessibility={systemAccessibility} reducedMotion={reducedMotion} highContrast={highContrast} device={deviceCapabilities} releaseVersion={APP_VERSION} offlineReady={offlineReady} online={online} installAvailable={installPrompt !== null} recording={recording} recordingSupported={preferredRecordingMimeType() !== null} onVisualMode={setVisualMode} onQuality={setRenderingQuality} onMotionPreference={setMotionPreference} onContrastPreference={setContrastPreference} onShare={() => void shareCurrentView()} onCapture={() => void captureSnapshot()} onRecord={() => void recordClip()} onInstall={() => void installApp()} onFullscreen={toggleFullscreen} onReset={resetGlobe} />
      </BottomSheet>

      <SearchOverlay open={searchOpen} documents={searchIndex} onClose={() => setSearchOpen(false)} onResult={handleSearchResult} onCommand={handleSearchCommand} />
      <BriefingLauncher open={briefingLauncherOpen && tourState.status !== 'running'} reducedMotion={reducedMotion} onClose={() => setBriefingLauncherOpen(false)} onStart={(id) => void startBriefing(id)} />
      <BriefingOverlay state={tourState} onSkip={() => tourEngineRef.current.skip()} onCancel={() => cancelBriefing('user')} />
      <ToastHost messages={toasts} onDismiss={(id) => setToasts((current) => current.filter((message) => message.id !== id))} />

      {!ready && !rendererError && <LoadingState />}
      {rendererError && <RendererError message={rendererError} />}
    </main>
  );
}
