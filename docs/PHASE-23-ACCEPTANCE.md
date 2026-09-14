# Phase 23 — Dynamic Briefings 2.0 — Acceptance

## Goal

Turn the Phase 13 cinematic-tour framework into a current-data briefing system without introducing generative narration or a second execution engine. Briefings should explain what Signal Earth’s existing public providers currently contain, choose useful tour sections deterministically, degrade honestly when sources are unavailable, and restore the user’s previous observatory state when finished.

## Implemented

- The existing cancellable `TourEngine` remains the sole briefing executor.
- Briefing definitions can now carry explicit **LIVE DATA / CACHED / PARTIAL / FALLBACK / UNAVAILABLE / CURATED** state.
- Opening the briefing launcher refreshes briefing inputs through the same existing provider/cache services used elsewhere in Signal Earth:
  - USGS day earthquake feed
  - NASA EONET natural events
  - CelesTrak curated OMM catalog
  - NOAA SWPC space-weather products
  - Open-Meteo current observer conditions only when a remembered observer coordinate already exists
- Valid provider cache entries are reused; expired entries follow each provider service’s normal refresh/stale-fallback policy.
- Dynamic definitions are composed before Play becomes available and then frozen for that tour start.
- New data-driven briefings:
  - **Earth Right Now** — current earthquake/event/orbit/space-weather overview with conditional highlights.
  - **Seismic Activity** — USGS day-feed counts, magnitude thresholds and strongest applicable event.
  - **Active Storms** — applicable NASA EONET severe-storm records and a source-observed featured system.
  - **Space Weather** — applicable NOAA Kp, G/R/S scales, solar-wind context, OVATION availability and recent operational-message count.
  - **Above Me** — remembered-observer Sun/Moon geometry, current Open-Meteo conditions and local OVATION model context.
  - **Orbit Highlights** — live curated-catalog count, recognized constellation/program context and conditional station/weather/navigation/Earth-observation stops.
  - **Last 24 Hours** — source-grounded USGS day recap plus recently active NASA EONET context; explicitly not a fabricated continuous replay.
- Existing **Planet in Motion** and **Night Earth** remain curated/static tours.
- Dynamic tours omit unavailable sections rather than inventing replacement facts.
- Provider failures are independent: one unavailable source can produce a PARTIAL briefing while the remaining sources continue to compose usable sections.
- `Above Me` never requests geolocation merely to generate a briefing. Without a remembered observer coordinate, the card is unavailable and explains the prerequisite.
- Current observer weather is never projected into future observing conditions.
- Launcher cards expose source state and a short snapshot summary before Play.
- Search/command aliases cover all Phase 23 briefing identities while preserving `last 24 hours` as the existing 24-hour replay command.
- App version advances to **1.8.0**.

## Trust / data semantics

1. No generative model writes event narration or selects facts.
2. Every dynamic number, name and status comes from an already-supported provider record or a deterministic local derivation.
3. Dynamic briefing refresh uses the same provider service/cache rules as the main application; it does not introduce a hidden enrichment backend.
4. A composed briefing is frozen before playback so an asynchronous provider refresh cannot rewrite narration halfway through a tour.
5. Tour execution still resolves selections against the application’s loaded records using the same deterministic selection rules; missing selections fail open rather than inventing substitutes.
6. USGS fields remain observed earthquake fields; provider alert/tsunami flags are not promoted into claims beyond their source meaning.
7. NASA EONET geometry remains source-observed history and is never extrapolated into an invented storm/event trajectory.
8. CelesTrak spacecraft positions remain locally propagated OMM context, not measured live positions.
9. NOAA Kp, G/R/S scales, solar wind and OVATION retain their distinct operational/model semantics and validity constraints.
10. `Above Me` uses only a coordinate the user previously chose to remember; Phase 23 does not trigger a location permission prompt.
11. Open-Meteo data in the observer briefing describes current conditions only, not future pass weather.
12. **Last 24 Hours** is a source-timestamp recap, not a synthetic cinematic reconstruction of unobserved intermediate states.
13. Partial or unavailable data is surfaced explicitly through briefing state chips; absent data does not become fabricated prose.

## Verification

- [x] TypeScript passes on the functional Phase 23 branch.
- [x] **9/9** dedicated Dynamic Briefings 2.0 composition tests pass.
- [x] Updated briefing-registry and deterministic command tests pass.
- [x] **35/35** unit-test files pass.
- [x] **131/131** total unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes with **15** safe service-worker precache entries.
- [x] Functional Phase 23 production package: approximately **13.92 MB**.
- [x] Exact v1.8.0 branch-head certification passes.
- [x] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
