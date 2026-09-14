# Phase 19 — Observatory UX 2.0 — Acceptance

## Goal

Turn Signal Earth from a technically capable observatory prototype into a coherent, legible exploration product without changing its scientific trust model or backend-free architecture.

## Planned acceptance surface

- Cleaner top-level hierarchy built around **Now / Search / Time / Globe**.
- Contextual layer controls: one expanded layer at a time instead of five permanently expanded control stacks.
- Zoom-aware country/city context and subtle country borders on the globe.
- Lightweight hover previews for earthquakes, natural events and satellites before selection.
- Stronger selected-object continuity between globe and inspector.
- Mobile sheets and controls remain first-class and touch-target compliant.
- Existing keyboard, share, briefing, time, weather, orbit and Above Me behavior remains intact.
- Rendering and interaction changes degrade safely on low-quality profiles.
- App version advances to **1.4.0**.

## Verification

- [ ] TypeScript passes.
- [ ] Unit tests pass.
- [ ] Production build passes.
- [ ] Release verification passes.
- [ ] Clean-branch certification passes after staging machinery is removed.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.
