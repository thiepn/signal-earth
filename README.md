# Signal Earth

**Watch the planet move.**

Signal Earth is a static, browser-first observatory for Earth events, atmosphere, near-Earth orbit, space weather, time, and observer-relative context.

## Current status

**Signal Earth v1.10.0 — Phase 25 Performance Architecture 2.0** is production-built and release-certified for GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

The current product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), Time 2.0 replay, Observatory UX 2.0, deterministic Signal Intelligence, Above Me 2.0, Orbit 2.0, Dynamic Briefings 2.0, Saved Worlds, shareable views, capture/recording, PWA/offline-shell support, and the Phase 25 progressive-loading architecture.

## Performance Architecture 2.0

Phase 25 changes how the observatory reaches the browser without changing its scientific/data semantics.

- The pre-Phase-25 production build shipped one main JavaScript bundle of roughly **2.47 MB minified / 709 KB gzip**.
- The v1.10 release keeps the HTML-linked startup JavaScript graph at approximately **435.5 KB raw / 138.7 KB gzip**.
- The remaining secondary code is distributed across **10 deferred JavaScript chunks** totaling roughly **2.01 MB raw**.
- The Three.js / Globe.gl WebGL core remains a large, immediately requested async chunk (about **1.97 MB raw / 556 KB gzip**) because the globe is the primary product surface rather than an optional feature.
- Search, Display/Settings + Saved Worlds, Dynamic Briefings launcher, Above Me UI, Signal Inspector/intelligence, Now UI, and selected-satellite orbit mechanics are loaded through explicit lazy boundaries.
- Basic satellite hover information appears immediately; richer Orbit 2.0 mechanics are loaded only when satellite interaction requires them.
- `OrbitWorkerClient` no longer creates the satellite worker just because the globe mounted. The worker starts on the first real catalog/propagation/observer request.
- The service worker precaches only the install/startup shell. Lazy feature chunks and the orbit worker are cached on first use instead of being downloaded during service-worker installation.
- A new `performance:verify` release gate enforces the startup-JavaScript budget and verifies that the major lazy chunks and orbit worker do not leak back into the startup precache.
- GitHub Actions uses `--legacy-peer-deps` as a narrow workaround for an npm 10.9.8 Arborist peer-resolution crash observed on current hosted runners; application dependency versions are unchanged.

The goal is not to hide Vite's large-chunk warning. The WebGL core is still large. Phase 25 instead keeps nonessential product systems out of the startup path and makes that architectural boundary testable.

## Major systems

### Signal Earth Now

A deterministic priority feed answers **“What matters right now?”** using USGS earthquakes, NASA EONET events, NOAA SWPC context, CelesTrak/ISS context, and observer information when available.

### Living Earth

The Weather layer uses NASA EOSDIS/GIBS cloud optical thickness and optional IMERG precipitation with simulation-time-aware observation timestamps. Severe-storm tracks come from NASA EONET. Observed atmospheric imagery is not presented as forecast data.

### Time 2.0

- 24H / 7D / 30D historical ranges
- +24H future simulation cap
- 1× / 10× / 100× / 1000× playback
- guided **24H REPLAY** that reconnects automatically to LIVE
- observed Earth history can extend to 30 days
- current CelesTrak OMM propagation is deliberately unavailable outside Signal Earth's certified ±24-hour orbit window

### Observatory UX 2.0

- contextual one-layer-at-a-time controls
- zoom-aware country/city labels and borders
- hover-before-click signal previews
- selection-driven inspector
- mobile bottom-sheet workflow and direct Search access

### Signal Intelligence

Selected signals preserve raw provider fields while adding deterministic derived context. No generative model writes event explanations. USGS flags remain flags, EONET motion uses source geometry, CelesTrak context remains propagated/derived, and NOAA products retain their individual operational/model semantics.

### Above Me 2.0

The local observatory includes Sun/Moon horizon geometry, current observing conditions, local aurora context, satellites above the observer, and ranked ISS opportunities. Favorable viewing geometry is not presented as guaranteed naked-eye visibility. Location remains ephemeral unless the user explicitly chooses **Remember this coordinate**.

### Orbit 2.0

Selected satellites expose locally derived period, mean-element perigee/apogee, mean phase, orbit class, constellation/program context, selected-time sunlight state, and ascending/descending motion. The selected ground track separates ascending and descending segments. Positions remain locally propagated CelesTrak OMM context.

### Dynamic Briefings 2.0

Data-driven briefings include Earth Right Now, Seismic Activity, Active Storms, Space Weather, Above Me, Orbit Highlights, and Last 24 Hours. Definitions are assembled deterministically from supported provider snapshots, expose LIVE/CACHED/PARTIAL state, omit unavailable sections, and freeze before playback. Planet in Motion and Night Earth remain curated tours.

### Saved Worlds

Saved Worlds stores up to 24 named browser-local observatory presets using the same canonical public state representation as share links. Views can be loaded, updated, copied, or deleted. Observer coordinates and accessibility preferences are intentionally excluded from Saved Worlds.

## Interaction model

### Desktop

- top: **Now**, **Search**, time state, Brief, Here, Display
- left: Weather / Earthquakes / Natural Events / Orbit / Aurora
- right: inspector appears when a signal is selected
- bottom: Time 2.0 timeline
- globe: drag, zoom, hover signals, click signals or Earth locations
- Display contains rendering/accessibility/release tools and Saved Worlds

### Mobile

- compact top bar with Search
- persistent **Now / Layers / Here / Time / Inspect** dock
- one bottom sheet at a time
- the same intelligence, observer, timeline, briefing and Saved Worlds semantics as desktop

### Keyboard

- `/` — Search + deterministic command palette
- `B` — briefings
- `N` — Signal Earth Now
- `Space` — play/pause time
- `R` — reset globe
- `Esc` — close transient UI / cancel briefing
- `1` / `2` / `3` / `4` — Earth / Signal / Night / Wireframe

## Architecture and trust constraints

- static GitHub Pages deployment; no runtime backend
- React/TypeScript for low-frequency application/UI state
- Three.js + Globe.gl for the Earth renderer
- one central `TimeEngine` and one ActionBus
- high-frequency renderer/propagation state stays outside React state
- provider snapshots use IndexedDB caches with provider-specific freshness policies
- USGS earthquakes remain observed data
- NASA EONET geometry is time-aware and never extrapolated into invented tracks
- NASA GIBS imagery is observation-time aware and is not treated as forecast data
- NOAA Kp/scales/solar wind/OVATION keep their distinct semantics and validity rules
- CelesTrak OMM positions are locally propagated, not measured live positions
- Orbit remains scientifically bounded to the existing ±24-hour trust window
- observer location persists only after explicit opt-in
- current Open-Meteo conditions are not projected into future ISS-pass weather
- deterministic search/commands; no remote AI/geocoder dependency
- deterministic briefing composition; no generative narration
- Saved Worlds stores public display state only and introduces no account/cloud backend
- Phase 25 async chunks retain the same product/data trust boundaries as their pre-split implementations
- lazy chunks and workers use service-worker runtime cache after first use rather than startup precache
- `npm run release` now includes a startup-architecture performance regression gate

## Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Release gate:

```bash
npm run release
```

Individual checks:

```bash
npm run typecheck
npm test
npm run build
npm run release:verify
npm run performance:verify
```

## Earth assets

Local Earth textures are stylized derivatives of public-domain Natural Earth low-resolution geometry. Surface variation is decorative geographic context, not measured elevation or land-cover data.

## Documentation

Core documents live under [`docs/`](docs/). Phase acceptance records are maintained as `docs/PHASE-<N>-ACCEPTANCE.md`, including:

- [`docs/PHASE-18-ACCEPTANCE.md`](docs/PHASE-18-ACCEPTANCE.md) — Time 2.0
- [`docs/PHASE-19-ACCEPTANCE.md`](docs/PHASE-19-ACCEPTANCE.md) — Observatory UX 2.0
- [`docs/PHASE-20-ACCEPTANCE.md`](docs/PHASE-20-ACCEPTANCE.md) — Signal Intelligence
- [`docs/PHASE-21-ACCEPTANCE.md`](docs/PHASE-21-ACCEPTANCE.md) — Above Me 2.0
- [`docs/PHASE-22-ACCEPTANCE.md`](docs/PHASE-22-ACCEPTANCE.md) — Orbit 2.0
- [`docs/PHASE-23-ACCEPTANCE.md`](docs/PHASE-23-ACCEPTANCE.md) — Dynamic Briefings 2.0
- [`docs/PHASE-24-ACCEPTANCE.md`](docs/PHASE-24-ACCEPTANCE.md) — Saved Worlds
- [`docs/PHASE-25-ACCEPTANCE.md`](docs/PHASE-25-ACCEPTANCE.md) — Performance Architecture 2.0
