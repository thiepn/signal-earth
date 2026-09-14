# Phase 15 — V1 Release Acceptance

## Scope

Phase 15 converts the Phase 14 hardened application into the Signal Earth V1 release surface. It does not introduce another scientific provider or runtime backend.

Release work covers:

- human-readable shareable view URLs;
- clean PNG capture;
- optional 10-second canvas recording;
- installable PWA metadata/icons;
- service-worker offline shell with generated production precache;
- GitHub Pages-safe relative paths;
- final release scripts/workflows;
- release documentation and regression coverage.

## Acceptance matrix

| Area | Requirement | Result |
|---|---|---|
| Share | URL reproduces camera, mode, layers, time and public signal settings | Implemented |
| Privacy | Observer location/accessibility settings are excluded from share links | Implemented |
| Share restore | Shared camera/time/layer/filter state is applied on load | Implemented |
| Entity target | Provider entity target resolves after its catalog/feed loads | Implemented |
| Local target | Shared surface-location selection can be recreated locally | Implemented |
| Capture | Clean PNG can be exported from WebGL canvas | Implemented |
| Capture branding | PNG includes Signal Earth/time/view metadata | Implemented |
| Recording | 10s canvas recording where MediaRecorder/captureStream are supported | Implemented |
| Recording fallback | Unsupported browsers receive explicit unavailable state | Implemented |
| PWA manifest | Standalone manifest, theme metadata and 192/512/maskable icons | Implemented |
| PWA install | Browser install prompt is surfaced when provided | Implemented |
| Offline shell | Same-origin application shell/assets cached by service worker | Implemented |
| Offline data | Scientific feed caching remains provider/IndexedDB-owned | Implemented |
| Vite hashes | Post-build script injects actual dist asset filenames into SW precache | Implemented |
| Pages path | Relative Vite base + relative PWA resources support repository subpaths | Implemented |
| Command palette | `share`, `capture`, `record`, `install` deterministic commands | Implemented |
| Release gate | typecheck + unit tests + build + post-build production verification | Implemented |
| GitHub Pages | deploy workflow uploads only the verified `dist/` artifact | Implemented |
| Source syntax | Full TypeScript/TSX parse | PASS |
| Pure release contracts | Share/capture/search-command semantic/runtime checks | PASS |
| SW/manifest syntax | service worker/scripts/manifest static validation | PASS |
| Production dependency install | `npm install` | BLOCKED locally by registry timeout |
| Production Vite build | `npm run release` | PENDING successful dependency installation / CI |
| Chromium built-app smoke test | Release artifact execution | PENDING production build |
| Firefox/Safari/device matrix | Real execution | PENDING production build + devices |

## Share URL contract

V1 share links intentionally use readable query parameters rather than an opaque encoded blob. Example shape:

```text
?v=1
&lat=35.6762
&lng=139.6503
&alt=1.2
&mode=night
&layers=earthquakes,orbit,aurora
&time=live
&target=satellite:25544
```

Additional parameters preserve earthquake filters, satellite/natural-event categories, orbit scale/trails and aurora hemispheres.

The following are deliberately **not** serialized:

- browser geolocation / observer coordinate;
- remembered-location preference;
- motion/contrast preference;
- runtime performance/quality measurements;
- cached provider payloads.

A non-live absolute shared timestamp is still constrained by V1's ±24-hour simulation window when the link is opened later. Signal Earth will not fake historical orbit data outside that product contract.

## Capture contract

PNG capture comes from the Three.js/WebGL canvas only, not an HTML screenshot of private/local panels. The exported image receives a small local-only overlay containing:

- Signal Earth;
- simulation timestamp;
- visual mode;
- current globe latitude/longitude.

No image or telemetry is uploaded.

## Recording contract

Recording uses `HTMLCanvasElement.captureStream()` + `MediaRecorder` only when supported. Signal Earth selects the first browser-supported type among VP9 WebM, VP8 WebM, generic WebM and MP4.

Recording is optional V1 functionality: lack of MediaRecorder support does not make the observatory unusable.

## Offline/PWA architecture

The application service worker caches only same-origin application assets.

```text
Vite build
   ↓
dist/ hashed assets
   ↓
inject-precache.mjs
   ↓
dist/sw.js receives exact generated file list
   ↓
install
   ↓
app shell + local Earth data available offline
```

Scientific providers are intentionally excluded from service-worker HTTP caching because USGS/EONET/CelesTrak/SWPC/Open-Meteo already have explicit freshness and IndexedDB behavior inside Signal Earth.

This prevents two caches from making contradictory claims about whether scientific data is fresh.

## Deployment gate

`npm run release` is the canonical V1 release gate:

```text
npm run typecheck
npm test
npm run build
  ├─ vite build
  └─ inject production SW precache
npm run release:verify
```

`release:verify` requires the built site to contain:

- transformed production `index.html`;
- PWA manifest;
- service worker with injected precache;
- required icons;
- core Earth/data assets;
- no development `/src/main.tsx` reference;
- no localhost address;
- production site size ≤25 MB.

The GitHub Pages deploy workflow runs this same release gate before uploading `dist/`.

## Local verification completed

- 137 TypeScript/TSX files parsed with zero syntax diagnostics at the initial Phase 15 full-source pass.
- Strict TypeScript semantic validation passed for the new share/capture/command contracts.
- Share URL build/parse runtime round-trip passed.
- Release capture filename runtime check passed.
- `share`, `capture`, `record`, `install` command parsing passed.
- `sw.js`, precache injector and release verifier pass Node syntax checks.
- `manifest.webmanifest` parses as valid JSON.
- PWA icon files are valid 192×192 and 512×512 PNGs.

A complete dependency build could not be run locally because `npm install` timed out against the npm registry. This is recorded as a pending release-environment validation, not converted into a false PASS.
