# Signal Earth V1.0.0 — Release Notes

## Product

Signal Earth V1 is a static browser observatory built around four connected ideas:

**Earth · Orbit · Time · The Observer**

V1 includes:

- interactive Three.js/Globe.gl Earth;
- simulation-driven Sun/day/night system;
- live USGS earthquakes;
- NASA EONET severe storms, wildfires and volcanoes;
- CelesTrak OMM satellite catalog + worker-based SGP4 propagation;
- satellite tracking, follow, orbit planes, ground tracks and temporal trails;
- ±24-hour shared simulation timeline;
- NOAA SWPC Kp/solar wind/G-R-S/OVATION aurora context;
- Above Me local observatory with Sun/Moon, weather, horizon satellites and ISS passes;
- local search and deterministic commands;
- four cinematic planetary briefings;
- adaptive device quality and accessibility hardening;
- shareable public view URLs;
- PNG capture and optional video recording;
- installable/offline-capable PWA shell;
- static GitHub Pages deployment workflow.

## Runtime infrastructure

None.

Signal Earth requires no runtime Node server, account system, database, server secret, proxy or paid map API.

## Privacy

Browser location is opt-in and ephemeral by default. Share URLs never contain observer location.

## Release commands

```bash
npm install
npm run release
```

Local development:

```bash
npm run dev
```

## GitHub Pages

The repository contains a verified-artifact Pages workflow. GitHub Pages must be enabled once with **Settings → Pages → Build and deployment → Source: GitHub Actions**. Subsequent pushes to `main` run the complete release gate before `dist/` can be deployed.

## Certification status

GitHub Actions certification passed on September 14, 2026 using Node 22:

- TypeScript: PASS;
- Vitest: 84/84 tests PASS;
- production Vite build: PASS;
- service-worker production precache: PASS;
- post-build release verification: PASS;
- verified production site size: 13.40 MB.

The production build uses ES-module Web Workers because satellite.js 7.x's WASM worker path requires module semantics for top-level `await`.

The remaining V1 release work is operational rather than source-level: enable GitHub Pages for the repository, deploy the already-certified artifact, then perform real-browser/device smoke checks against the live URL.
