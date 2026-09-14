# Phase 16 — Signal Earth Now — Acceptance

## Goal

Turn Signal Earth from a capable exploration sandbox into a product that immediately answers **what matters on Earth right now?** without requiring the user to understand layers first.

## Implemented

- **Now** is a first-class top-bar action and mobile dock destination.
- Opening Now lazily loads the current earthquake, natural-event, orbit and space-weather feeds even when their globe layers are hidden.
- Current signals are ranked locally and deterministically; no AI text generation is used to invent or summarize events.
- The ranking deliberately limits duplicate categories: at most two earthquakes and one featured item per NASA natural-event category.
- Strong earthquakes incorporate magnitude, significance, recency, alert level and tsunami flag.
- Natural events incorporate category importance, observation history and freshness.
- Space-weather ranking uses current Kp and NOAA G/R/S scales.
- ISS orbital context is discoverable even if the Orbit layer was previously disabled.
- Above Me contributes the next ISS pass when an observer location/pass forecast exists.
- Selecting a Now card returns to LIVE time, enables the required layer/category, selects the entity and flies/focuses the globe using the existing canonical interaction paths.
- Space-weather cards stage the aurora layer and Night presentation without pretending modeled data is observed.
- Nearby-city context is derived from Signal Earth's bundled city navigation set and clearly distance-qualified.
- Inspector panels now add concise **Why it matters / Geographic context / Orbit context** blocks.
- Keyboard shortcut: **N** opens Signal Earth Now.
- App version advanced to **1.1.0**.

## Ranking safety / trust rules

1. Provider facts remain attributed to their source.
2. Observed, propagated and modeled data remain distinct.
3. Ranking is product prioritization, not an emergency-alert system.
4. No risk, casualty, damage or visibility claim is inferred without source data.
5. Geographic context is approximate and uses only the bundled city reference set.

## Acceptance checks

- [x] Deterministic ranking unit tests.
- [x] Geographic-context unit test.
- [x] Desktop and mobile component integration.
- [x] Existing selection/focus/follow paths reused rather than duplicated.
- [x] Hidden data layers can contribute to Now without becoming visually enabled.
- [ ] Real-device interactive smoke test after deployment.
