# Phase 25 — Performance Architecture 2.0 — Acceptance

## Goal

Reduce Signal Earth’s startup JavaScript and unnecessary background/runtime work without weakening the observatory, changing provider semantics, or hiding the fact that the Three.js / Globe.gl renderer is still a large core dependency. Phase 25 should make secondary product systems genuinely demand-loaded, keep optional chunks out of service-worker installation, delay Orbit worker startup until Orbit/observer work is required, and make future performance regressions measurable in the release gate.

## Implemented

- Introduced explicit lazy boundaries while preserving the existing component import APIs used by `App.tsx`.
- The following heavier secondary systems now load through demand-driven implementation chunks:
  - Search overlay
  - Display / Settings and Saved Worlds
  - Dynamic Briefings launcher
  - Above Me controls
  - selected-object Inspector / Signal Intelligence
  - Signal Earth Now UI
- `GlobeViewport` now exposes the same public ref/callback surface while loading the full `GlobeViewportBase` renderer through an async boundary.
- The globe remains the primary application surface and is therefore requested immediately; Phase 25 does not pretend that the WebGL core is optional.
- Satellite hover now renders immediate basic telemetry without importing Orbit mechanics.
- Rich Orbit 2.0 hover context dynamically loads orbit mechanics only after satellite interaction actually requires it.
- `OrbitWorkerClient` no longer constructs the satellite worker in its constructor.
- Orbit worker startup is deferred until a catalog load, propagation, track, observer-sky, or pass-prediction request actually needs it.
- Setting Orbit categories or clearing an unused Orbit client does not start the worker.
- Existing hidden-tab interval behavior remains intact: visibility-aware timers sleep while the document is hidden.
- Service-worker installation no longer precaches every generated JavaScript chunk.
- The service worker now precaches the application/install shell while deferred feature chunks and the Orbit worker enter the existing runtime cache on first actual use.
- Added release verification that explicitly rejects:
  - the Orbit worker entering startup precache
  - `*Impl` lazy feature chunks entering startup precache
  - `GlobeViewportBase` entering startup precache
- Added a dedicated `performance:verify` release step that measures the JavaScript directly linked by the built HTML and verifies required deferred chunks remain outside that initial graph.
- Phase 25 startup-JavaScript regression budgets are:
  - **480 kB raw** maximum HTML-linked JavaScript
  - **145 kB gzip** maximum HTML-linked JavaScript
- The measured v1.10 build is below both budgets.
- GitHub Actions installs use `npm install --legacy-peer-deps --no-audit --no-fund` as a narrow workaround for the npm 10.9.8 Arborist peer-resolution crash observed on current hosted runners. Application dependency versions are unchanged.
- App version advances to **1.10.0**.

## Measured result

### Before Phase 25 — v1.9

- Main production JavaScript bundle: approximately **2,467.96 kB raw / 709.12 kB gzip**.
- Secondary UI, orbit-mechanics and core application code shared the same monolithic delivery path.

### Phase 25 — v1.10

- HTML-linked JavaScript graph: approximately **435.5 kB raw / 138.7 kB gzip**.
- Reduction in JavaScript directly linked from the HTML versus the former monolithic bundle:
  - approximately **82% raw**
  - approximately **80% gzip**
- **10 deferred JavaScript chunks**, approximately **2,012.5 kB raw** combined.
- Main application-shell entry chunk: approximately **315.28 kB raw / 95.17 kB gzip**.
- Full `GlobeViewportBase` WebGL core: approximately **1,966.30 kB raw / 556.38 kB gzip**.
- Orbit worker: approximately **28.52 kB**.
- CSS: approximately **84.97 kB raw / 15.69 kB gzip**.
- Production site: approximately **13.97 MB**.
- Startup service-worker precache: **24 shell assets**; deferred feature chunks and Orbit worker remain runtime-cached.

The roughly 80% reduction applies specifically to the HTML-linked JavaScript graph. It does **not** mean the fully interactive globe transfers 80% fewer bytes: the roughly 556 kB-gzip WebGL renderer remains an immediately requested async core chunk because Signal Earth is fundamentally a globe application.

## Performance / caching semantics

1. Lazy loading changes delivery timing only; it does not change provider data, scientific rules, application actions, or simulation-time semantics.
2. Search remains deterministic and local-first once opened.
3. Dynamic Briefings retain their deterministic provider-derived composition and existing source-state semantics.
4. Above Me retains the existing observer-location privacy model; deferring its UI does not introduce new location persistence or permission behavior.
5. Inspector/Signal Intelligence continues to expose raw source fields separately from deterministic derivations.
6. Satellite positions remain locally propagated CelesTrak OMM context and retain the existing ±24-hour Orbit trust boundary.
7. Lazy loading Orbit mechanics does not change its formulas or scientific interpretation; the first basic hover can render before the richer mechanics module is available.
8. The Orbit worker still performs the same propagation/observer calculations once activated; Phase 25 changes only when it is constructed.
9. Deferred feature chunks and the Orbit worker remain eligible for same-origin service-worker runtime caching after first use.
10. Startup precache is intentionally smaller than the total application. An optional feature that has never been opened is not guaranteed to work offline until it has been runtime-cached.
11. The remaining Vite large-chunk warning for the WebGL core is not suppressed. Phase 25 treats that warning as a visible architectural fact rather than increasing the warning threshold.
12. No runtime backend, account system, telemetry service, or new scientific provider is introduced.

## Verification

- [x] TypeScript passes.
- [x] **1/1** dedicated Phase 25 lazy-worker architecture test passes.
- [x] **37/37** unit-test files pass.
- [x] **140/140** total unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes.
- [x] Performance verification passes.
- [x] HTML-linked JavaScript: approximately **435.5 kB raw / 138.7 kB gzip**.
- [x] **10** deferred JavaScript chunks, approximately **2,012.5 kB raw** combined.
- [x] Startup service-worker precache: **24** shell assets.
- [x] Certified production package: approximately **13.97 MB**.
- [x] Exact v1.10.0 final branch-head certification passes.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
