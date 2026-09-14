# Signal Earth

**Watch the planet move.**

Signal Earth is a static, browser-first observatory for Earth events, near-Earth orbit, space weather, and observer-relative context.

## Current status

**Signal Earth v1.7.0 — Phase 22 Orbit 2.0** is production-built and release-certified for GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

The current product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), Orbit 2.0, Above Me 2.0 observer tools, shareable public views, PNG capture, optional 10-second recording, PWA/offline-shell support, Time 2.0 historical replay, Observatory UX 2.0, and deterministic Signal Intelligence.

Time 2.0 exposes **24H / 7D / 30D** historical ranges while keeping future simulation capped at +24H. A guided **24H REPLAY** runs the previous day at 1000× and reconnects automatically to LIVE. Deep historical replay prioritizes observed Earth data; current CelesTrak OMM propagation is deliberately suppressed outside its certified ±24-hour window.

Observatory UX 2.0 adds contextual one-layer-at-a-time controls, zoom-aware country/city labels and country borders, hover-before-click signal previews, a selection-driven desktop inspector, and directly accessible Search on mobile. These are presentation and interaction improvements; they do not change source semantics.

Signal Intelligence adds a deterministic explanation layer beside raw provider fields. It derives earthquake impact cues from USGS fields, event duration and reported movement from NASA EONET geometry, orbital mechanics from CelesTrak OMM elements, and plain-language space-weather state from NOAA SWPC products. Every intelligence card exposes its derivation method and preserves the distinction between source measurements, provider flags, propagated values, forecasts, and local calculations.

Above Me 2.0 makes observer context first-class. It ranks ISS passes using local darkness, maximum elevation and satellite sunlight at culmination, surfaces rise/culmination/set geometry, improves Sun/Moon horizon context, summarizes current optical conditions, and keeps NOAA aurora context tied to model validity. Favorable pass geometry is explicitly not presented as guaranteed naked-eye visibility, and current weather is never projected into future passes.

Orbit 2.0 deepens selected-satellite exploration with mean-element perigee/apogee, orbital period and mean phase, LEO/MEO/GEO/HEO classification, deterministic constellation/program context, selected-time sunlight/shadow state, ascending/descending ground-track semantics, richer hover context, and stratified marker sampling for large catalogs.

Automated release certification runs TypeScript validation, unit tests, the production Vite build, service-worker precache generation, and post-build release verification before Pages deployment. Real interactive browser/device acceptance remains a separate manual check.

## Current interaction model

### Desktop

- top bar: primary **Now** and **Search** actions, compact time state, then secondary Brief / Here / Display tools
- left: five primary layers, with only the selected layer’s detailed controls expanded; Orbit explains LEO/MEO/GEO/HEO classes and ASC/DESC ground-track semantics
- right: selected-object inspector appears only when an object is selected and separates raw source data from derived intelligence; selected satellites expose Orbit 2.0 mechanics and sunlight state
- bottom: Time 2.0 timeline with 24H / 7D / 30D replay ranges and a +24H future cap
- globe: zoom-aware country/city context and country borders; hover signals for a compact preview, click to inspect, or click Earth to create a surface target
- orbit: selected orbit path plus solid ascending and dashed descending ground-track segments, Follow/Orbit View cameras, and temporal trails
- Above Me: local observer summary, horizon sky, ranked ISS passes, current observing conditions and aurora context

### Timeline

- choose a **24H**, **7D**, or **30D** historical range
- future simulation remains capped at **+24H**
- range-aware presets and scrub precision
- playback: 1×, 10×, 100×, 1000×
- **24H REPLAY** plays the previous day at 1000× and stops automatically at LIVE
- visible earthquake/event counts update with simulation time
- deep replay uses observed Earth history; Orbit is explicitly unavailable beyond ±24H
- seeking pauses at the chosen timestamp; LIVE explicitly reconnects to wall time

### Mobile

- compact top bar with direct Search access
- persistent bottom dock for **Now / Layers / Here / Time / Inspect**
- one bottom sheet at a time; selecting a globe signal opens Inspect automatically
- intelligence cards use the same source/derived distinction as desktop
- selected satellites expose the same Orbit 2.0 mechanics as desktop in compact form
- the Time sheet exposes the same timeline state and controls as desktop
- Above Me 2.0 is available from the Here dock; location permission is requested only after explicit opt-in

### Keyboard

- `/` — unified search + deterministic command palette
- `B` — open planetary briefings
- `Space` — play/pause simulation clock
- `R` — reset globe
- `Esc` — close transient UI
- `1` / `2` / `3` / `4` — Earth / Signal / Night / Wireframe

## Architecture constraints

- static GitHub Pages deployment
- no runtime backend
- React/TypeScript for low-frequency UI state
- Three.js + Globe.gl for rendering
- presentation-only Natural Earth borders and zoom-aware geographic labels are isolated in a dedicated renderer and can fail without affecting signal layers
- hover previews originate from renderer callbacks and are presented through a lightweight UI bridge; high-frequency render data remains outside React app state
- Signal Intelligence rules are pure deterministic functions over already-loaded provider records; no generative model or hidden remote enrichment is used
- intelligence cards expose their methodology and never replace raw source fields
- provider flags remain flags: for example, the USGS tsunami field is never rewritten as a claim that a tsunami occurred
- NASA EONET movement calculations use only geometry reports applicable at the selected simulation time
- CelesTrak orbital period, inclination and eccentricity are derived from OMM fields; displayed spacecraft positions remain locally propagated rather than measured live positions
- Orbit 2.0 selected mechanics are derived locally from loaded CelesTrak OMM fields plus selected-time satellite.js propagation; no additional orbit provider is introduced
- Orbit 2.0 perigee/apogee and mean phase are mean-element context, not precision orbit determination
- selected satellite sunlight/penumbra/umbra state is derived from the selected-time propagated ECI position and Earth-shadow geometry
- quality-capped orbit rendering uses stratified catalog sampling and always preserves the selected satellite when possible
- selected ground-track direction is rendered as solid ascending and dashed descending segments; this is motion direction only and does not represent sensor swath or communications footprint
- current-only NOAA scales and solar-wind observations are never backfilled into unrelated replay/future time
- renderer state stays behind `GlobeViewportHandle`
- one ActionBus for application-state actions
- one central `TimeEngine`
- global simulation window supports 30 days of historical replay and 24 hours of future simulation
- observed / propagated / forecast semantics remain distinct
- high-frequency simulation/renderer data bypasses React app state
- satellite propagation runs in a dedicated ES-module Web Worker via satellite.js
- speed-aware predictive ephemeris windows drive render-time orbit interpolation
- large timeline seeks invalidate stale orbital prediction state
- CelesTrak OMM catalogs obey a hard two-hour minimum fetch interval
- orbit markers use quality-capped Three.js instancing
- selected orbit paths and temporal trails are generated on demand in the orbit worker
- true altitude is default; visual scale is explicitly labelled and factor-aware
- satellite follow/orbit cameras remain owned by CameraController/GlobeEngine
- IndexedDB-backed provider snapshots
- USGS feed auto-refresh with stale-cache fallback
- NASA EONET v3 adapter with 15-minute client TTL and 24-hour stale fallback
- EONET event geometry is timeline-aware but never extrapolated into invented future tracks
- NOAA SWPC multi-product adapter with five-minute cache TTL and independent partial-feed degradation
- Kp retains observed/estimated/predicted semantics; current solar-wind/scales never masquerade as replay data
- OVATION aurora is validity-window constrained and rendered through a dedicated quality-bounded Three.js point field
- observer location is ephemeral by default and only persisted after explicit opt-in
- observer-relative satellite look angles and pass predictions remain inside the orbit worker
- ISS pass culmination uses satellite.js solar position + Earth-shadow fraction to distinguish sunlit / penumbra / umbra geometry
- favorable observer geometry combines local solar darkness, satellite illumination and pass elevation but never claims guaranteed apparent visibility
- current Open-Meteo conditions use a 15-minute cache and are never backfilled into unrelated replay/future time or projected into future pass weather
- local Sun/Moon/horizon geometry follows the same central TimeEngine
- Phase 12 search is local-first and indexes only simulation-time-applicable observed events
- command parsing is deterministic and compiles to existing app actions; no AI or remote geocoder is used
- Phase 13 cinematic briefings are declarative step sequences executed through existing app actions and GlobeEngine camera APIs
- the tour engine is cancellable, supports step skipping, and snapshots/restores user state rather than leaving hidden mutations behind
- manual OrbitControls input emits an explicit interruption signal so guided camera control yields immediately to the user

## Development

```bash
npm install
npm run dev
```

V1 release gate:

```bash
npm run release
```

Individual verification commands remain available as `npm run typecheck`, `npm test`, `npm run build`, and `npm run release:verify`.

## Earth assets

The local Earth textures are stylized derivatives of public-domain Natural Earth low-resolution geometry. Surface variation is decorative geographic context, not measured elevation or land-cover data.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md)
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/PHASE-0-ACCEPTANCE.md`](docs/PHASE-0-ACCEPTANCE.md)
- [`docs/PHASE-1-ACCEPTANCE.md`](docs/PHASE-1-ACCEPTANCE.md)
- [`docs/PHASE-2-ACCEPTANCE.md`](docs/PHASE-2-ACCEPTANCE.md)
- [`docs/PHASE-3-ACCEPTANCE.md`](docs/PHASE-3-ACCEPTANCE.md)
- [`docs/PHASE-4-ACCEPTANCE.md`](docs/PHASE-4-ACCEPTANCE.md)
- [`docs/PHASE-5-ACCEPTANCE.md`](docs/PHASE-5-ACCEPTANCE.md)
- [`docs/PHASE-6-ACCEPTANCE.md`](docs/PHASE-6-ACCEPTANCE.md)
- [`docs/PHASE-7-ACCEPTANCE.md`](docs/PHASE-7-ACCEPTANCE.md)
- [`docs/PHASE-8-ACCEPTANCE.md`](docs/PHASE-8-ACCEPTANCE.md)
- [`docs/PHASE-9-ACCEPTANCE.md`](docs/PHASE-9-ACCEPTANCE.md)
- [`docs/PHASE-10-ACCEPTANCE.md`](docs/PHASE-10-ACCEPTANCE.md)
- [`docs/PHASE-11-ACCEPTANCE.md`](docs/PHASE-11-ACCEPTANCE.md)
- [`docs/PHASE-12-ACCEPTANCE.md`](docs/PHASE-12-ACCEPTANCE.md)
- [`docs/PHASE-13-ACCEPTANCE.md`](docs/PHASE-13-ACCEPTANCE.md)
- [`docs/PHASE-14-ACCEPTANCE.md`](docs/PHASE-14-ACCEPTANCE.md)
- [`docs/PHASE-15-ACCEPTANCE.md`](docs/PHASE-15-ACCEPTANCE.md)
- [`docs/PHASE-16-ACCEPTANCE.md`](docs/PHASE-16-ACCEPTANCE.md)
- [`docs/PHASE-17-ACCEPTANCE.md`](docs/PHASE-17-ACCEPTANCE.md)
- [`docs/PHASE-18-ACCEPTANCE.md`](docs/PHASE-18-ACCEPTANCE.md)
- [`docs/PHASE-19-ACCEPTANCE.md`](docs/PHASE-19-ACCEPTANCE.md)
- [`docs/PHASE-20-ACCEPTANCE.md`](docs/PHASE-20-ACCEPTANCE.md)
- [`docs/PHASE-21-ACCEPTANCE.md`](docs/PHASE-21-ACCEPTANCE.md)
- [`docs/PHASE-22-ACCEPTANCE.md`](docs/PHASE-22-ACCEPTANCE.md)
- [`docs/RELEASE-V1.md`](docs/RELEASE-V1.md)

## Living Earth — v1.2

Signal Earth includes a first-class Weather layer with NASA EOSDIS/GIBS VIIRS cloud optical thickness, optional GPM IMERG 30-minute precipitation, NASA EONET severe-storm tracks, simulation-time-aware observation requests, bounded recent fallback, and surfaced observation timestamps. Weather imagery is near-real-time observed context, not a forecast.

## Signal Intelligence — v1.5

Selected earthquakes, natural events and satellites include deterministic intelligence cards that explain the most relevant source-derived context while retaining the raw provider fields above them. The Aurora/Space Weather layer receives the same treatment for NOAA Kp, G/R/S scales, solar wind and OVATION validity. Derived text is explicitly labelled and includes its methodology; no AI-generated event claims are introduced.

## Above Me 2.0 — v1.6

The local observatory ranks ISS opportunities over the next 24 hours, shows rise/culmination/set geometry, evaluates sunlight vs Earth shadow at pass culmination, improves Sun/Moon horizon context, and summarizes current darkness/cloud conditions and aurora model context. Viewing labels describe geometry only; apparent brightness, local obstructions and future cloud cover remain outside the model.

## Orbit 2.0 — v1.7

Selected satellites now expose local OMM-derived orbital mechanics including period, perigee/apogee, mean phase, orbit class, constellation/program context, selected-time sunlight state and ascending/descending motion. The selected ground track separates solid ascending from dashed descending segments, while large quality-capped catalogs use stratified sampling rather than first-record truncation. All positions remain locally propagated CelesTrak OMM context within Signal Earth’s existing certified ±24-hour orbit window.