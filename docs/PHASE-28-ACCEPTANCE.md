# Phase 28 — Visual & Motion Finish — Acceptance

## Goal

Complete Signal Earth’s final design-system and motion pass without redesigning the product or reopening its architecture. Phase 28 is presentation polish over the certified v1.12 product: typography, spacing, surfaces, interaction states, loading/empty presentation, responsive density, motion, high-DPI treatment, reduced-motion behavior and selected/hovered signal emphasis.

## Implemented

### Unified visual system

- Refined the shared dark observatory palette and text hierarchy while preserving Signal Earth’s existing cyan/green scientific status language.
- Added explicit glass/elevated surface, shadow, focus-ring and motion/easing tokens so later feature CSS no longer invents slightly different values.
- Added one final Phase 28 override layer instead of rewriting stable feature components.
- Introduced a restrained ambient observatory field behind the globe rather than adding decorative imagery or a new visual theme.
- Unified borders, blur, elevation and surface treatment across the top bar, panels, Search, bottom sheets, hover previews, settings/reliability cards and toasts.

### Typography and density

- Strengthened brand, panel-heading, eyebrow and secondary-copy hierarchy.
- Added tabular-number treatment to time, metrics and provider-health readouts.
- Normalized panel spacing and contextual-control density.
- Added a mid-width density pass for tablet/small-desktop layouts and a separate compact mobile pass.

### Interaction and motion language

- Added consistent fast/standard/slow transition durations and standard/emphasized easing curves.
- Added restrained entrance motion for the top bar, side panels, floating desktop panels, timeline, Search, hover previews, toasts and mobile sheets.
- Preserved positioning semantics while animating. Phase 28 explicitly avoids converting absolute/fixed product surfaces into relative-layout elements.
- Added a separate 761–900 px timeline entrance path so responsive right-aligned timeline positioning is not accidentally recentered by animation transforms.
- Refined hover, active and focus-visible feedback for buttons, layer rows, visual-mode cards and provider-health rows.
- Added a stronger focused-layer rail instead of relying only on a background tint.
- Added subtle LIVE-state breathing for relevant status dots.

### Loading, empty and transient states

- Reworked the initial loading treatment into a small observatory-style orbital indicator with clearer text hierarchy.
- Improved empty-selection presentation and target affordance.
- Improved lazy-feature error cards while retaining the Phase 26 local error-boundary behavior.
- Added tone rails and entrance motion to transient toasts.
- Refined Search and sheet scrims so transient UI reads as a single visual layer rather than a separate application.

### Timeline and controls

- Refined the timeline track, thumb, LIVE marker and active speed/preset controls.
- Preserved all existing Time 2.0 behavior and interaction semantics.
- Timeline motion is presentation-only; simulation timing and playback logic are unchanged.

### Globe signal emphasis

- Earthquake marker hover now scales the existing instanced marker by a small amount and blends its existing magnitude color toward white.
- Selected earthquakes retain the stronger existing white/scale emphasis, so hover never competes with selection.
- Hover emphasis reuses the existing instanced mesh: no new geometry, scene object, provider request or draw-call class is introduced.
- Orbit already had a selected-satellite halo, selected-marker scale/color state and eased orbit-plane camera flight; those existing mechanisms are retained rather than duplicated.
- Natural-event selection and outlines remain unchanged; Phase 28 does not alter provider geometry or event meaning.

### Accessibility, contrast and display quality

- Added explicit high-contrast token overrides with stronger boundaries and disabled backdrop blur.
- Added high-DPI border/hairline refinements.
- Phase 28 decorative infinite motion is explicitly disabled under Signal Earth reduced-motion mode and under the system reduced-motion preference unless the user has chosen full motion.
- Existing global reduced-motion behavior still collapses application transition/animation duration and CameraController continues to convert automated camera flights to cuts.
- Focus-visible treatment remains keyboard-visible without adding focus styling to pointer interaction.

## Scope corrections found during implementation

The first presentation draft exposed two positioning hazards before certification:

1. A shared-surface rule could have overridden the existing absolute positioning of the top bar, Search and bottom sheets.
2. The standard timeline entrance transform could have reintroduced horizontal centering in the responsive 761–900 px layout where the timeline is intentionally right aligned.

Both were removed/fixed before the certified runtime head. These were implementation-review findings, not shipped regressions.

## Automated release certification

Certified runtime head: `ca5ea3e86a0b062daa7fe16e3182399639187cb2`

Verify V1 run **35132955924** completed successfully on 2026-09-16.

- [x] TypeScript passes.
- [x] **40/40** unit-test files pass.
- [x] **151/151** unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes.
- [x] Performance verification passes.
- [x] Production package remains approximately **14.02 MB**.
- [x] Startup service-worker precache remains **26** shell assets.
- [x] HTML-linked JavaScript remains approximately **442.5 kB raw / 141.8 kB gzip**.
- [x] The Phase 25 startup limits of **480 kB raw / 145 kB gzip** remain satisfied.
- [x] **10** deferred JavaScript chunks remain outside the startup graph at approximately **2,015.7 kB raw** combined.
- [x] The WebGL core remains approximately **1,966.37 kB raw / 556.41 kB gzip**.
- [x] Final compiled CSS is approximately **101.62 kB raw / 19.07 kB gzip**.

Phase 28 therefore increases presentation CSS while leaving startup JavaScript effectively unchanged.

## Cross-browser acceptance

Cross-browser QA run **35132955974** against the same runtime head completed successfully on 2026-09-16.

| Project | Result |
|---|---|
| Chromium desktop | PASS |
| Firefox desktop | PASS |
| WebKit desktop | PASS |
| Chromium ultrawide | PASS |
| Android Chromium emulation | PASS |
| iPhone WebKit emulation | PASS |
| iPad WebKit emulation | PASS |

The existing production suite continues to exercise viewport containment, Search, keyboard flows, primary panels/sheets, Time controls, Saved Worlds, reduced-motion preference behavior, provider-failure isolation, offline reopening, phone orientation changes and lazy-module failure containment.

Browser phone/tablet projects are device emulations on GitHub-hosted runners. Physical-device visual/touch smoke testing remains separate manual acceptance.

## Scope and trust constraints

1. No product workflow, provider, data model, storage schema or backend is introduced.
2. No provider-derived scientific meaning changes.
3. No new renderer object is introduced for earthquake hover emphasis.
4. No startup JavaScript architecture is reopened.
5. Existing accessibility preference semantics remain authoritative.
6. Existing orbit ±24-hour scientific trust limits remain unchanged.
7. Phase 28 does not attempt another visual redesign; it closes the existing visual system.
8. Release-hardening work belongs to Phase 29.

## Acceptance

Phase 28 is accepted because the final runtime head passes the complete release gate and seven-project production browser/device-emulation matrix while materially improving presentation consistency and motion without changing product/data architecture. Documentation-only closure commits after the certified runtime head do not change executable behavior.
