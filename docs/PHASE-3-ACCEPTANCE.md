# Phase 3 Acceptance — Earth Systems Foundation

Status: **implemented**

## Delivered

- pure astronomical time utilities independent of WebGL
- Julian day and Greenwich mean sidereal time
- subsolar latitude/longitude calculation
- local solar-elevation/daylight classification helpers
- simulation-time-driven directional sunlight
- astronomical day/night boundary through real scene lighting
- additive night-side city-light presentation layer
- sidereal star-field rotation
- four visual modes: Earth, Signal, Night, Wireframe
- quality-aware 2K/4K daytime and city-light assets
- visual-mode controls in desktop/mobile settings
- keyboard shortcuts `1`–`4` for visual modes
- renderer remains Earth-fixed so geographic coordinates stay coherent

## Scientific presentation rule

The day/night boundary is calculated from simulation time. The bundled city-light
texture is deliberately **stylised**, not observed luminosity data. It may be
used for presentation but must never be described as a live or measured layer.

## Architecture check

Phase 3 does not add a second clock. `EarthRenderer` reads directly from the
existing `TimeEngine` through a narrow getter supplied by `GlobeViewport`.
React continues to receive only the low-frequency clock snapshot used for UI.

The geographic globe mesh itself is not rotated to simulate time. Earth-fixed
longitude/latitude remains stable for current and future data layers; sunlight
and the inertial-ish star frame move instead.

## Acceptance checks

- March equinox subsolar latitude is within 1° of the equator
- June solstice solar declination is between 23° and 24° north
- solar elevation is ~90° at the computed subsolar point
- sidereal angle remains normalized to `[0, 2π)`
- switching visual mode does not remount the globe engine
- quality changes swap Earth/night assets without altering simulation time
- accelerated TimeEngine playback changes sunlight and star orientation
- Phase 3 introduces no runtime backend or external tile service
