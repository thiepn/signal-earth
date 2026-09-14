# Signal Earth — Architecture

## System shape

```text
React UI
  │ actions / low-frequency state
  ▼
Application core
  ├─ TimeEngine
  ├─ selection/layer state
  ├─ provider adapters
  ├─ cache
  └─ camera state machine
  │
  ├───────────────► GlobeEngine / Three.js / Globe.gl
  │                    └─ feature-owned renderers
  │
  └───────────────► Orbit Web Worker
                       └─ OMM + SGP4 propagation
```

## Stack

- Vite
- TypeScript
- React
- Three.js
- Globe.gl
- satellite.js
- IndexedDB via `idb`
- Web Workers
- GitHub Pages

React is an overlay and control surface; it does not own per-frame WebGL state.


## Phase 1 globe runtime

Globe.gl owns the WebGL canvas and its render cycle. `GlobeEngine` wraps it rather than creating a competing Three.js renderer loop. The engine is responsible for:

- mount/dispose lifecycle
- renderer plug-in registration
- responsive dimensions via `ResizeObserver`
- pause/resume on document visibility
- quality profile propagation
- low-frequency renderer metrics
- scene-space/geographic coordinate bridging
- camera runtime attachment

Feature renderers receive a shared `GlobeRenderContext` containing the Globe.gl instance, Three.js scene/camera/renderer, OrbitControls and current quality accessors. Each feature owns and disposes the resources it creates.

The `EarthRenderer` owns local Earth textures, atmosphere, scene lights, procedural stars and the Phase 3 day/night presentation. It obtains simulation time through a narrow getter backed by `TimeEngine`, so the render loop can move the Sun smoothly without pushing per-frame time through React.

## Dependency direction

```text
UI → Features → Core/Shared
Providers → Core/Shared
Workers → Shared contracts
```

Core code may never import a feature module. Feature renderers own their own Three.js resources and may not mutate another feature renderer.

## Runtime boundaries

### React
Allowed: panels, inspectors, settings, timeline controls, search, low-frequency counters/status, selected-entity metadata.

Forbidden: hundreds of satellite positions, per-frame camera matrices, per-frame particle state, orbital propagation loops.

### Globe engine
Owns scene/render lifecycle, feature renderers, camera driver, quality adaptations, and high-frequency visual interpolation.

### Orbit worker
Owns OMM parsing, propagation, position/velocity calculations, ground tracks, observer look angles, pass prediction, and propagation failures.

## Time architecture

`TimeEngine` is the single authority for simulation time.

Modes:

- `live`
- `replay`
- `simulation`

Speeds: `0`, `1`, `10`, `100`, `1000`.

Global V1 simulation window is approximately **±24 hours around now**. Longer event history may be browsed, but current OMM data must not be presented as precise multi-week historical orbit reconstruction.

Temporal types:

- observed
- propagated
- forecast
- historical
- static

Temporal type is independent from data freshness.

## Data-provider boundary

No component fetches an external provider directly. Every source is hidden behind `ProviderAdapter<TRaw, TNormalized>`.

Adapters own:

- request construction
- normalization
- validation
- cache policy
- temporal type
- source metadata

Malformed rows should be rejected individually when safe; malformed payloads must not crash the app.

## Cache hierarchy

```text
memory → IndexedDB → network
```

Snapshots contain provider, fetch/source timestamps, expiry, schema version, provider version, and normalized value.

Stale data may be displayed when useful only when visibly marked stale/cached.

## Selection contract

Exactly zero or one primary selected entity.

```text
select → inspect → focus → follow/track → clear
```

## Camera contract

Modes:

- free
- focusing
- focused
- following
- cinematic

Manual camera interaction must cancel automation unless a future explicit lock mode says otherwise.

All camera actions route through `CameraController`.

## Orbital input

Canonical orbital input is **CelesTrak GP JSON / OMM**, not legacy TLE. Provider-specific OMM data is normalized before entering orbit feature code.

Normal active catalog target: roughly 300–800 objects.

Ordinary satellite visualization will use instancing. A selected object may be promoted to a dedicated mesh/path representation.

Propagation cadence and render cadence are decoupled: propagation is approximately 1 Hz under normal live playback while rendering/interpolation can remain 30–60 FPS.

## Quality profiles

- low: pixel ratio 1, 2K Earth, reduced effects, lower satellite cap
- medium: pixel ratio 1.5, 2K Earth, standard effects
- high: pixel ratio ≤2, 4K Earth, full effects, 800-object target

The app should degrade based on measured sustained performance, not user-agent labels alone.

## Performance budgets

- first usable globe: <3 s desktop broadband, <5 s mid-range mobile target
- rendering: ~60 FPS desktop, ≥30 FPS mobile target
- main-thread frame: <12 ms typical desktop, <24 ms typical mobile
- initial transfer: ≤4 MB before optional high-resolution assets
- production core/lazy assets: target <25 MB

## Static deployment constraint

No runtime Node/Express/WebSocket/database/session/SSR dependency is permitted. GitHub Actions may build/test/deploy the static output, but the deployed app must execute entirely in the browser plus public data endpoints.


## Phase 2 shell architecture

The permanent shell is an overlay around the Phase 1 globe engine. UI components never receive raw Three.js or Globe.gl objects. `GlobeViewport` exposes a narrow imperative handle for camera framing, coordinate focus and renderer-quality changes.

Desktop and mobile presentation differ, but they consume the same canonical state and actions:

```text
UI controls / keyboard / quick navigation
              ↓
          ActionBus
              ↓
        App state reducer
              ↓
   panels / sheets / inspector
```

High-frequency point-of-view and renderer metrics remain local UI observations rather than entering provider/simulation state.

The Phase 2 clock semantics are explicit: LIVE means wall-clock time at 1× only. Pausing, scrubbing, or using a non-1× speed detaches into replay/simulation mode. Only RETURN LIVE reattaches to wall time.


## Phase 3 astronomical frame

Signal Earth uses an Earth-fixed geographic frame for the globe and all future surface data. The globe mesh is **not** physically rotated as simulation time advances, because doing so would detach rendered longitude/latitude data from Globe.gl picking and camera coordinates.

Instead:

```text
TimeEngine
   ↓
solarCoordinates()
   ↓
subsolar lat/lon
   ↓
Globe.gl geographic → scene vector
   ↓
Directional Sun + night-light terminator
```

The star field rotates using Greenwich mean sidereal time, giving the observer an inertial reference frame while Earth-fixed geographic coordinates stay stable.

The city-light texture is a stylised non-scientific presentation asset. The scientific component is the solar geometry controlling whether that texture is visible on the night side.

## Phase 5 — Timeline 1.0

The TimeEngine is the only authority for simulated time. LIVE follows wall time; any explicit seek, pause, or non-1× playback detaches the clock until `RETURN_LIVE` is dispatched.

The app action bus now executes the time command actions defined in Phase 0:

```text
SET_TIME
SET_TIME_SPEED
RETURN_LIVE
        ↓
    TimeEngine
        ↓
   SYNC_CLOCK
```

The global V1 simulation domain is hard-clamped to ±24 hours from current wall time. Predictable systems may calculate inside that domain. Observed systems do not synthesize future state.

Earthquakes demonstrate the temporal-layer contract:

```text
USGS snapshot
    ↓
magnitude filter
    ↓
SeismicRenderer keeps instanced catalog
    ↓
simulation timestamp controls occurrence visibility
```

React derives low-frequency visible counts and selection validity from the same simulation timestamp, while the renderer keeps the earthquake mesh mounted and updates instance transforms in place. Rewinding before the selected event clears the canonical selection.

## Phase 6 orbital runtime

```text
CelesTrak GP JSON / OMM
        ↓
CelesTrakProvider
  validate + normalize + dedupe
        ↓
CelesTrakService
  memory + IndexedDB (>= 2h)
        ↓
plain SatelliteRecord[]
        ↓
OrbitWorkerClient ────────────────┐
        ↓                         │
Web Worker                        │
  json2satrec()                   │
  SGP4 propagate()                │
  ECI → geodetic                  │
        ↓                         │
Uint32Array indices               │
Float32Array lat/lon/alt/speed    │
        ↓ transferable buffers    │
OrbitRenderer ◄───────────────────┘
  InstancedMesh
  render-loop interpolation
```

`SatRec` objects never leave the worker. Bulk satellite positions never enter React state. React owns only catalog metadata, provider/freshness state, category controls, selection, and low-frequency telemetry for the currently selected satellite.

Phase 6 established the worker/typed-array boundary. Phase 8 replaces the original single-frame smoothing strategy with speed-aware predictive ephemeris windows while preserving that boundary.

## Phase 7 orbit interaction runtime

Phase 7 adds an on-demand interaction layer without changing the Phase 6 bulk propagation architecture.

```text
selected satellite
      ↓
GENERATE_TRACK request
      ↓
orbit worker / satellite.js
      ↓
one-period propagated samples
      ↓
transferable Float32Array
      ↓
OrbitRenderer
  ├─ orbital path
  ├─ ground track
  ├─ selected halo
  └─ selected world target
      ↓
GlobeEngine / CameraController
  ├─ follow camera
  └─ orbit-plane framing
```

The renderer exposes geometry and target positions but never directly owns camera state. `OrbitControls` distance limits are changed only while a satellite camera mode is active and restored when normal Earth navigation resumes.

True scale remains canonical. Visual scale is an explicitly labelled presentation transform applied consistently to satellite altitude and the selected orbital path; it never alters source telemetry or worker propagation.


## Phase 8 orbit + time runtime

```text
TimeEngine.currentTime
        ↓
playback profile (0×/1×/10×/100×/1000×)
        ↓
OrbitWorkerClient
        ↓
PROPAGATE_WINDOW(start, end, samples)
        ↓
satellite.js / SGP4
        ↓
sample-major transferable Float32Array
        ↓
OrbitRenderer
        ↓
per-frame interpolation at authoritative simulation time
```

The worker cadence and prediction horizon scale with simulation speed. High-frequency visual state still bypasses React. The renderer rejects stale temporal state after discontinuous seeks until a new worker window arrives, preventing a timeline jump from being misrepresented as physical motion.

Selected path geometry is independently generated from the same OMM record at current simulation time. The context orbit remains a full one-period path; optional temporal trails show past 10 minutes, past orbit, or next orbit.


## Phase 9 — Natural-event pipeline

```text
NASA EONET v3
      ↓
EonetProvider
      ↓
normalize / validate / dedupe
      ↓
NaturalEventService
      ↓
Memory + IndexedDB
      ↓
canonical NaturalEventRecord[]
      ├── React: filters, counts, inspector metadata
      └── NaturalEventRenderer: instanced markers + tracks
```

`NaturalEventRenderer` owns all Three.js resources for EONET signals. React supplies event catalogs, category state, selected ID, and low-frequency simulation snapshots. The renderer resolves the latest geometry frame at the selected simulation time and never reaches into the network provider.

Storm track geometry is prebuilt when the catalog changes and uses `drawRange` to reveal reported history as the shared TimeEngine advances. Selected polygon outlines are created only for the selected event/current frame.


## Phase 10 — Space-weather pipeline

```text
NOAA SWPC public JSON products
      ↓
SwpcProvider
  ├─ Kp history/forecast
  ├─ NOAA G/R/S scales
  ├─ solar-wind summaries
  ├─ operational messages
  └─ OVATION aurora grid
      ↓
normalize / validate / per-product partial failure
      ↓
SpaceWeatherService
      ↓
Memory + IndexedDB (5 min TTL, 2 h stale fallback)
      ├── React: status, Kp-at-time, current observations, controls
      └── AuroraRenderer: packed model field → Three.js Points
```

`AuroraRenderer` owns all Three.js resources for the auroral model. React receives the low-frequency `SpaceWeatherFeed`; the renderer receives only the packed OVATION model, enabled/hemisphere state, visual mode and simulation-time snapshots. It never fetches NOAA data itself.

The latest OVATION product is not a historical archive. `isAuroraModelApplicable()` gates the renderer against the model's own observation/forecast timestamps. Moving the shared TimeEngine well before/after that window hides the field. Kp, by contrast, is a true mixed observed/estimated/predicted time series and can remain visible across the ±24 h simulation window when NOAA supplies the corresponding bucket.

Night mode changes aurora presentation opacity only. It does not modify NOAA model values or temporal applicability.

## Phase 11 — Observer / Above Me pipeline

```text
explicit user action
      ↓
navigator.geolocation
      ↓
ObserverLocation (ephemeral by default)
      ├───────────────┬───────────────────┬────────────────────┐
      ↓               ↓                   ↓                    ↓
local astronomy   Open-Meteo         Orbit Worker         NOAA OVATION
Sun / Moon        current weather    look angles/passes   nearest model cell
      │               │                   │                    │
      └───────────────┴──────────┬────────┴────────────────────┘
                                 ↓
                         Above Me controls
                                 +
                         My Horizon SVG
```

Location permission is never requested merely by opening the application or the Here panel. `requestBrowserLocation()` is invoked only from the explicit **Use my location** action. The coordinate remains in React memory by default; only the user's separate **Remember this coordinate on this device** choice writes latitude/longitude/altitude to localStorage. No observer coordinate is uploaded to an application backend because Signal Earth has no runtime backend.

Observer-relative orbital calculations extend the existing Phase 6 worker boundary. `SatRec` objects stay in the worker. Every ~2 seconds, `OBSERVER_SKY` returns only a bounded set of above-horizon satellites as transferable packed look-angle values (azimuth, elevation, range, physical altitude and speed). `PREDICT_PASSES` performs selected/ISS pass scanning in the same worker using SGP4 plus ECI→ECF→look-angle transforms. React receives only the compact observer snapshot and pass summaries.

Deterministic observer geometry (Sun, Moon, sunrise/sunset, satellite look angles and pass geometry) follows the shared `TimeEngine`. Open-Meteo current conditions do not: they retain their provider timestamp and are suppressed when the simulation clock is outside a narrow applicability window. Local OVATION context likewise inherits Phase 10 model-validity rules rather than being stretched across unrelated replay time.

`ObserverRenderer` owns the subtle globe marker for the observer coordinate. The polar My Horizon visualization is an SVG UI surface, not a second 3D engine and not augmented reality.


## Phase 13 — Cinematic / briefing pipeline

```text
BriefingDefinition[]
      ↓
TourEngine
  cancellable sequencing
  step progress / skip / exit
      ↓
BriefingInstruction[]
      ↓
App orchestration adapter
  ├─ ActionBus → layers / selection / visual mode
  ├─ TimeEngine → live / 100× / 1000×
  ├─ GlobeViewportHandle → cinematic POV / follow / orbit view
  └─ current provider refs → automatic signal selection
      ↓
existing Signal Earth systems
```

Briefings never manipulate Three.js objects, providers or the simulation clock directly. The tour engine is intentionally UI/framework agnostic: it sequences declarative steps and calls an application-provided executor. The App adapter resolves those instructions through the same canonical actions and viewport handle used by normal interaction.

Before a tour begins, Signal Earth captures the user's layer state, visual mode, simulation clock, selection, filters/categories and camera point of view. Temporary briefing changes are restored on normal completion or explicit Exit. Manual OrbitControls interaction emits a dedicated manual-camera event from `GlobeEngine`; this cancels the tour while preserving the camera position the user deliberately took control of.

Automatic briefing selection uses current provider-backed data, not hard-coded fictional events: Earth Now chooses the strongest currently valid earthquake and a high-value EONET event, while orbital briefings resolve representative objects from the current CelesTrak catalog. Async tour execution reads provider/telemetry refs so a tour can wait for data that loads after the briefing starts without freezing a stale React closure.
