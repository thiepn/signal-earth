# Signal Earth — Design System Baseline

Phase 1 establishes the first implemented visual language. Phase 2 may reorganize controls, but the globe treatment and product character should remain stable unless profiling or accessibility requires a change.

## Product character

Scientific, cinematic, restrained, dark-first, high information clarity. Avoid military-surveillance mimicry and generic dashboard styling.

## Globe visual language

- near-black space rather than pure black
- subdued, locally bundled Natural Earth-derived surface texture
- cool atmospheric rim
- sparse procedural star field
- quiet technical readouts rather than decorative HUD clutter
- overlays should become brighter than the underlying Earth so live signals remain legible
- camera motion should be smooth and deliberate, not game-like

The Phase 1 Earth surface contains decorative tonal variation only. It must never be labelled or interpreted as measured elevation, vegetation, weather, or other scientific data.

## V1 visual modes

Exactly four:

1. Earth
2. Signal
3. Night
4. Wireframe

No fake FLIR/NVG/thermal modes.

## Layout rule

The visualization remains primary.

- desktop normal state: ≥70% viewing area reserved for globe
- mobile normal state: ≥75%

Desktop may use side panels. Mobile uses bottom sheets.

## Core UI surfaces

- top bar
- layer controls
- single entity inspector
- timeline
- search/command palette
- Above Me sheet
- provider/freshness status
- Data Sources surface

Avoid permanent stacks of secondary controls around every edge.

The Phase 1 focus/quality/metrics controls are a temporary engine verification harness, not the final application-shell layout.

## Data-state language

Observed, propagated, forecast, historical, and static information must be visually distinguishable. Freshness is separately represented.

Never present a decorative simulation as measured data.

## Design tokens

Implemented tokens live in `src/ui/styles/tokens.css`. Phase 1 locks the basic dark-space palette, muted text hierarchy, cool cyan accent, translucent technical surfaces, restrained borders, and monospace readout language. Phase 2 can refine spacing and component geometry while preserving these roles.

Accessibility requirements include keyboard support, reduced motion, non-color-only distinctions, sufficient contrast, and ≥44 px touch targets for production mobile controls.


## Phase 3 visual modes

Exactly four V1 globe treatments are supported:

- **Earth** — natural daytime palette and balanced astronomical lighting
- **Signal** — darker cartographic treatment with graticules for data inspection
- **Night** — low-light globe with stronger night-side city-light presentation
- **Wireframe** — technical geometry/graticule view for spatial structure

Visual modes are presentation state only. They do not change data, simulation time, coordinates, provider status, or selection.

## Phase 14 accessibility and device rules

- Motion defaults to the operating-system preference and can be explicitly overridden to Reduced or Full.
- Reduced motion must affect actual 3D/camera behavior, not only CSS animation.
- Search, bottom sheets and the Briefing launcher behave as modal focus scopes and restore prior focus on close.
- Underlying interface regions become `inert` during cinematic playback.
- The globe itself is keyboard-operable.
- Interactive My Horizon satellites are keyboard-operable.
- On coarse-pointer devices, core controls target at least 44×44 CSS px.
- High-contrast and forced-colors modes reduce transparency/decorative effects when needed.
- Focus indicators use a clear, high-visibility outline and must not rely on color alone for state communication.
- Auto rendering quality may both degrade and recover, but uses hysteresis/cooldown to avoid oscillation.
- Runtime performance status is diagnostic: a PASS is a measurement against the active device tier, not a claim about untested devices.

