# Phase 26 — Real-World QA & Interaction Hardening — Acceptance

## Goal

Turn Signal Earth’s browser/device interaction reliability into a maintained release surface rather than a one-off manual check. Phase 26 must exercise the production build across the major browser engines and representative desktop/mobile/tablet layouts, harden failures discovered by that matrix, and keep optional/deferred-feature failures from taking down the observatory shell.

Phase 26 does not claim physical-device certification. Browser device profiles remain automated emulations on GitHub-hosted Linux runners; real-device visual/touch testing remains a separate manual acceptance step.

## Implemented

- Added a production-build Playwright suite covering:
  - startup and horizontal viewport containment
  - Search keyboard opening, focus, bundled-city navigation and dismissal
  - primary desktop/mobile panels and sheets
  - Time controls and deterministic playback state
  - Saved Worlds create/delete behavior
  - OS reduced-motion reflection in settings
  - external-provider failure isolation
  - service-worker-backed offline reopening after lazy tools have been used
  - mobile portrait/landscape orientation changes
  - rejected deferred Search chunk containment
  - rejected globe chunk containment with a still-recoverable application shell
- Added seven CI browser/device projects on isolated jobs so several WebGL observatories do not compete for one hosted runner’s CPU/GPU budget:
  - Chromium desktop
  - Firefox desktop
  - WebKit desktop
  - Chromium ultrawide desktop
  - Android/Chromium emulation
  - iPhone/WebKit emulation
  - iPad/WebKit emulation
- Added local lazy-feature error boundaries for deferred Search, Display/Settings, Dynamic Briefings launcher, Above Me, Signal Earth Now, Inspector/Signal Intelligence, and the GlobeViewport renderer.
- Hardened Natural Earth country-search loading into a single-flight shared request/cache. Concurrent consumers no longer duplicate the country payload, and one caller aborting does not cancel the shared load for other callers.
- Added country-loader regression tests for shared concurrent loading and per-caller abort behavior.
- Hardened WebKit globe-material transitions against transient/null Globe.gl material color fields observed during Earth → Night mode changes.
- Changed mobile QA from asserting a specific CSS-positioning implementation to asserting actual rendered geometry and reachability inside the viewport.
- Hosted Chromium is explicitly exercised through Signal Earth’s constrained Auto/low-quality production path by supplying low CPU/memory capability hints; the viewport, touch/device emulation, application code, providers, and UI interactions remain otherwise unchanged.
- The exhaustive primary-panel mobile scenario retains strict action/assertion timeouts while receiving a larger total test budget. This prevents hosted Chromium’s software WebGL renderer (SwiftShader) from exhausting the scenario-wide deadline after the earlier panel checks have already succeeded.
- Synthetic lazy-chunk failure tests block service workers only inside their own describe scope. Normal QA keeps service workers enabled, including offline acceptance; fault injection can therefore deterministically intercept the requested lazy module instead of receiving it from the production service-worker cache.

## Defects found and closed by the Phase 26 matrix

### WebKit material transition failure

A Globe.gl material field could temporarily be null/undefined while switching visual modes, producing a WebKit-only runtime failure. Material-color writes are now guarded rather than assuming the field is always populated.

### Duplicate Natural Earth country loading

App initialization and Search could request the same Natural Earth country payload concurrently. The loader now shares one in-flight request and preserves independent caller-abort semantics.

### Deferred module failure escalation

A rejected dynamic import could previously escape the lazy feature and collapse the React tree. Deferred features now fail inside local boundaries with recoverable feature-level UI.

### Chromium fault-injection false negative

The production service worker could satisfy a deferred module from cache before Playwright’s request route saw it, making chunk-failure injection nondeterministic. The two synthetic chunk-failure tests now block service workers only for those tests.

### Android/Chromium hosted-runner timeout

The exhaustive mobile-panel test successfully opened and dismissed the primary sheets but consumed the original 60-second scenario budget under hosted Chromium’s software WebGL renderer. The scenario now has a 120-second total budget while per-action and expectation deadlines stay strict; this changes the harness budget, not product behavior.

## Automated browser/device acceptance

Cross-browser QA run **35119996731** against implementation head `80a96bbd858bebd4af955cd69ea07d1efffba724` completed successfully on 2026-09-16.

| Project | Result |
|---|---|
| Chromium desktop | PASS |
| Firefox desktop | PASS |
| WebKit desktop | PASS |
| Chromium ultrawide | PASS |
| Android Chromium emulation | PASS |
| iPhone WebKit emulation | PASS |
| iPad WebKit emulation | PASS |

The matrix uses isolated GitHub Actions jobs. Failure artifacts are retained only when a project fails.

## Release verification

Verify V1 run **35119996692** against the same implementation head completed successfully.

- [x] TypeScript passes.
- [x] **38/38** unit-test files pass.
- [x] **142/142** unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes.
- [x] Performance verification passes.
- [x] Production site package: approximately **13.97 MB**.
- [x] Startup service-worker precache: **24** shell assets.
- [x] HTML-linked JavaScript: approximately **437.4 kB raw / 139.2 kB gzip**.
- [x] **10** deferred JavaScript chunks remain outside the startup graph, approximately **2,012.6 kB raw** combined.
- [x] Full seven-project cross-browser/device-emulation QA matrix passes.
- [x] Provider failure isolation passes.
- [x] Offline reopening after lazy-feature use passes.
- [x] Search and globe deferred-chunk failure containment passes.
- [x] Mobile orientation and viewport-containment checks pass.
- [ ] Physical-device visual/touch smoke testing remains a separate manual acceptance step.

## Scope and trust constraints

1. Phase 26 changes interaction reliability, test coverage, and failure containment; it does not alter provider data semantics or scientific interpretation.
2. No runtime backend, account system, telemetry service, generative model, or new scientific provider is introduced.
3. USGS, NASA EONET/GIBS, NOAA SWPC, CelesTrak, and Open-Meteo retain their existing source/validity semantics.
4. CelesTrak positions remain locally propagated context inside Signal Earth’s existing ±24-hour Orbit trust window.
5. Observer-location privacy behavior is unchanged.
6. Service workers remain enabled in normal production QA. They are blocked only inside the two synthetic lazy-module network-failure tests.
7. Browser device profiles are not physical-device certification. Final touch feel, platform browser chrome, real GPU behavior, thermal constraints, and OS-specific visual differences still require manual hardware smoke testing.

## Acceptance

Phase 26 is accepted when the implementation head has a green release gate and a green seven-project cross-browser QA matrix, and this acceptance record is present on the phase branch. The implementation head `80a96bbd858bebd4af955cd69ea07d1efffba724` satisfies the automated product gates; this documentation-only closure commit does not alter executable behavior.
