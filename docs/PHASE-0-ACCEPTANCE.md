# Phase 0 Acceptance & Risk Register

## Definition of done

Phase 0 is complete when the repository enforces these decisions:

```text
SIGNAL EARTH
├─ Earth: USGS + NASA EONET
├─ Orbit: CelesTrak OMM
├─ Space: NOAA SWPC
├─ Here: Open-Meteo + local calculations
├─ Time: central TimeEngine
├─ Renderer: Globe.gl + Three.js
├─ UI: React + TypeScript
├─ Computation: Web Workers
├─ Cache: IndexedDB
└─ Hosting: GitHub Pages
```

The real renderer, live providers, orbit propagation, visual layers, and final UI are intentionally **not** Phase 0 deliverables.

## First-launch V1 target

```text
0s      Signal Earth
1s      globe visible
2–3s    atmosphere/daylight
3–4s    earthquakes
4–6s    orbit data begins appearing
then    rotate → inspect quake → Orbit → ISS → Follow → accelerate time → Above Me
```

No tutorial wizard, account, API-key prompt, login, or onboarding questionnaire.

## Risk register

| Risk | Mitigation |
| --- | --- |
| External API/CORS changes | provider adapters + future static-snapshot escape hatch |
| CelesTrak request limits | IndexedDB reuse + minimum 2 h catalog TTL |
| Orbit performance | worker propagation + render interpolation + instancing |
| React performance | high-frequency state bypasses React |
| Mobile GPU pressure | adaptive quality and capped object counts |
| Timeline ambiguity | explicit temporal types and scientifically honest window |
| Feature creep | fixed V1 non-goals + six-part quality gate |
| Provider outage | independent provider health and cached/stale fallback |
| Browser memory pressure | lazy assets, capped catalogs, resource disposal |
| API schema changes | provider normalizers, validation, fixtures |
| GitHub Pages limitations | static-only runtime contract |

## Architecture audit checkpoints

- after Phase 2: UX architecture
- after Phase 5: time/data semantics
- after Phase 8: orbit/performance
- after Phase 11: scope and mobile
- after Phase 13: product identity
- before V1: full release audit
