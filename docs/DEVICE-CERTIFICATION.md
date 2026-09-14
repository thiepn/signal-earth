# Signal Earth — Device & Browser Certification Matrix

This matrix is the release test protocol for the current product. `Pending` means not executed in the present build environment; it does not mean failure.

## Required browser matrix

| Platform | Browser | Target | Status |
|---|---|---|---|
| Windows/macOS/Linux | Chromium current/current-1 | Full desktop experience | Pending production build |
| Windows/macOS/Linux | Firefox current/current-1 | Full desktop experience | Pending production build |
| macOS/iOS | Safari current/current-1 | Desktop/touch compatibility | Pending production build |
| Android | Chrome current/current-1 | Touch/mobile sheet workflow | Pending physical/device run |
| iOS/iPadOS | Safari current/current-1 | Touch/mobile/tablet workflow | Pending physical/device run |

## Device classes

### Constrained

Examples: older phones, low-memory systems, WebGL1 fallback, 2-core hardware.

Acceptance:

- Auto quality settles to Low when needed.
- ≥27 FPS target during ordinary exploration.
- primary navigation remains responsive;
- no forced 4K Earth texture;
- satellite/aurora population caps are respected;
- reduced visual effects do not remove scientific meaning.

### Balanced

Examples: mainstream recent phones, integrated-GPU laptops, typical tablets.

Acceptance:

- Medium is normal operating profile;
- ≥45 FPS target;
- timeline scrubbing remains responsive;
- 600-satellite cap remains usable;
- normal atmosphere/effects remain stable.

### Capable

Examples: modern desktop/laptop GPUs and high-end mobile/tablet hardware.

Acceptance:

- Auto may recover to High after sustained headroom;
- ≥55 FPS target;
- 4K Earth and enhanced effects remain within runtime budgets;
- 800-satellite cap does not cause sustained budget failure.

## Scenario suite

Each browser/device run should exercise:

1. Cold start to usable globe.
2. Globe pointer/touch navigation.
3. Globe keyboard navigation.
4. Earthquake layer + M2.5/24h view.
5. NASA EONET layer.
6. Orbit layer with multiple categories.
7. Select ISS, Follow, Orbit View, ground track.
8. Timeline `1×`, `100×`, `1000×`.
9. Large timeline seek and recovery.
10. NOAA aurora + Night mode.
11. Above Me permission granted/denied path.
12. Search and deterministic commands.
13. Start/cancel each briefing.
14. Reduced-motion mode through a briefing/follow operation.
15. High-contrast and OS forced-colors where available.
16. Background the tab, wait, foreground it, confirm resynchronization.
17. Resize/orientation change.
18. Fullscreen enter/exit where browser supports it.
19. Simulated WebGL context loss/restoration where test tooling permits.
20. Repeated layer/category toggling to watch memory/resource stability.

## Failure gate

Do not label V1 release-ready if any of these remain reproducible:

- keyboard trap outside an intentional modal;
- focus into invisible/inert UI;
- unrecoverable WebGL context loss;
- hidden-tab data polling continuing at normal cadence;
- camera automation continuing after manual takeover;
- current observations shown as historical/future observations;
- persistent poor budget classification on a device tier after Auto quality settles;
- mobile primary controls below coarse-pointer target sizing;
- provider failure taking down unrelated layers;
- orbit worker or renderer accumulating after mount/unmount cycles.
