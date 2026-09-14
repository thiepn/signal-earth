from pathlib import Path


def patch(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing patch target in {path}: {old[:90]!r}')
    file.write_text(text.replace(old, new, 1))

# Seismic hover previews
path = 'src/core/engine/SeismicRenderer.ts'
patch(path,
"export interface SeismicRendererOptions {\n  onSelect?: (earthquake: EarthquakeRecord) => void;\n  getSimulationTime?: () => number;\n}",
"export interface SeismicRendererOptions {\n  onSelect?: (earthquake: EarthquakeRecord) => void;\n  onHover?: (earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => void;\n  getSimulationTime?: () => number;\n}")
patch(path,
"  readonly #onSelect: ((earthquake: EarthquakeRecord) => void) | undefined;\n  readonly #getSimulationTime: () => number;",
"  readonly #onSelect: ((earthquake: EarthquakeRecord) => void) | undefined;\n  readonly #onHover: SeismicRendererOptions['onHover'] | undefined;\n  readonly #getSimulationTime: () => number;")
patch(path,
"  constructor(options: SeismicRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#getSimulationTime = options.getSimulationTime ?? Date.now;\n  }",
"  constructor(options: SeismicRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#onHover = options.onHover;\n    this.#getSimulationTime = options.getSimulationTime ?? Date.now;\n  }")
patch(path,
"    if (!enabled && this.#context?.renderer.domElement.style.cursor === 'pointer') {\n      this.#context.renderer.domElement.style.cursor = '';\n    }",
"    if (!enabled) {\n      this.#hoveredInstance = null;\n      this.#onHover?.(null);\n      if (this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';\n    }")
patch(path,
"    this.#disposeMesh();\n    this.#disposePulses();\n    this.#context = null;",
"    this.#onHover?.(null);\n    this.#disposeMesh();\n    this.#disposePulses();\n    this.#context = null;")
patch(path,
"    event.preventDefault();\n    event.stopImmediatePropagation();\n    this.#onSelect?.(earthquake);",
"    event.preventDefault();\n    event.stopImmediatePropagation();\n    this.#onHover?.(null);\n    this.#onSelect?.(earthquake);")
patch(path,
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const instanceId = this.#raycast(event);\n    if (instanceId === this.#hoveredInstance) return;\n    this.#hoveredInstance = instanceId;\n    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';\n  };",
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const instanceId = this.#raycast(event);\n    if (instanceId === this.#hoveredInstance) return;\n    this.#hoveredInstance = instanceId;\n    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';\n    const earthquake = instanceId === null ? null : this.#rendered[instanceId] ?? null;\n    if (earthquake) this.#onHover?.(earthquake, { x: event.clientX, y: event.clientY });\n    else this.#onHover?.(null);\n  };")

# Natural-event hover previews
path = 'src/core/engine/NaturalEventRenderer.ts'
patch(path,
"export interface NaturalEventRendererOptions {\n  onSelect?: (event: NaturalEventRecord) => void;\n  getSimulationTime?: () => number;\n}",
"export interface NaturalEventRendererOptions {\n  onSelect?: (event: NaturalEventRecord) => void;\n  onHover?: (event: NaturalEventRecord | null, position?: { x: number; y: number }) => void;\n  getSimulationTime?: () => number;\n}")
patch(path,
"  readonly #onSelect: ((event: NaturalEventRecord) => void) | undefined;\n  readonly #getSimulationTime: () => number;",
"  readonly #onSelect: ((event: NaturalEventRecord) => void) | undefined;\n  readonly #onHover: NaturalEventRendererOptions['onHover'] | undefined;\n  readonly #getSimulationTime: () => number;")
patch(path,
"  constructor(options: NaturalEventRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#getSimulationTime = options.getSimulationTime ?? Date.now;\n  }",
"  constructor(options: NaturalEventRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#onHover = options.onHover;\n    this.#getSimulationTime = options.getSimulationTime ?? Date.now;\n  }")
patch(path,
"    if (!enabled) this.#clearCursor();",
"    if (!enabled) { this.#clearCursor(); this.#onHover?.(null); }")
patch(path,
"    this.#clearCursor();\n    this.#disposeVisuals();",
"    this.#clearCursor();\n    this.#onHover?.(null);\n    this.#disposeVisuals();")
patch(path,
"    event.preventDefault();\n    event.stopImmediatePropagation();\n    this.#onSelect?.(hit.event);",
"    event.preventDefault();\n    event.stopImmediatePropagation();\n    this.#onHover?.(null);\n    this.#onSelect?.(hit.event);")
patch(path,
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const hit = this.#raycast(event);\n    const key = hit?.key ?? '';\n    if (key === this.#hoveredKey) return;\n    this.#hoveredKey = key;\n    this.#context.renderer.domElement.style.cursor = hit ? 'pointer' : '';\n  };",
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const hit = this.#raycast(event);\n    const key = hit?.key ?? '';\n    if (key === this.#hoveredKey) return;\n    this.#hoveredKey = key;\n    this.#context.renderer.domElement.style.cursor = hit ? 'pointer' : '';\n    if (hit) this.#onHover?.(hit.event, { x: event.clientX, y: event.clientY });\n    else this.#onHover?.(null);\n  };")

# Orbit hover previews
path = 'src/core/engine/OrbitRenderer.ts'
patch(path,
"export interface OrbitRendererOptions {\n  onSelect?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;\n  onSelectedTelemetry?: (telemetry: SatelliteTelemetry | null) => void;\n  getSimulationTime?: () => number;\n}",
"export interface OrbitRendererOptions {\n  onSelect?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;\n  onHover?: (satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => void;\n  onSelectedTelemetry?: (telemetry: SatelliteTelemetry | null) => void;\n  getSimulationTime?: () => number;\n}")
patch(path,
"  readonly #onSelect: OrbitRendererOptions['onSelect'] | undefined;\n  readonly #onSelectedTelemetry: OrbitRendererOptions['onSelectedTelemetry'] | undefined;",
"  readonly #onSelect: OrbitRendererOptions['onSelect'] | undefined;\n  readonly #onHover: OrbitRendererOptions['onHover'] | undefined;\n  readonly #onSelectedTelemetry: OrbitRendererOptions['onSelectedTelemetry'] | undefined;")
patch(path,
"  constructor(options: OrbitRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#onSelectedTelemetry = options.onSelectedTelemetry;",
"  constructor(options: OrbitRendererOptions = {}) {\n    this.#onSelect = options.onSelect;\n    this.#onHover = options.onHover;\n    this.#onSelectedTelemetry = options.onSelectedTelemetry;")
patch(path,
"    if (!enabled && this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';",
"    if (!enabled) {\n      this.#hoveredInstance = null;\n      this.#onHover?.(null, null);\n      if (this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';\n    }")
patch(path,
"    this.#selectedWorldValid = false;\n    this.#onSelectedTelemetry?.(null);",
"    this.#selectedWorldValid = false;\n    this.#hoveredInstance = null;\n    this.#onHover?.(null, null);\n    this.#onSelectedTelemetry?.(null);")
patch(path,
"    this.#disposeMesh();\n    this.#disposeHalo();",
"    this.#onHover?.(null, null);\n    this.#disposeMesh();\n    this.#disposeHalo();")
patch(path,
"    event.preventDefault(); event.stopImmediatePropagation();\n    this.#onSelect?.(satellite, telemetry);",
"    event.preventDefault(); event.stopImmediatePropagation();\n    this.#onHover?.(null, null);\n    this.#onSelect?.(satellite, telemetry);")
patch(path,
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const instanceId = this.#raycast(event);\n    if (instanceId === this.#hoveredInstance) return;\n    this.#hoveredInstance = instanceId;\n    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';\n  };",
"  #onPointerMove = (event: PointerEvent): void => {\n    if (!this.#context) return;\n    const instanceId = this.#raycast(event);\n    if (instanceId === this.#hoveredInstance) return;\n    this.#hoveredInstance = instanceId;\n    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';\n    if (instanceId === null) { this.#onHover?.(null, null); return; }\n    const catalogIndex = this.#renderedIndices[instanceId];\n    const satellite = catalogIndex === undefined ? null : this.#catalog[catalogIndex] ?? null;\n    const telemetry = catalogIndex === undefined ? null : this.#telemetryForCatalogIndex(catalogIndex);\n    if (satellite && telemetry) this.#onHover?.(satellite, telemetry, { x: event.clientX, y: event.clientY });\n    else this.#onHover?.(null, null);\n  };")

# GlobeViewport wiring
path = 'src/features/globe/GlobeViewport.tsx'
patch(path,
"import { EarthRenderer } from '../../core/engine/EarthRenderer';\nimport { AtmosphereRenderer } from '../../core/engine/AtmosphereRenderer';",
"import { EarthRenderer } from '../../core/engine/EarthRenderer';\nimport { GeoContextRenderer } from '../../core/engine/GeoContextRenderer';\nimport { AtmosphereRenderer } from '../../core/engine/AtmosphereRenderer';")
patch(path,
"import type { AtmosphereStatus, WeatherLayerSettings } from '../weather/types';",
"import type { AtmosphereStatus, WeatherLayerSettings } from '../weather/types';\nimport type { GeoContextLabel } from './geoContext';")
patch(path,
"  onEarthquakeClick?: (earthquake: EarthquakeRecord) => void;\n  onNaturalEventClick?: (event: NaturalEventRecord) => void;\n  onSatelliteClick?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;",
"  onEarthquakeClick?: (earthquake: EarthquakeRecord) => void;\n  onEarthquakeHover?: (earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => void;\n  onNaturalEventClick?: (event: NaturalEventRecord) => void;\n  onNaturalEventHover?: (event: NaturalEventRecord | null, position?: { x: number; y: number }) => void;\n  onSatelliteClick?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;\n  onSatelliteHover?: (satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => void;\n  onGeoContextNavigate?: (label: GeoContextLabel) => void;")
patch(path,
"  const engineRef = useRef<GlobeEngine | null>(null);\n  const atmosphereRef = useRef<AtmosphereRenderer | null>(null);",
"  const engineRef = useRef<GlobeEngine | null>(null);\n  const geoContextRef = useRef<GeoContextRenderer | null>(null);\n  const atmosphereRef = useRef<AtmosphereRenderer | null>(null);")
patch(path,
"  useEffect(() => { auroraRef.current?.setVisualMode(props.visualMode); }, [props.visualMode]);",
"  useEffect(() => {\n    auroraRef.current?.setVisualMode(props.visualMode);\n    geoContextRef.current?.refreshVisualMode();\n  }, [props.visualMode]);")
patch(path,
"    const earth = new EarthRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), getVisualMode: () => callbacksRef.current.visualMode });\n    const atmosphere = new AtmosphereRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), onStatus: (status) => callbacksRef.current.onAtmosphereStatus?.(status) });",
"    const earth = new EarthRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), getVisualMode: () => callbacksRef.current.visualMode });\n    const geoContext = new GeoContextRenderer({ getVisualMode: () => callbacksRef.current.visualMode, onNavigate: (label) => callbacksRef.current.onGeoContextNavigate?.(label) });\n    const atmosphere = new AtmosphereRenderer({ getSimulationTime: () => callbacksRef.current.getSimulationTime(), onStatus: (status) => callbacksRef.current.onAtmosphereStatus?.(status) });")
patch(path,
"    const seismic = new SeismicRenderer({ onSelect: (earthquake) => callbacksRef.current.onEarthquakeClick?.(earthquake), getSimulationTime: () => callbacksRef.current.getSimulationTime() });\n    const naturalEvents = new NaturalEventRenderer({ onSelect: (event) => callbacksRef.current.onNaturalEventClick?.(event), getSimulationTime: () => callbacksRef.current.getSimulationTime() });\n    const orbit = new OrbitRenderer({\n      onSelect: (satellite, telemetry) => callbacksRef.current.onSatelliteClick?.(satellite, telemetry),",
"    const seismic = new SeismicRenderer({\n      onSelect: (earthquake) => callbacksRef.current.onEarthquakeClick?.(earthquake),\n      onHover: (earthquake, position) => callbacksRef.current.onEarthquakeHover?.(earthquake, position),\n      getSimulationTime: () => callbacksRef.current.getSimulationTime(),\n    });\n    const naturalEvents = new NaturalEventRenderer({\n      onSelect: (event) => callbacksRef.current.onNaturalEventClick?.(event),\n      onHover: (event, position) => callbacksRef.current.onNaturalEventHover?.(event, position),\n      getSimulationTime: () => callbacksRef.current.getSimulationTime(),\n    });\n    const orbit = new OrbitRenderer({\n      onSelect: (satellite, telemetry) => callbacksRef.current.onSatelliteClick?.(satellite, telemetry),\n      onHover: (satellite, telemetry, position) => callbacksRef.current.onSatelliteHover?.(satellite, telemetry, position),")
patch(path,
"    engineRef.current = engine;\n    atmosphereRef.current = atmosphere;",
"    engineRef.current = engine;\n    geoContextRef.current = geoContext;\n    atmosphereRef.current = atmosphere;")
patch(path,
"      engine.registerRenderer(earth);\n      engine.registerRenderer(atmosphere);",
"      engine.registerRenderer(earth);\n      engine.registerRenderer(geoContext);\n      engine.registerRenderer(atmosphere);")
patch(path,
"      atmosphereRef.current = null; seismicRef.current = null; naturalEventsRef.current = null; orbitRef.current = null; auroraRef.current = null; observerRef.current = null; orbitClientRef.current = null; engineRef.current = null;",
"      geoContextRef.current = null; atmosphereRef.current = null; seismicRef.current = null; naturalEventsRef.current = null; orbitRef.current = null; auroraRef.current = null; observerRef.current = null; orbitClientRef.current = null; engineRef.current = null;")

print('Phase 19 renderer integration applied.')
