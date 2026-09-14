# Phase 8 Acceptance — Orbit + Time Integration

Status: **implemented**

## Goal

Make the Phase 6 satellite engine, Phase 7 tracking interactions, and Phase 5 timeline behave as one coherent simulation under live, replay, and high-speed playback.

## Implemented

- adaptive prediction-window propagation in the orbit worker
- render-time interpolation against the authoritative `TimeEngine`
- speed-aware scheduling for 0× / 1× / 10× / 100× / 1000×
- large-seek / temporal-discontinuity detection
- stale-position suspension during discontinuous seeks
- out-of-order worker response rejection
- time-aware selected orbit regeneration
- time-aware selected ground-track regeneration
- temporal selected-satellite trails:
  - past 10 minutes
  - previous orbit
  - next orbit
- high-speed follow support using interpolated world positions
- explicit separation of orbital context paths and temporal trails
- no high-frequency satellite position arrays in React state

## Predictive window strategy

The worker does not need to run at rendering FPS. A profile selected from current playback speed determines request cadence, forward prediction horizon, and sample count. The renderer reads current simulation time each frame and interpolates between adjacent propagated samples.

```text
TimeEngine
   ↓
playback speed
   ↓
Prediction profile
   ↓
OrbitWorkerClient
   ↓
PROPAGATE_WINDOW
   ↓
SGP4 samples
   ↓
transferable typed arrays
   ↓
OrbitRenderer
   ↓
per-frame temporal interpolation
```

At `1000×`, a small multi-sample ephemeris window replaces the old single-frame interpolation model. This keeps motion continuous while leaving SGP4 in the worker.

## Seek integrity

Timeline jumps are treated differently from continuous playback. If the simulated timestamp differs materially from the expected time progression, the current predictive window is invalidated and stale markers are temporarily hidden until the fresh worker result arrives.

Signal Earth therefore never animates an arbitrary multi-hour seek as if it were physical satellite motion.

## Trail semantics

Temporal trails are distinct from the full orbit path:

- **PAST 10 MIN** — propagated interval `[t-10m, t]`
- **PAST ORBIT** — propagated interval `[t-period, t]`
- **NEXT ORBIT** — propagated interval `[t, t+period]`

The orbit path remains a full one-period context path centered on the simulation time. Ground track remains Earth-fixed context. All are recomputed from SGP4 at the current simulated timestamp.

## Acceptance criteria

- [x] Orbit playback reads from the central TimeEngine.
- [x] 10× / 100× / 1000× use predictive windows rather than visual-frame SGP4 calls.
- [x] Renderer interpolation bypasses React state.
- [x] Worker outputs use transferable typed arrays.
- [x] Large seeks invalidate old orbital state.
- [x] Old worker responses cannot overwrite newer time requests.
- [x] Follow mode uses the interpolated selected world position.
- [x] Selected path/ground geometry updates as simulation time advances.
- [x] Temporal trail mode can be changed without changing selection.
- [x] Visual scale applies consistently to satellite path/trail geometry.
- [x] Ground track remains Earth-surface-fixed.
- [x] Mobile inspector exposes the same trail controls as desktop.

## Deferred

Phase 8 does not add:

- local observer pass prediction (Phase 11)
- satellite illumination/shadow status
- historical archived element sets beyond current OMM propagation assumptions
- simultaneous orbit paths for the full satellite catalog
- cinematic tour scripting (Phase 13)
