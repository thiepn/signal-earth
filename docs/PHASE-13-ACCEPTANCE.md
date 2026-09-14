# Phase 13 — Cinematics & Briefings Acceptance

Status: **implemented**

## Scope

Phase 13 turns the existing Earth/orbit/time systems into guided, deterministic experiences without introducing AI, a second simulation clock, direct renderer manipulation, or hard-coded fake signal data.

## Implemented

- reusable cancellable `TourEngine`
- declarative `BriefingDefinition` / `BriefingInstruction` model
- step progress, Next/skip and Exit controls
- dedicated briefing launcher for desktop/mobile
- explicit manual-camera interruption signal from `GlobeEngine`
- reversible pre-tour state snapshot
- current-data refs so async tours observe newly loaded provider data
- cinematic point-of-view API owned by `CameraController` / `GlobeEngine`
- briefing commands and `B` keyboard shortcut
- reduced-motion-safe UI transitions

## Briefings

### Earth Now

1. Stage live Earth signals and a useful seismic filter.
2. Focus the strongest currently applicable earthquake.
3. Focus a current high-value NASA EONET event.
4. Shift into NOAA space-weather/aurora context.
5. Hand off to ISS in low Earth orbit.
6. Return to a global Earth frame.

### Orbit Now

1. Stage the curated CelesTrak groups.
2. Follow ISS.
3. Frame a representative weather-satellite orbit.
4. Frame a navigation-satellite orbit.
5. Frame an Earth-observation orbit.
6. Return to orbital/global context.

### Planet in Motion

1. Return to LIVE and establish the shared clock.
2. Run at 100×.
3. Run at 1000×.
4. Show the moving terminator in Night mode.
5. Explicitly reconnect to LIVE wall time.

### Night Earth

1. Stage Night mode, orbit and aurora.
2. Frame northern auroral context.
3. Follow ISS over the night-facing planet.
4. Return to a wide night-Earth frame.

## State safety

A briefing snapshots:

- four primary layer states
- visual mode
- TimeEngine snapshot
- primary selection
- camera point of view
- orbit-category filters
- EONET-category filters
- earthquake window/magnitude filter
- orbit scale/trail/path settings

On normal completion or explicit Exit, those user settings are restored. Temporary time acceleration cannot leave the app running at 1000×.

Manual globe drag is treated differently: it cancels the automated briefing and restores non-camera state while preserving the new camera viewpoint chosen by the user.

## Camera ownership

`TourEngine` has no Three.js knowledge.

```text
TourEngine
   ↓ instruction
App executor
   ↓
GlobeViewportHandle
   ↓
GlobeEngine
   ↓
CameraController
```

Manual OrbitControls input emits through `subscribeManualCameraInput()` and wins over all automation.

## Data integrity

- strongest-earthquake selection comes from the current simulation-time-valid USGS set
- EONET selection comes from current reported geometry
- satellite selections come from the current CelesTrak catalog
- Kp/OVATION semantics remain unchanged from Phase 10
- no briefing invents future earthquakes, natural-event trajectories, satellite telemetry, aurora or weather

## Performance

- no new render loop
- no briefing-frame React updates beyond low-frequency step state
- no per-frame provider work
- orbit follow/orbit view reuse Phase 7/8 renderer + worker paths
- cinematic POV changes reuse Globe.gl / CameraController transitions

## Acceptance checks

- all four briefings have at least four deterministic steps
- TourEngine completes steps sequentially
- cancellation prevents later steps from running
- manual camera input has a dedicated cancellation route
- `Planet in Motion` contains 1000× playback and explicit return-live behavior
- commands resolve `briefing`, `earth now`, `orbit now`, `planet in motion`, `night earth`
- Phase 13 pure modules pass strict TypeScript checking
- entire TS/TSX source tree passes syntax/transpile validation
- no runtime backend or new network provider introduced
