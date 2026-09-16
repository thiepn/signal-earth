# Signal Earth 2.1.1

Signal Earth 2.1.1 is an emergency runtime-performance hotfix for the 2.1 observatory visual release. It does not add product features or change scientific data semantics.

## Runtime fixes

- Removes live `backdrop-filter` / `-webkit-backdrop-filter` blur from chrome that overlaps the continuously animated WebGL globe and removes the legacy blur declarations at their source.
- Auto rendering quality no longer guesses High from CPU/RAM hints. It begins at Low or Medium and may promote only after sustained measured frame health.
- Auto quality evaluates average FPS together with p95 frame time and long-frame rate; degradation is intentionally fast and is not blocked by an upgrade cooldown.
- Pixel ratio is capped at **0.5 / 1.0 / 1.4** for Low / Medium / High instead of 1.0 / 1.5 / 2.0. Low deliberately renders at half CSS-pixel resolution on constrained hardware rather than accepting severe frame loss.
- Satellite caps are reduced to **180 / 360 / 560** and star budgets to **240 / 800 / 1200**.
- Natural Earth country borders are converted from the globe polygon layer into one Three.js `LineSegments` geometry, collapsing many country-border draw objects into a single draw path while keeping geographic context visible. Low quality omits text labels while retaining those borders.
- Low quality uses substantially coarser base-globe curvature and removes decorative full-sphere atmosphere and city-light passes in normal Earth/Signal presentation; Night mode still keeps its night-light presentation.
- Solar-light/star-frame updates are reduced to 1 Hz on Low and 4 Hz on Medium while High retains the original fast cadence.
- Atmosphere raster, haze and night-light sphere tessellation is reduced. Cloud/precipitation meshes are now actually rebuilt when Auto changes quality so a downgrade cannot retain higher-tier geometry.
- Low-quality cloud rendering uses a simpler texture/coverage shader without per-pixel solar/world-normal lighting; Medium and High retain the richer lighting treatment.
- NASA GIBS raster requests are reduced to **512×256 / 1024×512 / 1536×768** for Low / Medium / High to lower texture upload and sampling pressure.
- Orbit bulk transforms are throttled by quality instead of recalculating every rendered satellite at display refresh rate; satellite instance colors are uploaded only when the rendered set or selection changes.
- Top-level simulation-clock synchronization is reduced from 250 ms to 1 s. Explicit play/pause/speed/seek/live actions still synchronize immediately.
- Global Search documents are built from stable loaded datasets instead of temporally filtered arrays every clock tick, removing repeated full satellite-catalog allocations while Search is closed.
- Disabled Earthquake, Natural Events and Aurora renderers no longer receive passive clock-driven model updates until enabled.
- The nearly invisible masked full-screen decorative grid is disabled to remove another continuous composite over WebGL.

## Regression protection

- Unit tests enforce the new GPU budgets, GIBS raster budgets, and p95/long-frame quality response.
- Production Playwright QA includes a five-second Chromium animation-cadence gate after startup settles and verifies that key chrome has no live backdrop blur.
- Existing deterministic install, TypeScript, unit, build, package/PWA, release-integrity and seven-target interaction QA remain mandatory.

## Product boundary

No provider contract, normalized data schema, IndexedDB schema, observer privacy behavior, Saved Worlds behavior, service-worker reliability contract, astronomical/orbital math, or primary workflow semantics are changed by this patch.
