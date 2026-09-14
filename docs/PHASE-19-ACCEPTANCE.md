# Phase 19 — Observatory UX 2.0 — Acceptance

## Goal

Turn Signal Earth from a technically capable observatory prototype into a coherent, legible exploration product without changing its scientific trust model or backend-free architecture.

## Implemented

- Cleaner top-level hierarchy with **Now** and **Search** visually prioritized over secondary tools.
- Contextual layer controls: one focused layer exposes detailed controls instead of permanently expanding all five control stacks.
- Layer semantic badges distinguish **OBS**, **NRT**, and **PROP** presentation context.
- Zoom-aware country/city context and subtle Natural Earth country borders are rendered through an isolated Globe.gl geographic-context renderer.
- Geographic context degrades to a sparse country-only set on reduced rendering quality and fails non-fatally if the presentation asset cannot load.
- Earthquakes, natural events, and satellites expose lightweight hover-before-click previews on fine-pointer devices.
- Hover previews are suppressed on coarse-pointer/touch devices and cleared on selection, disable, temporal discontinuity, or renderer disposal.
- The desktop inspector is visually removed when there is no primary selection, allowing the globe/timeline to occupy more useful space.
- Mobile retains its existing Now / Layers / Here / Time / Inspect dock while Search remains directly accessible from the compact top bar.
- Existing keyboard, share, briefing, Time 2.0, Weather, Orbit and Above Me behavior remains intact.
- App version advances to **1.4.0**.

## Trust / architecture constraints

1. Geographic labels and borders are presentation context, not a new measured-data source.
2. Natural Earth context failure must never affect the globe or signal layers.
3. Hover previews only summarize already-loaded source data; they do not generate interpretations.
4. Current observed / near-real-time / propagated / forecast semantics remain unchanged.
5. High-frequency render state remains outside React application state.

## Verification

- [x] TypeScript passes.
- [x] **31** unit-test files pass.
- [x] **101** unit tests pass, including four geographic-context tests.
- [x] Production Vite build passes.
- [x] Release verification passes with **15** safe service-worker precache entries.
- [x] Certified branch build size: approximately **13.58 MB**.
- [ ] Clean-branch certification after temporary Phase 19 staging machinery is removed.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
