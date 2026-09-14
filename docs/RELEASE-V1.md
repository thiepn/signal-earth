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

Push to `main` after enabling GitHub Pages with **GitHub Actions** as the source. `.github/workflows/deploy.yml` verifies and deploys the static `dist/` artifact.

## Known release-environment limitation

The provided source was created and source-level validated in an environment where npm registry access timed out. A successful CI dependency installation/build remains the required final binary/deployment gate.
