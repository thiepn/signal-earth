# Phase 20 — Signal Intelligence — Acceptance

## Goal

Turn selected Signal Earth data into understandable, source-grounded context without introducing generative claims, hidden enrichment, or semantic drift between observed, near-real-time, propagated, modeled and forecast data.

## Implemented

- Reusable deterministic **Signal Intelligence** model with explicit tone, summary, derived facts and methodology.
- Earthquake intelligence derived from USGS magnitude, depth, MMI, felt reports, alert color, tsunami flag and significance score.
- The USGS tsunami field is explicitly described as a provider flag rather than evidence that a tsunami occurred.
- Earthquake depth regime and attention level are derived without replacing the raw USGS fields.
- NASA EONET natural-event intelligence derives event duration, number of applicable geometry reports, representative first-to-latest displacement, cumulative reported track and latest severe-storm translation.
- EONET calculations use only geometry whose timestamp is at or before the selected simulation time.
- EONET representative-point movement is explicitly not presented as footprint size or impact area.
- Satellite intelligence derives orbital period from OMM mean motion plus inclination, eccentricity class and selected-time offset from the element epoch.
- Satellite intelligence explicitly states that positions are locally propagated from CelesTrak OMM elements rather than measured live positions.
- Element timing beyond 24 hours is surfaced as a watch-level context cue even though Orbit itself remains subject to the existing ±24-hour temporal availability boundary.
- NOAA Space Weather intelligence combines simulation-time Kp, applicable G/R/S scales, applicable solar-wind observations and OVATION validity into a plain-language activity summary.
- Current-only NOAA G/R/S scales and solar-wind values are never backfilled into unrelated replay or future time.
- Intelligence cards show a **DERIVED** badge and a methodology footer so users can distinguish provider data from local interpretation.
- Raw source fields remain visible in the inspector above intelligence cards.
- App version advances to **1.5.0**.

## Trust / safety constraints

1. No generative model is used to interpret live event data.
2. No external enrichment API is introduced.
3. Derived statements must be reproducible from the provider record already loaded in the browser.
4. Provider flags remain provider flags and are not upgraded into event claims.
5. Geometry-derived distances describe representative source positions, not impact area.
6. Satellite orbital mechanics are derived from OMM fields and do not imply measured real-time tracking.
7. Current-only NOAA products remain constrained by their existing time-validity checks.
8. Existing source attribution and freshness indicators remain visible.

## Verification

- [ ] TypeScript passes.
- [ ] Signal Intelligence unit tests pass.
- [ ] Full unit-test suite passes.
- [ ] Production Vite build passes.
- [ ] Release verification passes with a safe service-worker precache.
- [ ] Clean branch certification passes.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
