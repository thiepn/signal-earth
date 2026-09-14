# Phase 11 — Above Me Acceptance

**Version:** `0.11.0-phase11`  
**Scope:** observer location, local astronomy/weather, horizon satellites, ISS passes and local aurora context.

## Product acceptance

Phase 11 is complete when Signal Earth can answer **“what is happening above this observer?”** without accounts, a backend, reverse geocoding or a second orbital engine.

### Location and privacy

- No geolocation prompt appears on application load.
- Opening **Here / Above Me** does not request permission.
- **Use my location** is the only geolocation trigger.
- Location is ephemeral by default.
- Persisting the coordinate requires a separate explicit **Remember this coordinate on this device** choice.
- **Forget** removes persisted observer state and clears local observer/weather/pass state.
- No reverse-geocoder is required; coordinates are the truthful fallback identity.

### Observer astronomy

- Sun azimuth/elevation follows simulation time.
- Moon azimuth/elevation and approximate phase follow simulation time.
- Next sunrise/sunset are calculated locally.
- Astronomical calculations do not call a remote provider.
- The local horizon visualization clearly distinguishes geometric sky position from optical visibility.

### Observer orbit

- Satellite look angles are calculated in the existing orbit worker.
- SGP4/SatRec state never enters React.
- Above-horizon satellites are returned as bounded transferable typed arrays.
- The worker exposes azimuth, elevation, range, altitude and speed.
- ISS pass prediction uses the same worker/orbital catalog.
- Passes use a 5° minimum elevation and a bounded forecast horizon.
- Clicking a horizon satellite enables the relevant Orbit category/layer and selects the canonical satellite entity.
- Hiding Orbit does not prevent background observer calculations while Above Me is active.

### Weather

- Current local conditions come from the Open-Meteo current endpoint.
- No application API key or proxy is required.
- Cache TTL is 15 minutes with a two-hour stale fallback.
- Weather is shown only when the simulation timestamp remains near the weather observation timestamp.
- Replay/future time does not falsely relabel current weather as historical/forecast conditions.
- Open-Meteo attribution is visible in the UI.

### Aurora

- Above Me samples the nearest NOAA OVATION model cell to the observer coordinate.
- The local model value is shown only when Phase 10's model-validity window applies.
- The UI describes this as model intensity/context, not a guarantee of visible aurora.

### Rendering / UI

- A subtle observer marker is rendered on the 3D Earth.
- Desktop uses a dedicated Above Me panel.
- Mobile uses the existing **Here** bottom sheet and does not duplicate the top-bar Here action.
- My Horizon is a lightweight SVG polar plot containing Sun, Moon and bounded satellite markers.
- No second WebGL scene or AR/camera permission is introduced.

## Architecture acceptance

```text
Browser geolocation (explicit)
        ↓
ObserverLocation
   ├── local Sun/Moon
   ├── Open-Meteo current conditions
   ├── NOAA OVATION local model sample
   └── Orbit worker
         ├── above-horizon snapshot
         └── ISS pass prediction
                ↓
         Above Me UI + ObserverRenderer
```

High-frequency satellite coordinates remain outside React. Location persistence remains independent of IndexedDB provider caches and is opt-in only.

## Explicit non-goals

Phase 11 does not add:

- reverse geocoding or place-name inference
- camera/AR sky overlay
- optical satellite-visibility prediction
- cloud-aware ISS visibility claims
- arbitrary satellite pass planner UI
- background location tracking
- server-side storage of location
- historical weather archive

## Validation completed

- pure astronomy/provider/geolocation modules pass strict TypeScript checking
- orbit worker and worker client pass semantic checking against the documented satellite.js API contract
- all TS/TSX files pass syntax/transpile validation
- local Sun/Moon state produces finite observer angles
- sunrise/sunset crossing search returns future events at ordinary mid-latitudes
- lunar phase names wrap correctly
- OVATION nearest-cell lookup handles wrapped longitude
- Open-Meteo local timestamp + UTC offset normalize to the correct UTC instant
- Open-Meteo range validation rejects impossible humidity/wind-direction values
- npm dependency installation was attempted but registry access was unavailable/timed out in the execution environment; a full Vite production dependency build is therefore not claimed as locally verified

## Definition of done

The user can explicitly grant location, see a local horizon and astronomical state, inspect overhead curated satellites, receive ISS pass geometry, view temporally honest current weather and auroral-model context, focus their location on the globe, and remove or optionally persist the observer coordinate—all without adding a runtime backend.
