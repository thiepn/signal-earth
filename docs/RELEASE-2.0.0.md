# Signal Earth 2.0.0

**Watch the planet move.**

Signal Earth 2.0 is the completed browser-first observatory release for Earth events, atmosphere, near-Earth orbit, space weather, time, and observer-relative context.

## What is in 2.0

- **Signal Earth Now** — a deterministic priority feed for meaningful current signals across earthquakes, natural events, space weather, orbit and local observer context.
- **Living Earth** — observation-time-aware NASA GIBS atmospheric imagery and severe-storm context with explicit observed-versus-forecast semantics.
- **Time 2.0** — 24H / 7D / 30D historical windows, bounded +24H future simulation, 1× / 10× / 100× / 1000× playback and guided 24-hour replay.
- **Observatory UX 2.0** — contextual layer controls, geographic context, hover previews, selection-driven inspection and refined mobile bottom-sheet workflows.
- **Signal Intelligence** — deterministic derived context that keeps source facts, provider flags and derived interpretation clearly separated.
- **Above Me 2.0** — local Sun/Moon geometry, observing conditions, aurora context, satellites above the observer and ranked ISS opportunities.
- **Orbit 2.0** — selected-satellite mechanics, orbit class/program context, sunlight state, ascending/descending motion and improved ground tracks inside the certified ±24-hour trust window.
- **Dynamic Briefings 2.0** — provider-driven deterministic briefings with LIVE/CACHED/PARTIAL source state plus curated cinematic tours.
- **Saved Worlds** — up to 24 browser-local observatory presets built from canonical public display state; observer coordinates and accessibility preferences remain excluded.
- **Performance Architecture 2.0** — demand-loaded secondary systems, deferred orbit worker startup and enforceable startup JavaScript budgets.
- **Real-World QA & Interaction Hardening** — permanent seven-target production browser/device-emulation regression coverage.
- **Data Reliability 2.0** — one validated provider/cache/fallback contract across USGS, NASA EONET, CelesTrak, NOAA SWPC and Open-Meteo.
- **Visual & Motion Finish** — final typography, hierarchy, surfaces, focus treatment, responsive density and reduced-motion polish without changing scientific semantics.
- **Release Hardening** — reproducible dependency resolution, stable runtime pins, immutable CI inputs, versioned service-worker caches, stronger package/PWA verification and retained certified artifacts.

## Release integrity

Signal Earth 2.0 remains a static GitHub Pages application with no runtime backend, account service or telemetry dependency.

The final release pipeline requires:

- lockfile-backed `npm ci` on pinned Node/npm;
- TypeScript and the complete unit-test suite;
- production build and package/PWA verification;
- startup-performance verification;
- stable-release integrity verification;
- the seven-project Playwright production matrix;
- successful GitHub Pages deployment;
- agreement between package version, in-app version, `release.json`, service-worker cache namespace and exact Git commit identity.

The GitHub Release is created only after the exact production SHA has passed verification, cross-browser QA and deployment. Its downloadable ZIP is assembled from the retained certified verification artifact rather than from a second build, and a SHA-256 checksum is published alongside it.

## Scientific and privacy boundaries

- USGS earthquakes remain observed source data.
- NASA EONET geometry is time-aware and is not extrapolated into invented tracks.
- NASA GIBS imagery remains observation-time-aware and is not presented as forecast data.
- NOAA Kp/scales/solar wind/OVATION retain their distinct operational/model semantics.
- CelesTrak OMM positions are locally propagated context, not measured live positions.
- Orbit remains bounded to the existing ±24-hour trust window.
- Observer location is ephemeral unless persistence is explicitly requested.
- Saved Worlds and share links exclude observer coordinates and accessibility preferences.
- Briefings and signal explanations are deterministic; no generative model writes scientific interpretation.

## Platform note

Automated release certification covers Chromium, Firefox and WebKit on desktop, ultrawide Chromium, Android/Chromium emulation, iPhone/WebKit emulation and iPad/WebKit emulation. Physical-device visual/touch smoke testing remains a separate manual check.

## Deployment

Production: **https://thiepn.dev/signal-earth/**
