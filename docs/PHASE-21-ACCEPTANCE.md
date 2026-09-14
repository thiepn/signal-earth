# Phase 21 — Above Me 2.0 — Acceptance

## Goal

Make the observer a first-class part of Signal Earth: answer what is happening above the user, which ISS passes have favorable viewing geometry, and how local darkness/current conditions affect observing — without weakening location privacy or claiming visibility Signal Earth cannot actually measure.

## Implemented

- New **What can I see?** observer summary combining local sky state, current optical conditions, satellites above 20°, aurora context and the strongest ISS opportunity in the next 24 hours.
- Sun/Moon panel now surfaces Sun azimuth/elevation, Moon azimuth/elevation, Moon illumination/phase, sunrise and sunset.
- Current above-horizon satellite list is ranked by elevation/viewing geometry and remains directly selectable into the existing globe/inspector flow.
- ISS pass forecast is expanded from one next-pass row into a ranked multi-pass timeline with rise, culmination and set times/directions, duration and maximum elevation.
- Orbit worker now uses satellite.js `sunPos` + `shadowFraction` to evaluate Earth-shadow fraction at each ISS pass culmination.
- Pass viewing quality combines observer darkness, maximum elevation and satellite sunlight at culmination.
- Excellent/good/daylight/eclipsed/limited states are deterministic and tested.
- Current optical-observing conditions combine local darkness with current Open-Meteo cloud cover only when that current weather observation is applicable to the selected simulation time.
- Current weather is never promoted into a future forecast for tonight.
- Aurora-at-observer remains NOAA OVATION model context and is explicitly not a visibility guarantee.
- Existing browser-location behavior remains explicit opt-in; persistence still occurs only after the user enables remembering.
- App version advances to **1.6.0**.

## Visibility trust model

1. “Excellent” or “Good” means **favorable viewing geometry**, not guaranteed naked-eye visibility.
2. Signal Earth does not currently model satellite apparent magnitude, atmospheric extinction, buildings, terrain, trees, haze or future cloud cover.
3. ISS illumination is computed from propagated CelesTrak elements and satellite.js Earth-shadow geometry at maximum elevation.
4. Observer darkness comes from the central simulation clock and local solar geometry.
5. Open-Meteo current conditions are used only near their observation time and are not backfilled into replay or projected into future passes.
6. Current above-horizon satellites remain propagated geometry; lack of illumination metadata in that live list is surfaced rather than guessed.
7. Location remains local-first and optional.

## Verification

- [x] TypeScript passes.
- [x] **6/6** Above Me 2.0 viewing tests pass.
- [x] **33/33** unit-test files pass.
- [x] **116/116** total unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes with **15** safe service-worker precache entries.
- [x] Certified branch production package: approximately **13.65 MB**.
- [x] Clean branch certification passes.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
