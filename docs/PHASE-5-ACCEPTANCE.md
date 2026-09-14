# Phase 5 Acceptance — Timeline 1.0

Status: **implemented**

## Goal

Make simulation time a real product control rather than a decorative clock. Earth systems and observed earthquake visibility must follow one authoritative TimeEngine across LIVE, REPLAY and future simulation states.

## Implemented

- global ±24 hour simulation window
- live/replay/future semantic states
- timeline scrubbing with 0.05 hour resolution
- timeline presets: −24h, −6h, −1h, NOW, +6h, +24h
- playback speeds: 1×, 10×, 100×, 1000×
- explicit play/pause control
- explicit RETURN LIVE action
- hard boundary clamping at ±24h
- automatic stop when accelerated playback reaches a supported boundary
- top-bar LIVE / REPLAY / FUTURE state
- exact UTC date/time readout
- mobile and desktop use the same TimeEngine and actions
- earthquake markers become visible only once simulation time reaches their recorded USGS timestamp
- earthquake counts follow simulation time
- selected earthquakes are cleared if rewind moves before their event timestamp
- pulse eligibility uses simulation time rather than `Date.now()`
- future simulation never invents earthquake observations

## Time semantics

LIVE is the only state coupled to wall time.

Manual timeline seeking freezes at the selected absolute timestamp. Playback then advances from that moment at the selected simulation speed. Returning to the current clock requires the explicit LIVE action.

Observed data behaves differently from predictable systems:

- earthquake observations can disappear during replay before their recorded time
- future simulation retains the latest known earthquake observations but creates no new events
- Sun/day-night systems continue to calculate at future times
- Phase 8 will apply the same clock to propagated orbit state

## Data completeness rule

Timeline replay operates on the currently loaded USGS feed window. A 24-hour USGS snapshot therefore replays observations contained in that snapshot; Signal Earth does not claim a complete arbitrary historical archive.

The existing 1h / 24h / 7d / 30d controls remain data-window controls, while the global simulation timeline remains ±24 hours.

## Performance rule

The seismic renderer keeps its instanced earthquake catalog mounted and receives simulation-time updates separately. It does not rebuild the entire earthquake mesh every UI clock tick.

Future events are reduced to a near-zero instance scale until their event timestamp is reached. Pulse geometry is recreated only when the pulse candidate set actually changes.

## Acceptance checks

- TimeEngine core compiles under strict TypeScript checking.
- Manual seeks clamp to ±24 hours.
- Accelerated playback stops at the future boundary.
- Paused timestamps correctly age into replay state as real time passes.
- Timeline helper progress maps −24h → 0%, NOW → 50%, +24h → 100%.
- Earthquake visibility changes exactly at the event timestamp.
- Source syntax/transpile validation passes across the project.
- Runtime core timeline checks pass without external dependencies.
- No runtime backend or new dependency is introduced.

## Deferred

- backward playback
- arbitrary historical archive playback
- natural-event timeline integration (Phase 9)
- propagated satellite time integration (Phase 8)
- shared-link serialization of timeline state (Phase 14)
