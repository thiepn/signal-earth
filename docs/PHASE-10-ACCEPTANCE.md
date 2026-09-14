# Phase 10 — Space Weather & Aurora Acceptance

Status: **implemented**

## Scope

Phase 10 adds NOAA SWPC space-weather state and the first model/forecast field rendered directly around Earth while preserving the static GitHub Pages architecture and the Phase 0 temporal-semantics rules.

## Provider acceptance

- [x] NOAA SWPC fixed endpoint allowlist
- [x] planetary Kp history/forecast
- [x] current NOAA G/R/S scales
- [x] current solar-wind speed and IMF summary
- [x] recent SWPC operational messages
- [x] latest OVATION aurora model
- [x] per-endpoint independent failure handling
- [x] partial snapshot state when only some NOAA products fail
- [x] five-minute browser cache TTL
- [x] two-hour stale-cache fallback
- [x] provider failure is not represented as quiet/zero space weather

## Temporal semantics

- [x] Kp retains `observed`, `estimated`, and `predicted`
- [x] Kp resolves by the selected three-hour simulation-time bucket
- [x] current solar wind is suppressed when replay/future time no longer matches the observation
- [x] current G/R/S scales are suppressed away from their current timestamp
- [x] OVATION retains both observation and forecast timestamps
- [x] OVATION is hidden outside its own validity window
- [x] Night mode affects appearance, never data semantics

## Aurora rendering

- [x] dedicated `AuroraRenderer`
- [x] packed `Float32Array` NOAA grid
- [x] 0..359 longitude normalized for the globe
- [x] polar/non-zero model-cell filtering
- [x] north and south fields independently toggleable
- [x] quality-dependent point caps
- [x] additive transparent Three.js point field
- [x] Night mode presentation emphasis
- [x] renderer resource disposal remains independent

## UI

- [x] Aurora primary layer marked LIVE
- [x] Kp at simulation time
- [x] explicit observed/estimated/predicted label
- [x] current NOAA G/R/S compact status
- [x] current solar-wind speed and IMF Bz
- [x] north/south aurora controls
- [x] model-valid/out-of-window state
- [x] direct Night-mode action
- [x] recent SWPC message summaries
- [x] partial/stale/unavailable status
- [x] manual refresh subject to normal client cache behavior
- [x] desktop/mobile share the same state path

## Explicit non-goals

Phase 10 does not add:

- solar imagery
- CME 3D simulation
- arbitrary GOES particle charts
- historical OVATION archives
- synthetic aurora forecasting beyond NOAA's supplied model
- local aurora visibility scoring (Phase 11 can combine location/night/space-weather context)
