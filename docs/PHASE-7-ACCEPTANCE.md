# Phase 7 Acceptance — Orbit Interaction & Tracking

Status: **implemented**

## Goal

Turn Phase 6's orbital data engine into a coherent selected-satellite experience without moving camera ownership into the orbit renderer.

## Implemented

- selected-satellite halo without replacing the instanced bulk layer
- on-demand one-orbit trajectory generation in the existing orbit Web Worker
- full 3D orbit path for the selected satellite
- dashed surface ground track generated from the same propagated samples
- orbit track regeneration only after selection or a meaningful simulation-time shift
- satellite follow camera driven by the selected renderer position
- orbital-plane camera framing based on the generated path
- camera framing distance adapts to LEO, MEO, GEO and higher orbit radius
- manual camera input cancels automated follow/cinematic camera state
- true altitude scale remains the default
- optional visual altitude scale with explicit adaptive exaggeration factor
- visual scale affects satellite position and orbit path consistently; ground track remains Earth-fixed
- contextual inspector controls for Follow, Orbit View, Orbit Path, Ground Track and Ground Point
- global True / Visual scale toggle in the Orbit layer controls
- camera state remains owned by CameraController / GlobeEngine

## Scale semantics

`TRUE` uses physical altitude relative to the Earth-radius model.

`VISUAL` deliberately exaggerates altitude for readability:

- LEO (≤2,000 km): ×4
- lower MEO (≤12,000 km): ×2.2
- navigation/MEO (≤28,000 km): ×1.55
- higher orbit: ×1.18

The exact factor for the selected satellite is shown in the inspector. Visual scale must never be described as physical scale.

## Worker contract

The main ~1 Hz propagation frame remains separate from selected-orbit path generation.

```text
PROPAGATE
  → current catalog positions
  → transferable typed arrays

GENERATE_TRACK
  → one selected satellite
  → one orbital period around simulation time
  → transferable [lat, lon, true-altitude] samples
```

Track generation is not a frame-loop operation.

## Camera ownership

OrbitRenderer exposes geometry/target information only.

```text
OrbitRenderer
  → selected world position
  → orbit-plane normal / path radius

GlobeEngine + CameraController
  → FOLLOW
  → ORBIT VIEW
  → manual-cancel semantics
```

The renderer never directly owns camera state.

## Explicitly deferred to Phase 8

- predictive multi-frame buffering for smooth 100× / 1000× orbit playback
- simulation-time-aware interpolation replacing the current real-time ~1 Hz interpolation
- higher-speed path refresh policy tuned to accelerated playback
- multi-satellite time-motion polish
