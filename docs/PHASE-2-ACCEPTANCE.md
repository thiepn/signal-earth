# Phase 2 — Application Shell & UI Acceptance

Status: **implemented**

## Purpose

Phase 2 replaces the temporary Phase 1 engine harness with the permanent responsive application shell. It proves the interaction architecture using local state and surface-coordinate selections before live providers are introduced.

## Implemented

- responsive full-screen application shell
- desktop top bar, left layer panel, right inspector and bottom timeline
- mobile bottom dock and single-sheet interaction model
- four primary layer controls wired to canonical application state
- canonical globe-click `location` entity selection
- shared select → inspect → focus → clear flow
- camera focus/reset wiring without exposing raw Three.js objects to UI components
- TimeEngine controls for live, pause, replay/simulation offset and 1×/10×/100×/1000×
- corrected LIVE semantics: pause/acceleration detach from wall time; RETURN LIVE explicitly reattaches
- quick-navigation search shell with real camera destinations
- renderer quality/settings surface and live renderer metrics
- fullscreen control
- loading, renderer-error, empty, future-feature and toast surfaces
- keyboard controls: `/` search, `Space` play/pause, `R` reset, `Esc` close transient UI
- mobile `Here` shell that deliberately does not request location before Phase 11
- ActionBus route for canonical application-state actions

## Deliberately not implemented

- live provider fetching
- earthquake/event/satellite/aurora rendering
- day/night astronomical simulation
- real entity search
- user geolocation
- provider health/freshness UI beyond structural placeholders
- final visual-mode controls

Those belong to later dedicated phases.

## UX invariants exercised

1. The globe remains the primary canvas.
2. Exactly zero or one entity is selected.
3. Desktop and mobile use the same application actions and state.
4. Mobile has one open sheet at a time.
5. Search/settings/sheets are overlays, not alternate app pages.
6. No location permission is requested during Phase 2.
7. High-frequency renderer metrics remain outside canonical app state.
8. Time semantics are controlled only by `TimeEngine`.

## Verification performed in this environment

- all TypeScript/TSX files pass TypeScript syntax transpilation
- core action/state/time contracts pass strict TypeScript checking
- TimeEngine pause/acceleration/return-live behavior passes direct runtime checks
- Phase 1 renderer lifecycle remains isolated behind `GlobeViewportHandle`

A real `npm install`, Vite bundle, and browser E2E run could not be completed here because npm registry access timed out. GitHub Actions remains configured to perform the real dependency install, typecheck, tests, and production build after push.

## Definition of done

Phase 2 is complete when Phase 3 can drive Sun/day-night/visual state through the existing shell without changing the desktop/mobile navigation architecture or bypassing the central TimeEngine.
