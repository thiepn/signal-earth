from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text()

def replace(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing App patch target: {old[:100]!r}')
    text = text.replace(old, new, 1)

replace(
"import { GlobeViewport, type GlobeViewportHandle, type GlobeViewportQuality } from '../features/globe/GlobeViewport';",
"import { GlobeViewport, type GlobeViewportHandle, type GlobeViewportQuality } from '../features/globe/GlobeViewport';\nimport type { GeoContextLabel } from '../features/globe/geoContext';")
replace(
"import { LoadingState } from '../ui/components/LoadingState';",
"import { HoverPreview, type HoverPreviewModel } from '../ui/components/HoverPreview';\nimport { LoadingState } from '../ui/components/LoadingState';")
replace(
"  const [nowOpen, setNowOpen] = useState(false);\n  const [toasts, setToasts] = useState<ToastMessage[]>([]);",
"  const [nowOpen, setNowOpen] = useState(false);\n  const [hoverPreview, setHoverPreview] = useState<HoverPreviewModel | null>(null);\n  const [toasts, setToasts] = useState<ToastMessage[]>([]);")

# Clear previews on direct selections.
replace(
"  const handleGlobeClick = useCallback(({ lat, lon }: { lat: number; lon: number }) => {\n    viewportRef.current?.stopOrbitCamera();",
"  const handleGlobeClick = useCallback(({ lat, lon }: { lat: number; lon: number }) => {\n    setHoverPreview(null);\n    viewportRef.current?.stopOrbitCamera();")
replace(
"  const handleEarthquakeClick = useCallback((earthquake: EarthquakeRecord) => {\n    viewportRef.current?.stopOrbitCamera();",
"  const handleEarthquakeClick = useCallback((earthquake: EarthquakeRecord) => {\n    setHoverPreview(null);\n    viewportRef.current?.stopOrbitCamera();")
replace(
"  const handleNaturalEventClick = useCallback((event: NaturalEventRecord) => {\n    viewportRef.current?.stopOrbitCamera();",
"  const handleNaturalEventClick = useCallback((event: NaturalEventRecord) => {\n    setHoverPreview(null);\n    viewportRef.current?.stopOrbitCamera();")
replace(
"  const handleSatelliteClick = useCallback((satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => {\n    viewportRef.current?.stopOrbitCamera();",
"  const handleSatelliteClick = useCallback((satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => {\n    setHoverPreview(null);\n    viewportRef.current?.stopOrbitCamera();")

# Hover preview and geographic-label navigation callbacks.
anchor = "  const requestObserverLocation = useCallback(async () => {"
insert = """  const handleEarthquakeHover = useCallback((earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => {
    if (!earthquake || !position || window.matchMedia?.('(pointer: coarse)').matches) { setHoverPreview(null); return; }
    setHoverPreview({
      kind: 'EARTHQUAKE',
      title: earthquake.place,
      metric: `M${earthquake.magnitude.toFixed(1)}`,
      detail: `${earthquake.coordinates.depthKm.toFixed(0)} km deep · observed event`,
      source: 'USGS',
      x: position.x,
      y: position.y,
    });
  }, []);

  const handleNaturalEventHover = useCallback((event: NaturalEventRecord | null, position?: { x: number; y: number }) => {
    if (!event || !position || window.matchMedia?.('(pointer: coarse)').matches) { setHoverPreview(null); return; }
    setHoverPreview({
      kind: event.categoryTitle.toUpperCase(),
      title: event.title,
      metric: event.closedAt === null ? 'ACTIVE' : 'HISTORY',
      detail: `${event.categoryTitle} · ${event.geometry.length} observation${event.geometry.length === 1 ? '' : 's'}`,
      source: 'NASA EONET',
      x: position.x,
      y: position.y,
    });
  }, []);

  const handleSatelliteHover = useCallback((satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => {
    if (!satellite || !telemetry || !position || window.matchMedia?.('(pointer: coarse)').matches) { setHoverPreview(null); return; }
    setHoverPreview({
      kind: satellite.category.replace('-', ' ').toUpperCase(),
      title: satellite.name,
      metric: `${telemetry.altitudeKm.toFixed(0)} km`,
      detail: `${telemetry.speedKmS.toFixed(2)} km/s · NORAD ${satellite.noradId}`,
      source: 'CELESTRAK · PROPAGATED',
      x: position.x,
      y: position.y,
    });
  }, []);

  const handleGeoContextNavigate = useCallback((label: GeoContextLabel) => {
    setHoverPreview(null);
    viewportRef.current?.stopOrbitCamera();
    setOrbitCameraMode('none');
    const displayName = label.kind === 'city' ? `${label.name}, ${label.subtitle}` : label.name;
    const entity = makeLocationEntity(label.lat, label.lng, displayName);
    setEntityRegistry((current) => {
      const next = new Map(current);
      next.set(entity.id, entity);
      return next;
    });
    emit({ type: 'SELECT_ENTITY', entityId: entity.id });
    viewportRef.current?.focusCoordinates({ lat: label.lat, lon: label.lng }, label.kind === 'city' ? 0.72 : 1.05);
    if (window.matchMedia?.('(max-width: 760px)').matches) setMobileSheet('inspector');
  }, [emit]);

"""
if anchor not in text:
    raise SystemExit('missing hover callback anchor')
text = text.replace(anchor, insert + anchor, 1)

# Shell state class.
replace(
"    <main className={`app-shell mode-${appState.visualMode}${tourState.status === 'running' ? ' briefing-active' : ''}`}>",
"    <main className={`app-shell mode-${appState.visualMode}${tourState.status === 'running' ? ' briefing-active' : ''}${selectedEntity ? ' has-selection' : ''}`}>")

# Globe callbacks.
replace(
"          onEarthquakeClick={handleEarthquakeClick}\n          onNaturalEventClick={handleNaturalEventClick}\n          onSatelliteClick={handleSatelliteClick}",
"          onEarthquakeClick={handleEarthquakeClick}\n          onEarthquakeHover={handleEarthquakeHover}\n          onNaturalEventClick={handleNaturalEventClick}\n          onNaturalEventHover={handleNaturalEventHover}\n          onSatelliteClick={handleSatelliteClick}\n          onSatelliteHover={handleSatelliteHover}\n          onGeoContextNavigate={handleGeoContextNavigate}")

# Only occupy the right side when there is an actual selection.
old_inspector = "      <aside className=\"desktop-right\"><InspectorPanel entity={selectedEntity} earthquake={selectedEarthquake} earthquakeFreshness={appState.providerStatus.usgs} naturalEvent={selectedNaturalEvent} naturalEventFreshness={appState.providerStatus.eonet} simulationTime={simulationTime} satellite={selectedSatellite} satelliteTelemetry={selectedSatelliteTelemetry} orbitFreshness={appState.providerStatus.celestrak} orbitScaleMode={orbitScaleMode} orbitCameraMode={orbitCameraMode} orbitTrailMode={orbitTrailMode} showOrbitPath={showOrbitPath} showGroundTrack={showGroundTrack} onTrailModeChange={setOrbitTrailMode} onFocus={focusSelection} onFollowSatellite={followSelectedSatellite} onOrbitView={frameSelectedOrbit} onStopOrbitCamera={stopOrbitCamera} onToggleOrbitPath={setShowOrbitPath} onToggleGroundTrack={setShowGroundTrack} onClear={clearSelection} /></aside>"
new_inspector = "      {selectedEntity && <aside className=\"desktop-right desktop-right--active\"><InspectorPanel entity={selectedEntity} earthquake={selectedEarthquake} earthquakeFreshness={appState.providerStatus.usgs} naturalEvent={selectedNaturalEvent} naturalEventFreshness={appState.providerStatus.eonet} simulationTime={simulationTime} satellite={selectedSatellite} satelliteTelemetry={selectedSatelliteTelemetry} orbitFreshness={appState.providerStatus.celestrak} orbitScaleMode={orbitScaleMode} orbitCameraMode={orbitCameraMode} orbitTrailMode={orbitTrailMode} showOrbitPath={showOrbitPath} showGroundTrack={showGroundTrack} onTrailModeChange={setOrbitTrailMode} onFocus={focusSelection} onFollowSatellite={followSelectedSatellite} onOrbitView={frameSelectedOrbit} onStopOrbitCamera={stopOrbitCamera} onToggleOrbitPath={setShowOrbitPath} onToggleGroundTrack={setShowGroundTrack} onClear={clearSelection} /></aside>}"
replace(old_inspector, new_inspector)

# Interaction hint and hover preview.
replace(
"      <div className=\"interaction-hint\" aria-hidden=\"true\">DRAG ORBIT · SCROLL ZOOM · CLICK SIGNAL · N NOW · / SEARCH · B BRIEFING</div>",
"      <div className=\"interaction-hint\" aria-hidden=\"true\">DRAG ORBIT · SCROLL ZOOM · HOVER PREVIEW · CLICK INSPECT · N NOW · / SEARCH</div>\n      <HoverPreview model={hoverPreview} />")

# Mobile dock: Search is always reachable; inspection opens automatically when an object is selected.
old_dock = """      <nav className=\"mobile-dock\" aria-label=\"Signal Earth controls\">
        <button type=\"button\" aria-pressed={mobileSheet === 'now'} className={mobileSheet === 'now' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'now' ? null : 'now')}><span>●</span>Now</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'layers'} className={mobileSheet === 'layers' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'layers' ? null : 'layers')}><span>◫</span>Layers</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'here'} className={mobileSheet === 'here' ? 'is-active' : ''} onClick={() => { if (mobileSheet === 'here') setMobileSheet(null); else openHere(); }}><span>⌖</span>Here</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'time'} className={mobileSheet === 'time' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'time' ? null : 'time')}><span>◷</span>Time</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'inspector'} className={mobileSheet === 'inspector' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'inspector' ? null : 'inspector')}><span>◎</span>Inspect</button>
      </nav>"""
new_dock = """      <nav className=\"mobile-dock\" aria-label=\"Signal Earth controls\">
        <button type=\"button\" aria-pressed={mobileSheet === 'now'} className={mobileSheet === 'now' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'now' ? null : 'now')}><span>●</span>Now</button>
        <button type=\"button\" aria-pressed={searchOpen} className={searchOpen ? 'is-active' : ''} onClick={() => { setMobileSheet(null); setSearchOpen(true); }}><span>⌕</span>Search</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'layers'} className={mobileSheet === 'layers' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'layers' ? null : 'layers')}><span>◫</span>Layers</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'time'} className={mobileSheet === 'time' ? 'is-active' : ''} onClick={() => setMobileSheet(mobileSheet === 'time' ? null : 'time')}><span>◷</span>Time</button>
        <button type=\"button\" aria-pressed={mobileSheet === 'here'} className={mobileSheet === 'here' ? 'is-active' : ''} onClick={() => { if (mobileSheet === 'here') setMobileSheet(null); else openHere(); }}><span>⌖</span>Here</button>
      </nav>"""
replace(old_dock, new_dock)

path.write_text(text)
print('Phase 19 app integration applied.')
