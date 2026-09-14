# Phase 18 — Time 2.0 — Acceptance

## Goal

Make time a primary exploration dimension instead of a ±24-hour prototype slider: users can move through a month of observed Earth history, understand dataset coverage, and replay the previous day as a coherent sequence that stops safely at LIVE.

## Implemented

- Selectable timeline ranges: **24H / 7D / 30D**.
- The future side remains capped at **+24H**; historical replay extends to **−30D**.
- The NOW marker is mathematically positioned inside each asymmetric range instead of being hard-coded to the center.
- Range-dependent scrub precision keeps 24-hour interaction fine while avoiding impractical sub-minute steps across a month.
- Historical range selection automatically widens USGS feed coverage to day/week/month as needed without narrowing a user's already-wider earthquake feed.
- **24H REPLAY** starts exactly one day in the past, runs at 1000×, and automatically reconnects to LIVE when it catches wall time instead of continuing into future simulation.
- Visible earthquake and natural-event counts are shown beside the simulation clock during playback.
- Deep replay reuses existing timeline-aware event geometry, NASA GIBS historical raster requests, and earthquake event-time filtering.
- Current CelesTrak OMM propagation is explicitly limited to the existing certified **±24H** window. Satellite rendering, selected-orbit tracks and observer-relative satellite calculations are suppressed outside that window rather than being presented as trustworthy month-old orbit history.
- Timeline range is encoded in public share links while existing version-1 share links remain backward compatible.
- Deterministic commands support day units (`rewind 7d`) and a direct `replay 24h` command. Future command seeks remain capped at +24H.
- App version advances to **1.3.0**.

## Data semantics / trust

1. USGS earthquake replay is observed event history from the selected feed window.
2. NASA EONET event geometry is historical observation history and is never extrapolated into invented future tracks.
3. NASA GIBS cloud/precipitation imagery follows its own available historical timestamps and continues surfacing the actual loaded observation time.
4. NOAA space-weather products retain their existing validity semantics and may simply be unavailable outside supplied product history.
5. Current OMM elements are not treated as authoritative 30-day historical ephemerides.
6. Guided 24-hour replay stops at LIVE by design.

## Acceptance checks

- [x] Asymmetric TimeEngine bounds tests.
- [x] Guided replay-to-live stop test.
- [x] 24H / 7D / 30D timeline mapping tests.
- [x] Orbit temporal-availability tests.
- [x] USGS range-coverage helper tests.
- [x] Share-state range round trip.
- [x] Day-unit and replay command tests.
- [ ] Real-device interactive smoke test after deployment.
