# Phase 17 — Living Earth — Acceptance

## Goal

Make Earth itself feel alive by adding scientifically attributed near-real-time atmospheric context without turning Signal Earth into a generic weather dashboard.

## Implemented

- **Weather** is a first-class fifth layer and is enabled by default for new sessions.
- NASA EOSDIS GIBS supplies near-real-time global raster context:
  - VIIRS / Suomi NPP **Cloud Optical Thickness** for the cloud field.
  - GPM IMERG **Precipitation Rate (30-min)** for optional rain/snow intensity.
- NASA EONET severe-storm observations are reused as temporal storm tracks above the atmospheric raster.
- Weather imagery follows the simulation clock:
  - VIIRS requests the simulated UTC day.
  - IMERG requests the simulated half-hour.
  - future simulation does not invent observed imagery.
- Recent-earlier fallback is bounded and the UI reports the **actual loaded observation time** rather than silently pretending stale imagery matches the requested time.
- Cloud, precipitation and storm-track sublayers can be controlled independently.
- Overlay strength is user adjustable.
- Weather layer state and subsettings are encoded in share links.
- Search/commands understand atmosphere/cloud/precipitation weather-layer language without breaking the existing `weather` satellite category.
- A quality-aware renderer requests smaller global rasters on constrained devices.
- A sun-aware procedural atmospheric rim strengthens the Earth rendering. It is presentation only and is not labeled as measured atmospheric data.
- Raster/provider failures are non-fatal: Earth, other signal layers and offline shell continue working.
- App version advanced to **1.2.0**.

## Data semantics and trust

1. NASA raster imagery is **near-real-time / observed context**, not a forecast.
2. GIBS imagery availability can lag the live application clock.
3. The loaded observation timestamp is surfaced independently from simulation time.
4. Future simulation deliberately suppresses observed cloud/precipitation raster imagery.
5. EONET storm tracks remain observed event geometry.
6. The procedural atmospheric glow is decorative presentation, not a scientific measurement.
7. NASA/EOSDIS attribution is shown in the Weather controls.

## Acceptance checks

- [x] GIBS request construction unit tests.
- [x] UTC daily and half-hour temporal quantization tests.
- [x] Bounded fallback candidate tests.
- [x] Share-state round trip includes weather settings.
- [x] Weather command parsing preserves the weather-satellite category distinction.
- [x] Existing Earth/orbit/event layers remain independently toggleable.
- [ ] Real-device visual smoke test after deployment.
