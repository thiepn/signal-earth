# Phase 6 Acceptance — Satellite Engine

## Implemented

- CelesTrak GP JSON / OMM provider using curated `STATIONS`, `WEATHER`, `RESOURCE`, `GNSS`, and `SCIENCE` groups.
- Two-hour minimum IndexedDB/memory cache window with no force-refresh bypass.
- Partial-group failure handling and 24-hour stale fallback.
- OMM normalization with six-digit NORAD ID support and cross-group deduplication.
- Dedicated Web Worker owns `satellite.js` SatRec objects and SGP4 propagation.
- Worker returns transferable `Uint32Array` indices + packed `Float32Array` telemetry.
- Main-thread orbit renderer uses `THREE.InstancedMesh`, quality caps, category colors, raycast selection, and true altitude scale.
- Approximately one propagation frame per second; render-loop interpolation removes visual stepping without SGP4 work on the UI thread.
- Orbit category filters and provider freshness/partial/error UI.
- Satellite selection uses the canonical SignalEntity model and inspector.

## Explicitly deferred to Phase 7

- camera following of satellites
- complete orbit paths
- ground tracks
- orbit-plane camera mode
- true-scale / exaggerated visual-scale toggle

## Explicitly deferred to Phase 8

- high-speed simulation-aware interpolation tuned for 100x/1000x time
- predictive multi-sample propagation for smooth accelerated playback

## Provider rule

CelesTrak is never deliberately re-requested within the two-hour cache window. The application does not use the large `ACTIVE` group.
