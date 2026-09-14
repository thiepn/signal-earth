# Earth rendering assets

Signal Earth keeps the Phase 3 globe fully static-hostable. All Earth textures in
this directory are bundled with the application and require no map-tile service.

- `earth-signal-{2k,4k}.webp` — dark cartographic texture derived from bundled
  Natural Earth public-domain geometry.
- `earth-day-{2k,4k}.webp` — locally generated daytime colour variant derived
  from the same Signal Earth texture.
- `earth-city-lights-{2k,4k}.webp` — **stylised presentation layer**, not a
  measured night-lights dataset. It contains deterministic glows around a small
  curated set of major cities and is used only to give NIGHT/EARTH modes visual
  context. It must never be described as observed luminosity or population data.

The day/night boundary itself is astronomical and is calculated from simulation
time in the browser. No texture encodes the terminator.
