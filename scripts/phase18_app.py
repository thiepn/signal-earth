from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

app = 'src/app/App.tsx'

# Timeline helpers and local UI state.
replace_once(
    app,
    "import { TimelineControls } from '../features/timeline/TimelineControls';",
    "import { TimelineControls } from '../features/timeline/TimelineControls';\nimport { earthquakeWindowForTimelineRange, orbitTemporallyAvailable, rangeForOffsetHours, TIMELINE_RANGES, widenEarthquakeWindow, type TimelineRange } from '../features/timeline/timeline';",
)
replace_once(
    app,
    "  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);\n\n  const [earthquakeWindow,",
    "  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);\n  const [timelineRange, setTimelineRangeState] = useState<TimelineRange>(initialShareRef.current?.timelineRange ?? 'day');\n  const [replay24Active, setReplay24Active] = useState(false);\n\n  const [earthquakeWindow,",
)

# Authoritative TimeEngine action path, including guided replay-to-live.
replace_once(
    app,
    "    } else if (action.type === 'SET_TIME_SPEED') {\n      timeEngineRef.current.setSpeed(action.speed);\n    } else if (action.type === 'RETURN_LIVE') {",
    "    } else if (action.type === 'SET_TIME_SPEED') {\n      timeEngineRef.current.setSpeed(action.speed);\n    } else if (action.type === 'START_REPLAY_TO_LIVE') {\n      timeEngineRef.current.startReplayToLive(action.fromTimestamp, action.speed);\n    } else if (action.type === 'RETURN_LIVE') {",
)
replace_once(
    app,
    "    if (action.type === 'SET_TIME' || action.type === 'SET_TIME_SPEED' || action.type === 'RETURN_LIVE') {",
    "    if (action.type === 'SET_TIME' || action.type === 'SET_TIME_SPEED' || action.type === 'START_REPLAY_TO_LIVE' || action.type === 'RETURN_LIVE') {",
)

# Replace the old fixed ±24h timeline controls with Time 2.0 range-aware controls.
old_time_controls = """  const setTimelineOffset = useCallback((hours: number) => {
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
"""
new_time_controls = """  const selectTimelineRange = useCallback((range: TimelineRange) => {
    setReplay24Active(false);
    setTimelineRangeState(range);
    setEarthquakeWindow((current) => widenEarthquakeWindow(current, earthquakeWindowForTimelineRange(range)));
    const snapshot = timeEngineRef.current.snapshot();
    const offsetHours = (snapshot.simulationTime - snapshot.realTime) / 3_600_000;
    const minHours = -TIMELINE_RANGES[range].pastHours;
    if (offsetHours < minHours) {
      emit({ type: 'SET_TIME_SPEED', speed: 0 });
      emit({ type: 'SET_TIME', timestamp: snapshot.realTime + minHours * 3_600_000 });
    }
  }, [emit]);

  const setTimelineOffset = useCallback((hours: number) => {
    setReplay24Active(false);
    if (Math.abs(hours) < 0.01) {
      emit({ type: 'RETURN_LIVE' });
      return;
    }

    const requiredRange = rangeForOffsetHours(hours);
    if (TIMELINE_RANGES[requiredRange].pastHours > TIMELINE_RANGES[timelineRange].pastHours) {
      setTimelineRangeState(requiredRange);
    }
    setEarthquakeWindow((current) => widenEarthquakeWindow(current, earthquakeWindowForTimelineRange(requiredRange)));

    // Scrubbing is an explicit seek operation. Freeze at the selected moment
    // so the thumb does not drift underneath the user while they are seeking.
    emit({ type: 'SET_TIME_SPEED', speed: 0 });
    const realTime = timeEngineRef.current.snapshot().realTime;
    emit({ type: 'SET_TIME', timestamp: realTime + hours * 3_600_000 });
  }, [emit, timelineRange]);

  const toggleTimePlayback = useCallback(() => {
    setReplay24Active(false);
    const snapshot = timeEngineRef.current.snapshot();
    emit({ type: 'SET_TIME_SPEED', speed: snapshot.isPlaying ? 0 : 1 });
  }, [emit]);

  const setTimeSpeed = useCallback((speed: SimulationSpeed) => {
    setReplay24Active(false);
    emit({ type: 'SET_TIME_SPEED', speed });
  }, [emit]);

  const returnLive = useCallback(() => {
    setReplay24Active(false);
    emit({ type: 'RETURN_LIVE' });
  }, [emit]);

  const replayLast24Hours = useCallback(() => {
    setTimelineRangeState('day');
    setEarthquakeWindow((current) => widenEarthquakeWindow(current, 'day'));
    setReplay24Active(true);
    const realTime = timeEngineRef.current.snapshot().realTime;
    emit({ type: 'START_REPLAY_TO_LIVE', fromTimestamp: realTime - 24 * 3_600_000, speed: 1000 });
  }, [emit]);

  useEffect(() => {
    if (replay24Active && (appState.clock?.mode === 'live' || appState.clock?.isPlaying === false)) setReplay24Active(false);
  }, [appState.clock?.isPlaying, appState.clock?.mode, replay24Active]);
"""
replace_once(app, old_time_controls, new_time_controls)

# Deep historical replay semantics.
replace_once(
    app,
    "  const simulationTime = appState.clock?.simulationTime ?? timeEngineRef.current.currentTime;\n\n  // Pass prediction",
    "  const simulationTime = appState.clock?.simulationTime ?? timeEngineRef.current.currentTime;\n  const orbitTimeAvailable = orbitTemporallyAvailable(appState.clock);\n\n  useEffect(() => {\n    if (orbitTimeAvailable) return;\n    setSelectedSatelliteTelemetry(null);\n    setObserverSky(null);\n    setObserverPassForecast(null);\n    const selectedId = appState.selection.selectedId;\n    if (selectedId && String(selectedId).startsWith('satellite:')) {\n      emit({ type: 'CLEAR_SELECTION' });\n      if (mobileSheet === 'inspector') setMobileSheet(null);\n    }\n  }, [appState.selection.selectedId, emit, mobileSheet, orbitTimeAvailable]);\n\n  // Pass prediction",
)
replace_once(
    app,
    "    validCount: orbitStats.validCount,\n    freshness: appState.providerStatus.celestrak,",
    "    validCount: orbitStats.validCount,\n    temporalAvailable: orbitTimeAvailable,\n    freshness: appState.providerStatus.celestrak,",
)

# Share the selected visible time range.
replace_once(
    app,
    "      weatherSettings: atmosphereSettings,\n    };",
    "      weatherSettings: atmosphereSettings,\n      timelineRange,\n    };",
)
replace_once(
    app,
    "atmosphereSettings, auroraHemispheres, earthquakeMagnitude, earthquakeWindow, orbitScaleMode",
    "atmosphereSettings, auroraHemispheres, earthquakeMagnitude, earthquakeWindow, orbitScaleMode",
)
# Insert timelineRange into the actual dependency list without depending on ordering elsewhere.
replace_once(
    app,
    "orbitTrailMode, pointOfView, pushToast, showGroundTrack, showOrbitPath]);",
    "orbitTrailMode, pointOfView, pushToast, showGroundTrack, showOrbitPath, timelineRange]);",
)

# Command palette can launch the guided replay.
replace_once(
    app,
    "    if (intent.type === 'play') { emit({ type: 'SET_TIME_SPEED', speed: 1 }); return; }\n    if (intent.type === 'speed')",
    "    if (intent.type === 'play') { emit({ type: 'SET_TIME_SPEED', speed: 1 }); return; }\n    if (intent.type === 'replay-day') { replayLast24Hours(); return; }\n    if (intent.type === 'speed')",
)
replace_once(
    app,
    "recordClip, resetGlobe, searchIndex, setTimelineOffset, shareCurrentView, startBriefing]);",
    "recordClip, replayLast24Hours, resetGlobe, searchIndex, setTimelineOffset, shareCurrentView, startBriefing]);",
)

# Render Time 2.0 on desktop and mobile.
old_desktop = """        <TimelineControls
          clock={appState.clock}
          onSetOffsetHours={setTimelineOffset}
          onTogglePlay={toggleTimePlayback}
          onSetSpeed={setTimeSpeed}
          onReturnLive={returnLive}
        />"""
new_desktop = """        <TimelineControls
          clock={appState.clock}
          range={timelineRange}
          onRangeChange={selectTimelineRange}
          onSetOffsetHours={setTimelineOffset}
          onTogglePlay={toggleTimePlayback}
          onSetSpeed={setTimeSpeed}
          onReturnLive={returnLive}
          onReplayLast24Hours={replayLast24Hours}
          replayActive={replay24Active}
          orbitAvailable={orbitTimeAvailable}
          activity={{ earthquakes: visibleEarthquakes.length, events: visibleNaturalEvents.length }}
        />"""
replace_once(app, old_desktop, new_desktop)
replace_once(
    app,
    "        <TimelineControls compact clock={appState.clock} onSetOffsetHours={setTimelineOffset} onTogglePlay={toggleTimePlayback} onSetSpeed={setTimeSpeed} onReturnLive={returnLive} />",
    "        <TimelineControls compact clock={appState.clock} range={timelineRange} onRangeChange={selectTimelineRange} onSetOffsetHours={setTimelineOffset} onTogglePlay={toggleTimePlayback} onSetSpeed={setTimeSpeed} onReturnLive={returnLive} onReplayLast24Hours={replayLast24Hours} replayActive={replay24Active} orbitAvailable={orbitTimeAvailable} activity={{ earthquakes: visibleEarthquakes.length, events: visibleNaturalEvents.length }} />",
)

# Propagation layer is suppressed outside its certified temporal window.
replace_once(
    app,
    "          orbitEnabled={appState.layers.orbit}\n          activeOrbitCategories={activeOrbitCategoryList}",
    "          orbitEnabled={appState.layers.orbit && orbitTimeAvailable}\n          orbitTemporalAvailable={orbitTimeAvailable}\n          activeOrbitCategories={activeOrbitCategoryList}",
)

# GlobeViewport: keep observer/orbit worker semantics honest during deep replay.
globe = 'src/features/globe/GlobeViewport.tsx'
replace_once(
    globe,
    "  orbitEnabled: boolean;\n  activeOrbitCategories: SatelliteCategory[];",
    "  orbitEnabled: boolean;\n  orbitTemporalAvailable: boolean;\n  activeOrbitCategories: SatelliteCategory[];",
)
replace_once(
    globe,
    "  useEffect(() => { orbitRef.current?.setEnabled(props.orbitEnabled); requestOrbitUpdateRef.current?.(true); }, [props.orbitEnabled]);\n  useEffect(() => {",
    "  useEffect(() => { orbitRef.current?.setEnabled(props.orbitEnabled); requestOrbitUpdateRef.current?.(true); }, [props.orbitEnabled]);\n  useEffect(() => {\n    if (!props.orbitTemporalAvailable) {\n      callbacksRef.current.onObserverSky?.(null);\n      callbacksRef.current.onObserverPasses?.(null);\n    }\n    requestOrbitUpdateRef.current?.(true);\n  }, [props.orbitTemporalAvailable]);\n  useEffect(() => {",
)
replace_once(
    globe,
    "    if (id && String(id).startsWith('satellite:')) {",
    "    if (id && String(id).startsWith('satellite:') && props.orbitTemporalAvailable) {",
)
replace_once(globe, "  }, [props.selectedEntityId]);", "  }, [props.orbitTemporalAvailable, props.selectedEntityId]);")
replace_once(
    globe,
    "    if (!id || !String(id).startsWith('satellite:') || props.orbitTrailMode === 'off') {",
    "    if (!props.orbitTemporalAvailable || !id || !String(id).startsWith('satellite:') || props.orbitTrailMode === 'off') {",
)
replace_once(globe, "  }, [props.orbitTrailMode, props.selectedEntityId]);", "  }, [props.orbitTemporalAvailable, props.orbitTrailMode, props.selectedEntityId]);")
replace_once(
    globe,
    "    if (!client || !props.observerLocation || !props.orbitCatalog?.satellites.length) {",
    "    if (!props.orbitTemporalAvailable || !client || !props.observerLocation || !props.orbitCatalog?.satellites.length) {",
)
replace_once(
    globe,
    "  }, [props.observerLocation, props.observerPassAnchor, props.orbitCatalog]);",
    "  }, [props.observerLocation, props.observerPassAnchor, props.orbitCatalog, props.orbitTemporalAvailable]);",
)
replace_once(
    globe,
    "      if (observerLocation && (force || nowPerformance - lastObserverRealTime >= 2_000)) {",
    "      if (observerLocation && callbacksRef.current.orbitTemporalAvailable && (force || nowPerformance - lastObserverRealTime >= 2_000)) {",
)
replace_once(
    globe,
    "      if (selectedId && String(selectedId).startsWith('satellite:')) {",
    "      if (callbacksRef.current.orbitTemporalAvailable && selectedId && String(selectedId).startsWith('satellite:')) {",
)
