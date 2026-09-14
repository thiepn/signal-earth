# Phase 1 — Globe Engine Acceptance

Status: **implemented**

## Scope delivered

- Real Globe.gl + Three.js scene running in the browser
- Fully local 2K/4K Earth texture assets
- Atmosphere and procedural star field
- Globe orbit/zoom interaction with damping and camera bounds
- Smooth camera framing and coordinate focus actions
- Click-to-target surface coordinates
- Globe/scene-space coordinate bridge
- ResizeObserver-driven responsive canvas
- Fullscreen support
- Page-visibility pause/resume
- Renderer/resource cleanup lifecycle
- Three adaptive quality profiles
- Conservative sustained-FPS auto-degradation
- Live renderer metrics panel for Phase 1 verification
- WebGL initialization failure surface
- Geographic utility expansion and tests

## Deliberate exclusions

These remain later-phase work:

- final application shell and mobile sheets (Phase 2)
- physical Sun/day-night lighting (Phase 3)
- earthquake/event data rendering (Phase 4+)
- orbital propagation and satellite rendering (Phase 6+)
- production search/timeline/inspector UI

## Engine invariants validated by design

1. Globe.gl owns the canvas and render loop.
2. `GlobeEngine` owns lifecycle, resize, quality, metrics and renderer registration.
3. Feature renderers receive a `GlobeRenderContext` and own their resources.
4. React receives only low-frequency engine metrics/POV updates.
5. Manual orbit-control input cancels automated camera state.
6. Quality changes are applied to the WebGL renderer and feature renderers without reload.
7. Earth assets are local; no map/tile provider is required.
8. Hidden tabs pause both Globe.gl animation and Phase 1 update sampling.

## Phase 1 test harness

The temporary Phase 1 UI intentionally exposes:

- Reset Earth
- Atlantic / Europe / Pacific focus presets
- click-to-target focus
- fullscreen
- Auto / Low / Medium / High quality
- FPS/frame/draw-call/triangle/texture metrics

Phase 2 may replace these controls while retaining the engine APIs.

## Verification target

A successful Phase 1 build must allow the user to open the static app and immediately manipulate a textured 3D Earth with atmosphere and stars, resize the viewport without reload, focus arbitrary globe coordinates, and observe performance/quality state without any runtime backend or external map service.
