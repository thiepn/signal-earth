# Signal Earth 2.1.1

Signal Earth 2.1.1 is an emergency runtime-performance hotfix for the 2.1 observatory visual release. It does not add product features or change scientific data semantics.

## Runtime fixes

- Removes `backdrop-filter` / `-webkit-backdrop-filter` from chrome that overlaps the continuously animated WebGL globe, replacing live blur with near-opaque observatory surfaces.
- Auto rendering quality no longer guesses High from CPU/RAM hints. It begins at Low or Medium and may promote only after sustained measured frame health.
- Auto quality now evaluates average FPS together with p95 frame time and long-frame rate; degradation is intentionally fast and is not blocked by an upgrade cooldown.
- Pixel ratio is capped at 1.0 / 1.25 / 1.6 for Low / Medium / High instead of 1.0 / 1.5 / 2.0.
- Satellite caps are reduced to 220 / 400 / 600 and star budgets to 600 / 900 / 1400.
- Atmosphere raster, haze and night-light sphere tessellation is reduced because those overlays do not benefit from the former dense geometry.
- Orbit bulk transforms update at 20 Hz on Low, 30 Hz on Medium and display cadence on High; satellite instance colors are uploaded only when the rendered set or selection changes.
- Top-level simulation-clock synchronization is reduced from 250 ms to 1 s. Explicit play/pause/speed/seek/live actions still synchronize immediately.
- Global Search documents are now built from stable loaded datasets instead of being regenerated from temporally filtered arrays every clock tick; this removes repeated full satellite-catalog allocations while Search is closed.
- Disabled Earthquake, Natural Events and Aurora renderers no longer receive passive clock-driven model updates until they are enabled.
- Low quality relies on the built-in globe atmosphere instead of stacking the additional full-globe haze shader.
- The nearly invisible masked full-screen decorative grid is disabled to remove another continuous composite over WebGL.

## Regression protection

- Unit tests enforce the new GPU budgets, p95/long-frame quality response, compositor rule, clock cadence and Orbit update invariants.
- Production Playwright QA now includes a five-second Chromium animation-cadence smoke gate after startup settles and verifies that key chrome has no live backdrop blur.
- Existing deterministic install, TypeScript, unit, build, package/PWA, performance-budget, release-integrity and seven-target interaction QA remain mandatory.

## Product boundary

No provider contract, normalized data schema, IndexedDB schema, observer privacy behavior, Saved Worlds behavior, service-worker reliability contract, astronomical/orbital math, or primary workflow semantics are changed by this patch.
