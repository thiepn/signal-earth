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

Status: **implemented; production browser/device execution pending a successful dependency build**.

Reduced-motion/high-contrast behavior, keyboard/focus hardening, coarse-pointer targets, device-tier performance budgets, adaptive-quality hysteresis/recovery, P95/long-frame metrics, WebGL lifecycle recovery, visibility-aware background scheduling and formal device/browser certification protocol.

## Phase 15 — V1 Release

Status: **implemented at source/release-contract level; production build/browser execution pending successful dependency installation.**

Human-readable share URLs, PNG capture, optional browser recording, installable PWA metadata, generated offline precache, deterministic release commands, production bundle verification, GitHub Pages release workflow and final V1 release audit.


## Phase 16 — Signal Earth Now

Status: **implemented**.

First-class live discovery feed ranked from loaded USGS, NASA EONET, NOAA SWPC, CelesTrak and local-observer context; one-click focus into existing globe interactions; automatic lazy loading while the Now surface is open; mobile/desktop Now navigation; nearby-city geographic context; richer earthquake, natural-event and satellite inspector explanations; deterministic ranking and geography tests.
