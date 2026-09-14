from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Release version
replace_once('src/app/version.ts', "export const APP_VERSION = '1.2.0';", "export const APP_VERSION = '1.3.0';")
package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '1.3.0'
package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

# Timeline layout/interaction overrides. Keep old rules intact for low-risk rollback.
css_path = Path('src/ui/styles/global.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Phase 18 — Time 2.0 */'
if marker not in css:
    css += r'''

/* Phase 18 — Time 2.0 */
.timeline-bar {
  min-height: 108px;
  grid-template-columns: auto minmax(250px, 1fr) auto auto;
  grid-template-rows: auto auto;
  gap: 8px 10px;
}
.timeline-track-wrap::after { left: var(--timeline-live-position, 50%); }
.timeline-labels { justify-content: space-between; }
.timeline-label-now {
  position: absolute;
  transform: translateX(-50%);
  color: rgba(152,244,199,.72);
}
.timeline-range::-webkit-slider-runnable-track {
  background: linear-gradient(90deg,
    var(--se-line-strong),
    rgba(143,220,255,.34) var(--timeline-live-position, 50%),
    rgba(220,183,255,.30) var(--timeline-live-position, 50%),
    var(--se-line-strong));
}
.timeline-range-group {
  grid-column: 1;
  grid-row: 2;
  display: inline-flex;
  gap: 3px;
  align-items: center;
}
.timeline-range-group button,
.timeline-replay-button {
  height: 25px;
  border: 1px solid var(--se-line);
  border-radius: 6px;
  background: rgba(255,255,255,.02);
  color: var(--se-dim);
  cursor: pointer;
  font: 600 .48rem/1 var(--se-mono);
  letter-spacing: .025em;
}
.timeline-range-group button { min-width: 38px; padding: 0 6px; }
.timeline-range-group button:hover,
.timeline-replay-button:hover { color: var(--se-text-soft); border-color: var(--se-line-strong); }
.timeline-range-group button.is-active {
  color: var(--se-accent);
  border-color: rgba(158,231,255,.22);
  background: rgba(158,231,255,.07);
}
.timeline-presets { grid-column: 2; grid-row: 2; }
.timeline-replay-button {
  grid-column: 3;
  grid-row: 2;
  min-width: 86px;
  padding: 0 8px;
  white-space: nowrap;
}
.timeline-replay-button.is-active {
  color: var(--se-success);
  border-color: rgba(152,244,199,.26);
  background: rgba(152,244,199,.07);
}
.timeline-context { grid-column: 4; grid-row: 2; }
.timeline-activity {
  padding: 4px 5px;
  border: 1px solid rgba(158,231,255,.10);
  border-radius: 5px;
  color: var(--se-dim);
  background: rgba(0,0,0,.12);
  font: 550 .44rem/1 var(--se-mono);
  white-space: nowrap;
}

.timeline-controls--compact {
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto auto auto auto auto;
}
.timeline-controls--compact .timeline-range-group { grid-column: 1; grid-row: 2; }
.timeline-controls--compact .timeline-replay-button { grid-column: 2; grid-row: 2; justify-self: end; }
.timeline-controls--compact .timeline-track-wrap { grid-column: 1 / -1; grid-row: 3; }
.timeline-controls--compact .timeline-speed-group { grid-column: 1 / -1; grid-row: 4; }
.timeline-controls--compact .timeline-presets { grid-column: 1 / -1; grid-row: 5; }
.timeline-controls--compact .timeline-context { grid-column: 1 / -1; grid-row: 6; }

@media (max-width: 1100px) {
  .timeline-bar { min-height: 70px; }
  .timeline-range-group { grid-column: 1; }
  .timeline-replay-button { grid-column: 3; }
  .timeline-activity { display: none; }
}
'''
    css_path.write_text(css, encoding='utf-8')

# Bring README up to the actual post-Phase-18 product state.
readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
start = text.index('## Current status')
end = text.index('## Current interaction model')
status = '''## Current status

**Signal Earth v1.3.0 — Phase 18 Time 2.0** is production-built and release-certified for GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

The current product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), observer-relative Above Me tools, shareable public views, PNG capture, optional 10-second recording, PWA/offline-shell support, and Time 2.0 historical replay.

Time 2.0 exposes **24H / 7D / 30D** historical ranges while keeping future simulation capped at +24H. A guided **24H REPLAY** runs the previous day at 1000× and reconnects automatically to LIVE. Deep historical replay prioritizes observed Earth data; current CelesTrak OMM propagation is deliberately suppressed outside its certified ±24-hour window.

Automated release certification runs TypeScript validation, unit tests, the production Vite build, service-worker precache generation, and post-build release verification before Pages deployment. Real interactive browser/device acceptance remains a separate manual check.

'''
text = text[:start] + status + text[end:]
text = text.replace(
    '- left: four primary signal layers with USGS earthquake, NASA EONET, CelesTrak orbit, and NOAA SWPC/aurora controls',
    '- left: five primary layers with NASA GIBS weather, USGS earthquakes, NASA EONET events, CelesTrak orbit, and NOAA SWPC/aurora controls',
)
text = text.replace(
    '- bottom: interactive ±24 h simulation timeline',
    '- bottom: Time 2.0 timeline with 24H / 7D / 30D replay ranges and a +24H future cap',
)
old_timeline = '''### Timeline

- drag the timeline from −24h to +24h
- presets: −24h, −6h, −1h, NOW, +6h, +24h
- playback: 1×, 10×, 100×, 1000×
- seeking pauses at the chosen timestamp
- LIVE explicitly reconnects to wall time
- playback stops safely at timeline boundaries
'''
new_timeline = '''### Timeline

- choose a **24H**, **7D**, or **30D** historical range
- future simulation remains capped at **+24H**
- range-aware presets and scrub precision
- playback: 1×, 10×, 100×, 1000×
- **24H REPLAY** plays the previous day at 1000× and stops automatically at LIVE
- visible earthquake/event counts update with simulation time
- deep replay uses observed Earth history; Orbit is explicitly unavailable beyond ±24H
- seeking pauses at the chosen timestamp; LIVE explicitly reconnects to wall time
'''
if old_timeline in text:
    text = text.replace(old_timeline, new_timeline, 1)
text = text.replace('- global simulation window is approximately ±24 hours', '- global simulation window supports 30 days of historical replay and 24 hours of future simulation')
if '- [`docs/PHASE-16-ACCEPTANCE.md`](docs/PHASE-16-ACCEPTANCE.md)' not in text:
    text = text.replace(
        '- [`docs/PHASE-15-ACCEPTANCE.md`](docs/PHASE-15-ACCEPTANCE.md)\n',
        '- [`docs/PHASE-15-ACCEPTANCE.md`](docs/PHASE-15-ACCEPTANCE.md)\n- [`docs/PHASE-16-ACCEPTANCE.md`](docs/PHASE-16-ACCEPTANCE.md)\n- [`docs/PHASE-17-ACCEPTANCE.md`](docs/PHASE-17-ACCEPTANCE.md)\n- [`docs/PHASE-18-ACCEPTANCE.md`](docs/PHASE-18-ACCEPTANCE.md)\n',
        1,
    )
readme.write_text(text, encoding='utf-8')
