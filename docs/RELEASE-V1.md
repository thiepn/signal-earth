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
- static GitHub Pages deployment.

## Live deployment

**https://thiepn.dev/signal-earth/**

GitHub Pages deploys only after the complete V1 release gate succeeds.

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

## Certification status

GitHub Actions certification passes on Node 22:

- TypeScript: PASS;
- Vitest: 84/84 tests PASS;
- production Vite build: PASS;
- service-worker production precache: PASS;
- post-build release verification: PASS.

The production build uses ES-module Web Workers because satellite.js 7.x's WASM worker path requires module semantics for top-level `await`.

## Pages artifact hardening

The first live Pages artifact revealed that hidden `.gitkeep` files were present in the generated precache but omitted by Pages packaging. That could cause the service-worker `cache.addAll()` install transaction to fail.

V1 now excludes hidden and non-runtime files from the generated precache and verifies every precache target during the release gate. The final deployed artifact contains **15** runtime precache entries with **0 missing** and **0 unsafe** entries.

## Remaining acceptance work

Source, build, deployment and post-deploy artifact certification are complete. The remaining work is real interactive browser/device acceptance against the live site: Chromium, Firefox, Safari/WebKit where available, Android touch/PWA behavior, and performance/accessibility checks on representative devices.
