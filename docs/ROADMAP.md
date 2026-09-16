# Signal Earth — Roadmap

## Phase 0 — Product Specification & Architecture

Status: **implemented scaffold**.

Deliverables: contracts, repository structure, docs, tests, static deployment workflow.

## Phase 1 — Globe Engine

Status: **implemented**.

Three.js/Globe.gl scene, local Earth textures, atmosphere/stars, camera interaction, coordinate utilities, responsive/fullscreen canvas, adaptive quality, metrics and renderer lifecycle.

## Phase 2 — Application Shell & UI

Status: **implemented**.

Responsive desktop/mobile shell, canonical selection/focus flow, layer state, timeline controls, bottom sheets, quick navigation, settings/metrics and loading/error/empty states.

## Phase 3 — Earth Systems Foundation

Status: **implemented**.

Central astronomical time, Sun/day-night illumination, stylised night-side lights, four visual modes, and sidereal celestial-frame motion driven by the authoritative simulation clock.

## Phase 4 — Earthquakes

Status: **implemented**.

USGS adapter, automatic refresh, IndexedDB stale fallback, normalization/validation, non-earthquake event rejection, instanced rendering, magnitude/time-window filters, selection/focus integration, inspector metadata and pulse effects.

## Phase 5 — Timeline 1.0

Status: **implemented**.

±24h live/replay/future simulation, presets, boundary-safe accelerated playback, simulation-time-aware seismic visibility, time-safe selection and shared desktop/mobile timeline controls.

## Phase 6 — Satellite Engine

Status: **implemented**.

CelesTrak OMM provider, strict two-hour IndexedDB policy, curated groups, satellite.js worker propagation, transferable typed-array transport, category filtering, instanced rendering and satellite selection.

## Phase 7 — Orbit Interaction

Status: **implemented**.

Selected-satellite halo, one-orbit path generation, ground track, follow camera, orbit-plane framing, manual camera cancellation and true/visual altitude scale.

## Phase 8 — Orbit + Time

Status: **implemented**.

Speed-aware predictive ephemeris windows, high-speed interpolation, temporal-discontinuity handling, simulation-time-aware orbit/ground-track refresh, and selected past/future trail windows.

## Phase 9 — NASA Natural Events

Status: **implemented**.

NASA EONET v3 adapter, IndexedDB freshness/stale fallback, curated severe-storm/wildfire/volcano categories, timestamped Point/Polygon normalization, event-specific instanced markers, storm track progression, selected polygon outlines, selection/inspector integration and shared timeline semantics.

## Phase 10 — Space Weather & Aurora

Status: **implemented**.

NOAA SWPC multi-product adapter, five-minute browser cache, Kp observed/estimated/predicted timeline semantics, current G/R/S scales, current solar-wind summary observations, recent operational messages, OVATION validity-window handling, north/south aurora controls, quality-bounded globe rendering and Night-mode integration.

## Phase 11 — Above Me

Status: **implemented**.

Explicit opt-in browser geolocation, ephemeral-by-default observer state, local Sun/Moon geometry, sunrise/sunset, Open-Meteo current conditions, observer-relative satellite look angles, ISS pass prediction, local OVATION context, Earth observer marker and polar My Horizon visualization.

## Phase 12 — Search & Commands

Status: **implemented**.

Local-first ranked search across simulation-time-valid earthquakes/events, loaded satellites, bundled cities, Natural Earth countries, layers/categories/modes, plus deterministic keyboard commands over the existing application action/camera/time paths.

## Phase 13 — Cinematics & Briefings

Status: **implemented**.

Cancellable declarative tour engine, reversible session snapshots, cinematic camera choreography, automatic signal selection, Earth Now, Orbit Now, Planet in Motion and Night Earth briefings, manual-camera interruption and deterministic briefing commands.

## Phase 14 — Device, Performance & Accessibility Certification

Status: **implemented and certified**.

Reduced-motion/high-contrast behavior, keyboard/focus hardening, coarse-pointer targets, device-tier performance budgets, adaptive-quality hysteresis/recovery, P95/long-frame metrics, WebGL lifecycle recovery, visibility-aware background scheduling and formal device/browser certification protocol.

## Phase 15 — V1 Release

Status: **implemented and shipped**.

Human-readable share URLs, PNG capture, optional browser recording, installable PWA metadata, generated offline precache, deterministic release commands, production bundle verification, GitHub Pages release workflow and final V1 release audit.

## Phase 16 — Signal Earth Now

Status: **implemented**.

First-class live discovery feed ranked from loaded USGS, NASA EONET, NOAA SWPC, CelesTrak and local-observer context; one-click focus into existing globe interactions; automatic lazy loading while the Now surface is open; mobile/desktop Now navigation; nearby-city geographic context; richer earthquake, natural-event and satellite inspector explanations; deterministic ranking and geography tests.

## Phase 17 — Living Earth

Status: **implemented**.

Observation-time-aware atmospheric presentation using NASA GIBS cloud imagery, optional precipitation context, severe-storm tracks, Earth texture improvements and clearer observed-versus-forecast semantics.

## Phase 18 — Time 2.0

Status: **implemented**.

Extended 24H/7D/30D historical ranges, bounded +24H future simulation, accelerated playback, guided 24H replay and stronger cross-layer simulation-time semantics.

## Phase 19 — Observatory UX 2.0

Status: **implemented**.

Contextual layer controls, zoom-aware geographic context, hover-before-click previews, selection-driven inspector behavior and refined mobile bottom-sheet workflows.

## Phase 20 — Signal Intelligence

Status: **implemented**.

Deterministic derived context for selected signals while keeping provider facts, source flags and derived interpretations clearly separated.

## Phase 21 — Above Me 2.0

Status: **implemented**.

Improved local sky/horizon presentation, observer astronomy, weather context, local aurora context, satellites above the observer and ranked ISS opportunities with explicit visibility caveats.

## Phase 22 — Orbit 2.0

Status: **implemented**.

Richer selected-satellite mechanics, orbit class/program context, sunlight state, ascending/descending motion, improved ground tracks and interaction controls while retaining the ±24-hour trust window.

## Phase 23 — Dynamic Briefings 2.0

Status: **implemented**.

Provider-driven deterministic briefings with LIVE/CACHED/PARTIAL source state, frozen playback definitions, unavailable-section omission and curated cinematic tours retained where appropriate.

## Phase 24 — Saved Worlds

Status: **implemented**.

Up to 24 named browser-local observatory presets built on the canonical public state representation, with load/update/copy/delete behavior and privacy-sensitive state deliberately excluded.

## Phase 25 — Performance Architecture 2.0

Status: **implemented and certified**.

Demand-loaded secondary UI, lazy globe boundary, deferred Orbit worker startup, smaller startup service-worker precache and enforceable startup-JavaScript performance budgets.

## Phase 26 — Real-World QA & Interaction Hardening

Status: **implemented, certified and shipped**.

Seven-project Playwright production matrix across Chromium/Firefox/WebKit plus desktop/mobile/tablet/ultrawide profiles; provider failure and offline reopening scenarios; lazy-module containment; WebKit renderer hardening; mobile geometry/orientation checks; and permanent cross-browser regression coverage.

## Phase 27 — Data Reliability 2.0

Status: **implemented and certified**.

One shared reliability contract for USGS, NASA EONET, CelesTrak, NOAA SWPC and Open-Meteo: validated memory/IndexedDB/network/stale fallback flow, request coalescing with independent caller cancellation, bounded deterministic retry/backoff, rate-limit classification, offline short-circuiting, corrupt-cache recovery, source-timestamp auditing, partial-provider preservation, live provider-health diagnostics and dedicated reliability regression tests.

Phase 27 preserves existing normalized cache schemas and provider trust semantics. It does not introduce a backend, telemetry service, cloud account system, generative interpretation layer, new scientific provider or new primary globe layer.

## Phase 28 — Visual & Motion Finish

Status: **implemented and certified**.

Final design-system closure without a redesign: unified typography and spacing hierarchy, refined observatory surfaces, shared motion/easing tokens, panel/Search/sheet/timeline/toast transitions, improved loading and empty states, clearer focus/hover/selection treatment, earthquake marker hover emphasis, responsive-density corrections, high-DPI hairlines, stronger high-contrast presentation and explicit reduced-motion polish.

Phase 28 is deliberately presentation-only. It does not change data providers, scientific semantics, storage schemas, product workflows or startup JavaScript architecture.

## Next planned phases

- **Phase 29 — Release Hardening:** comprehensive final audit, defect closure, packaging and release-candidate certification.
- **Phase 30 — Signal Earth 2.0:** final production promotion and release closure.
