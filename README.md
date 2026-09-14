# Signal Earth

**Watch the planet move.**

Signal Earth is a static, browser-first observatory for Earth events, near-Earth orbit, space weather, and observer-relative context.

## Current status

**Signal Earth V1.0.0 — Phase 15 Release** is production-built, release-certified, and deployed through GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

V1 includes shareable public view URLs, clean PNG capture, optional 10-second browser recording, PWA install metadata/icons, a generated production precache for offline app-shell use, release verification scripts, and a GitHub Pages workflow that deploys only after the full release gate passes.

GitHub Actions certification passes TypeScript validation, all 84 unit tests, the production Vite build, service-worker precache generation, and post-build release verification. The verified production site is 13.40 MB.

A post-deploy Pages-artifact audit also caught and fixed a service-worker packaging edge case: hidden `.gitkeep` files were previously included in the generated precache even though GitHub Pages omits them from its deployment artifact. The generator now excludes hidden/non-runtime files and the release verifier rejects unsafe precache entries. The deployed artifact contains 15 safe precache entries with zero missing files.

Real interactive browser/device acceptance remains separate from automated release certification. See `docs/PHASE-15-ACCEPTANCE.md` and `docs/RELEASE-V1.md`.

## Current interaction model

### Desktop

- top bar: app/time status, current UTC, search, planetary briefings, Above Me, display settings
- left: four primary signal layers with USGS earthquake, NASA EONET, CelesTrak orbit, and NOAA SWPC/aurora controls
- right: selected-object inspector
- bottom: interactive ±24 h simulation timeline
- globe: drag/pinch/scroll navigation; click earthquakes, NASA natural events, or propagated satellites to inspect them; click Earth to create a surface target

### Timeline

- drag the timeline from −24h to +24h
- presets: −24h, −6h, −1h, NOW, +6h, +24h
- playback: 1×, 10×, 100×, 1000×
- seeking pauses at the chosen timestamp
- LIVE explicitly reconnects to wall time
- playback stops safely at timeline boundaries

### Mobile

- compact top bar
- persistent bottom dock
- one bottom sheet at a time for Layers, Here, Time, or Inspect
- the Time sheet exposes the same timeline state and controls as desktop
- Above Me is available from the Here dock; location permission is requested only after explicit opt-in

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
- renderer state stays behind `GlobeViewportHandle`
- one ActionBus for application-state actions
- one central `TimeEngine`
- global simulation window is approximately ±24 hours
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
- current Open-Meteo conditions use a 15-minute cache and are never backfilled into unrelated replay/future time
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
- [`docs/RELEASE-V1.md`](docs/RELEASE-V1.md)

## Living Earth — v1.2

Signal Earth now includes a first-class Weather layer with NASA EOSDIS/GIBS VIIRS cloud optical thickness, optional GPM IMERG 30-minute precipitation, NASA EONET severe-storm tracks, simulation-time-aware observation requests, bounded recent fallback, and surfaced observation timestamps. Weather imagery is near-real-time observed context, not a forecast.

