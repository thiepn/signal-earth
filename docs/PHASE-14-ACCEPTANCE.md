# Phase 14 — Device, Performance & Accessibility Certification

## Scope

Phase 14 hardens the existing Signal Earth product. It does not add a new public-data domain or change the static GitHub Pages architecture.

Certification covers:

- responsive desktop/mobile behavior;
- keyboard and focus operation;
- reduced-motion and high-contrast preferences;
- coarse-pointer target sizing;
- adaptive rendering quality;
- renderer lifecycle and WebGL recovery;
- hidden-tab CPU/network behavior;
- performance budgets and runtime diagnostics;
- regression tests for the new device/accessibility/performance contracts.

Share URLs, capture/recording, PWA/offline packaging and final GitHub Pages release work are intentionally deferred to Phase 15.

## Acceptance matrix

| Area | Requirement | Phase 14 result |
|---|---|---|
| Motion | Respect OS preference and allow explicit override | Implemented |
| 3D motion | Reduced motion changes camera/tour behavior, not only CSS | Implemented |
| Focus | Modal/sheet focus is trapped and restored | Implemented |
| Hidden UI | Cinematic background controls cannot receive focus | Implemented with `inert` |
| Globe keyboard | Globe can be panned/zoomed/reset without pointer input | Implemented |
| Touch | Core coarse-pointer controls are at least 44×44 CSS px | Implemented |
| Contrast | System/high/normal modes plus forced-colors support | Implemented |
| Non-color state | Status text accompanies visual status color | Implemented |
| Device adaptation | Constrained/balanced/capable runtime tier | Implemented |
| Quality adaptation | Downgrade + recovery with hysteresis/cooldown | Implemented |
| Frame telemetry | Average, P95 and long-frame rate | Implemented |
| GPU telemetry | Calls, triangles, textures, geometries | Implemented |
| Runtime budget | Device-tier assessment shown in Settings | Implemented |
| Hidden tab | Rendering, orbit scheduling and provider timers sleep | Implemented |
| WebGL loss | Context loss/restoration handled without page failure | Implemented |
| Resource cleanup | Renderer resources disposed on teardown | Implemented |
| Briefing visibility | Hidden tab cancels an active cinematic session | Implemented |
| Source syntax | Entire TS/TSX source parses | PASS — 132 files, 0 syntax errors |
| Pure contracts | Strict TypeScript check of certification core | PASS |
| Pure runtime | Accessibility/device/quality/frame/budget checks | PASS |
| Vite production build | Install + build with project dependencies | BLOCKED locally by npm-registry timeout |
| Browser matrix | Chromium/Firefox/Safari execution | PENDING a successful production build / CI artifact |
| Physical-device matrix | Android/iOS/low-end integrated GPU | PENDING real-device run |

## Accessibility behavior

### Motion

Default is `system`. Users may explicitly select `Reduced` or `Full`.

Reduced motion affects:

- CSS transitions/animations;
- camera fly-to duration;
- satellite follow smoothing;
- observer pulse animation;
- earthquake pulse animation;
- cinematic camera movement.

The product therefore does not claim reduced-motion support while continuing to run full 3D camera choreography.

### Keyboard and focus

- `/` opens Search/Commands.
- `B` opens Briefings.
- `Space` controls simulation playback.
- `R` resets the globe.
- `Esc` closes/cancels the active transient surface.
- The globe itself is focusable and supports Arrow keys, Page Up/Down and Home.
- Search, bottom sheets and the Briefing launcher trap focus and restore previous focus on close.
- During a running cinematic briefing, underlying UI regions are `inert`.
- Interactive satellites in My Horizon are keyboard-selectable.

### Contrast and forced colors

Signal Earth supports:

- system contrast;
- explicit high contrast;
- explicit normal contrast;
- `forced-colors: active` system palettes.

Presentation effects such as translucency/backdrop blur are reduced when they would impair contrast.

## Performance budgets

Budgets are intentionally tier-specific instead of pretending every device should sustain desktop performance.

| Tier | Minimum FPS | Avg frame budget | Draw calls | Triangles | Textures | Geometries |
|---|---:|---:|---:|---:|---:|---:|
| Constrained | 27 | 37 ms | 145 | 850k | 56 | 110 |
| Balanced | 45 | 23 ms | 180 | 1.25m | 72 | 145 |
| Capable | 55 | 19 ms | 220 | 1.75m | 96 | 180 |

Warnings begin at the budget. A severe overrun (generally >120% of a maximum, <75% of minimum FPS, or >12% long frames) is classified as `poor`.

These are product budgets, not claims that every device has already been measured against them.

## Adaptive-quality policy

Auto mode now uses hysteresis:

- three sustained low-FPS reports before degrading;
- 25 sustained high-FPS reports before upgrading;
- 30-second cooldown after an automatic quality change.

This permits recovery on capable hardware without quality-level oscillation.

## Background behavior

When the document is hidden:

- Globe.gl/Three.js animation is paused;
- the orbit-worker scheduler sleeps;
- provider refresh timers sleep;
- React clock synchronization sleeps;
- an active cinematic briefing is cancelled and its temporary state is restored.

The app refreshes/resynchronizes as appropriate after returning to the foreground.

## WebGL lifecycle

Signal Earth now handles `webglcontextlost` and `webglcontextrestored` explicitly. On teardown it disposes scene resources, renderer lists and the renderer/context rather than relying only on garbage collection.

## Verification completed in this environment

- 132 TypeScript/TSX files transpile with zero syntax diagnostics.
- Strict TypeScript checks pass for accessibility preferences, device capabilities, performance certification, adaptive quality, camera state, frame metrics and shared entity contracts.
- Pure runtime checks pass for:
  - reduced-motion/high-contrast resolution;
  - constrained/capable device classification;
  - adaptive quality downgrade and recovery;
  - ~60 FPS frame sampling with P95 computation;
  - good/poor runtime budget classification.
- No production `setInterval` remains in the non-test source; recurring work uses visibility-aware scheduling.
- No partial `node_modules` or lockfile from failed installation attempts is packaged.

## Certification limitation

The execution environment could not complete `npm install` because access to the npm registry timed out. As a result, a production Vite bundle could not be generated here and Chromium/Firefox/Safari end-to-end execution was not honestly certifiable in this phase run.

The repository's CI `certify` job performs typecheck, unit tests and production build once dependency installation is available. Browser/device certification should consume that successful build artifact rather than treating the source-level checks above as a substitute.
