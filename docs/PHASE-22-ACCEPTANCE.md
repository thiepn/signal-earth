# Phase 22 — Orbit 2.0 — Acceptance

## Goal

Turn the Orbit layer from a satellite point cloud with basic tracks into a deeper orbital observatory: expose reproducible orbital mechanics, current sunlight/shadow state, ground-track direction and constellation context while improving large-catalog rendering and preserving the existing CelesTrak/SGP4 trust boundary.

## Implemented

- New deterministic **Orbit 2.0 mechanics** module over the loaded CelesTrak OMM record.
- Orbital period is derived from OMM mean motion.
- Semi-major axis is derived from mean motion using the standard Earth gravitational parameter.
- Perigee and apogee altitude estimates are derived from semi-major axis + OMM eccentricity.
- Selected-time mean orbital phase is advanced from OMM mean anomaly, mean motion and element epoch.
- Orbit class is surfaced as **LEO / MEO / GEO / HEO** using mean-element period, apsides and eccentricity.
- Major constellation/program names are recognized locally from loaded satellite names (for example Starlink, OneWeb, GPS, Galileo, GLONASS, BeiDou, Iridium and Sentinel).
- Selected-time sunlight state is calculated locally with `satellite.js` propagation plus `sunPos` / `shadowFraction` and exposed as sunlit, penumbra or Earth shadow.
- Ascending / descending ground-track state is derived from propagated latitude immediately before and after the selected timestamp.
- Selected-satellite inspector now exposes altitude, velocity, apsides, orbital period, mean phase, orbit class, ground-track leg, illumination state and constellation/program context.
- Satellite hover previews surface orbit class, ascending/descending state, illumination and constellation context before selection.
- Selected ground tracks are now visually separated: ascending segments are solid while descending segments are dashed/dimmer.
- Quality-capped satellite rendering uses **stratified catalog sampling** instead of taking the first N active records, reducing provider-order bias in very large catalogs.
- Selected satellites are still forced into the rendered subset even when the quality cap is active.
- Orbit controls explain the new LEO/MEO/GEO/HEO and ASC/DESC presentation semantics.
- Existing Follow, Orbit View, temporal trails, true/visual altitude scaling and ground-track toggles remain intact.
- App version advances to **1.7.0**.

## Trust / orbital semantics

1. CelesTrak OMM remains the sole orbit-data source; Phase 22 adds no new remote provider.
2. Displayed spacecraft positions remain locally propagated SGP4/SDP4 positions, not measured live tracking.
3. Perigee/apogee and mean phase are **mean-element derivations** and are presented as orbital context, not precision orbit determination.
4. Sunlight/shadow is derived from the propagated selected-time ECI position and Earth-shadow geometry.
5. Constellation/program labels are deterministic name classification and do not alter the source record.
6. Orbit remains unavailable outside the existing certified ±24-hour window around the current OMM epoch context used by Signal Earth.
7. Visual altitude mode remains explicitly exaggerated; true altitude remains the default.
8. Ground-track ASC/DESC styling describes motion direction only; it does not imply sensor swath, coverage or communications footprint.

## Verification

- [x] TypeScript passes on the functional Phase 22 branch.
- [x] **6/6** Orbit 2.0 mechanics tests pass.
- [x] **34/34** unit-test files pass.
- [x] **122/122** total unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes with **15** safe service-worker precache entries.
- [x] Functional Phase 22 production package: approximately **13.84 MB**.
- [ ] Exact v1.7.0 branch-head certification passes.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
