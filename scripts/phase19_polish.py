from pathlib import Path
import json

css_path = Path('src/ui/styles/global.css')
css = css_path.read_text()
marker = '/* Phase 19 — Observatory UX 2.0 */'
if marker not in css:
    css += r'''

/* Phase 19 — Observatory UX 2.0 */
.top-bar {
  grid-template-columns: minmax(180px, .72fr) minmax(190px, .55fr) auto;
  gap: 12px;
  padding-right: 7px;
}
.brand-copy small { letter-spacing: .055em; }
.top-runtime { display: inline-flex; align-items: center; gap: 7px; }
.top-bar__actions { gap: 5px; }
.top-action--primary {
  border-color: rgba(152,244,199,.28);
  background: rgba(152,244,199,.075);
  color: #dfffee;
}
.top-action--primary:hover { border-color: rgba(152,244,199,.42); background: rgba(152,244,199,.12); }
.top-action__live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--se-success); box-shadow: 0 0 9px rgba(152,244,199,.72); }
.top-search-action {
  height: 34px;
  min-width: 132px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 0 7px 0 10px;
  border: 1px solid var(--se-line);
  border-radius: 9px;
  background: rgba(255,255,255,.025);
  color: var(--se-text-soft);
  cursor: pointer;
  text-align: left;
}
.top-search-action:hover { border-color: var(--se-line-strong); background: rgba(255,255,255,.055); }
.top-search-action__icon { color: var(--se-accent); font-size: .95rem; }
.top-search-action__copy { font-size: .7rem; }
.top-search-action kbd {
  min-width: 21px;
  height: 21px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--se-line);
  border-radius: 5px;
  background: rgba(0,0,0,.22);
  color: var(--se-dim);
  font: 600 .55rem/1 var(--se-mono);
}
.top-secondary-actions { display: inline-flex; align-items: center; gap: 4px; padding-left: 3px; border-left: 1px solid var(--se-line); }
.top-action--secondary { border-color: transparent; background: transparent; padding-inline: 8px; }
.top-action--secondary:hover { border-color: var(--se-line); }
.top-settings-button { margin-left: 1px; }

.desktop-left { width: 280px; }
.layer-panel { overflow: hidden; }
.layer-panel--compact { width: 100%; }
.layer-panel__header { padding-bottom: 9px; }
.layer-list--contextual { display: grid; gap: 3px; padding: 0 7px 7px; }
.layer-row {
  min-height: 51px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 39px;
  gap: 0;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  cursor: default;
  transition: border-color .16s ease, background .16s ease;
}
.layer-row:hover { background: rgba(255,255,255,.025); }
.layer-row.is-enabled { background: rgba(158,231,255,.028); }
.layer-row.is-focused { border-color: rgba(158,231,255,.18); background: rgba(158,231,255,.06); }
.layer-row__main {
  min-width: 0;
  min-height: 49px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 5px 5px 5px 7px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.layer-row__main:focus-visible { border-radius: 8px; }
.layer-row .phase-chip { justify-self: end; }
.phase-chip--obs { color: #90cfff; }
.phase-chip--prop { color: #c8adff; }
.phase-chip--nrt { color: #9ceac8; }
.layer-toggle {
  min-width: 39px;
  min-height: 49px;
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid rgba(255,255,255,.035);
  background: transparent;
  cursor: pointer;
}
.layer-toggle:hover { background: rgba(255,255,255,.035); }
.layer-context-controls {
  margin: 1px 7px 7px;
  max-height: min(52vh, 470px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(158,231,255,.09);
  border-radius: 10px;
  background: rgba(3,9,14,.52);
  scrollbar-width: thin;
}
.layer-context-controls__head {
  position: sticky;
  z-index: 3;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 31px;
  padding: 0 10px;
  border-bottom: 1px solid var(--se-line);
  background: rgba(4,10,16,.9);
  backdrop-filter: blur(12px);
  color: var(--se-dim);
  font: 600 .49rem/1 var(--se-mono);
  letter-spacing: .07em;
}
.layer-context-controls .quake-controls,
.layer-context-controls .natural-event-controls,
.layer-context-controls .orbit-controls,
.layer-context-controls .space-weather-controls,
.layer-context-controls .weather-controls { border-top: 0; }
.layer-focus-empty { display: grid; grid-template-columns: auto 1fr; gap: 9px 10px; align-items: center; padding: 13px 12px; }
.layer-focus-empty__glyph { width: 31px; height: 31px; display: grid; place-items: center; border: 1px solid var(--se-line); border-radius: 8px; color: var(--se-dim); }
.layer-focus-empty strong { display: block; font-size: .72rem; color: var(--se-text-soft); }
.layer-focus-empty p { margin: 4px 0 0; color: var(--se-dim); font-size: .62rem; line-height: 1.45; }
.layer-focus-empty .secondary-button { grid-column: 1 / -1; min-height: 34px; }

.desktop-right--active { animation: se-inspector-in .2s ease-out both; }
@keyframes se-inspector-in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
.app-shell:not(.has-selection) .desktop-timeline { width: min(980px, calc(100vw - 350px)); }

.hover-preview {
  position: fixed;
  z-index: 19;
  width: 270px;
  min-height: 92px;
  padding: 10px 11px 9px;
  pointer-events: none;
  background: rgba(3,9,14,.9);
  border-color: rgba(158,231,255,.18);
  animation: se-hover-in .11s ease-out both;
}
@keyframes se-hover-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
.hover-preview__top { display: flex; justify-content: space-between; gap: 10px; color: var(--se-accent); font: 650 .5rem/1 var(--se-mono); letter-spacing: .08em; }
.hover-preview__top strong { color: var(--se-text); font-size: .61rem; }
.hover-preview__title { margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--se-text); font-size: .76rem; font-weight: 620; }
.hover-preview__detail { margin-top: 4px; color: var(--se-muted); font: 500 .58rem/1.35 var(--se-mono); }
.hover-preview__source { margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--se-line); color: var(--se-dim); font: 550 .45rem/1 var(--se-mono); letter-spacing: .055em; }

@media (max-width: 1320px) {
  .top-bar { grid-template-columns: minmax(170px,.7fr) auto; }
  .top-bar__center { display: none; }
  .top-secondary-actions .top-action__label { display: none; }
  .top-action--secondary { width: 34px; justify-content: center; padding: 0; }
  .top-search-action { min-width: 108px; }
}

@media (max-width: 1000px) {
  .desktop-left { width: 246px; }
  .app-shell:not(.has-selection) .desktop-timeline { width: min(650px, calc(100vw - 520px)); }
}

@media (max-width: 760px) {
  .hover-preview { display: none; }
  .layer-panel--compact .layer-list--contextual { padding: 0 0 8px; }
  .layer-panel--compact .layer-context-controls { margin: 0; max-height: none; }
  .layer-row__main, .layer-toggle { min-height: 52px; }
  .top-runtime { display: none; }
}

@media (pointer: coarse) {
  .hover-preview { display: none; }
  .layer-toggle { min-width: 44px; }
}
'''
    css_path.write_text(css)

# Version metadata.
version_path = Path('src/app/version.ts')
version_text = version_path.read_text().replace("export const APP_VERSION = '1.3.0';", "export const APP_VERSION = '1.4.0';")
version_path.write_text(version_text)

package_path = Path('package.json')
package_data = json.loads(package_path.read_text())
package_data['version'] = '1.4.0'
package_path.write_text(json.dumps(package_data, indent=2) + '\n')

# Keep the public repository description aligned with the product users see.
readme = Path('README.md').read_text()
readme = readme.replace('**Signal Earth v1.3.0 — Phase 18 Time 2.0** is production-built and release-certified for GitHub Pages.', '**Signal Earth v1.4.0 — Phase 19 Observatory UX 2.0** is production-built and release-certified for GitHub Pages.')
readme = readme.replace('The current product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), observer-relative Above Me tools, shareable public views, PNG capture, optional 10-second recording, PWA/offline-shell support, and Time 2.0 historical replay.', 'The current product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), observer-relative Above Me tools, shareable public views, PNG capture, optional 10-second recording, PWA/offline-shell support, Time 2.0 historical replay, and the Observatory UX 2.0 interaction layer.')
readme = readme.replace('Time 2.0 exposes **24H / 7D / 30D** historical ranges while keeping future simulation capped at +24H. A guided **24H REPLAY** runs the previous day at 1000× and reconnects automatically to LIVE. Deep historical replay prioritizes observed Earth data; current CelesTrak OMM propagation is deliberately suppressed outside its certified ±24-hour window.\n', 'Time 2.0 exposes **24H / 7D / 30D** historical ranges while keeping future simulation capped at +24H. A guided **24H REPLAY** runs the previous day at 1000× and reconnects automatically to LIVE. Deep historical replay prioritizes observed Earth data; current CelesTrak OMM propagation is deliberately suppressed outside its certified ±24-hour window.\n\nObservatory UX 2.0 adds contextual one-layer-at-a-time controls, zoom-aware country/city labels and country borders, hover-before-click signal previews, a selection-driven desktop inspector, and direct mobile Search access. These are presentation and interaction improvements; they do not change source semantics.\n')
readme = readme.replace('- top bar: app/time status, current UTC, search, planetary briefings, Above Me, display settings\n- left: five primary layers with NASA GIBS weather, USGS earthquakes, NASA EONET events, CelesTrak orbit, and NOAA SWPC/aurora controls\n- right: selected-object inspector\n- bottom: Time 2.0 timeline with 24H / 7D / 30D replay ranges and a +24H future cap\n- globe: drag/pinch/scroll navigation; click earthquakes, NASA natural events, or propagated satellites to inspect them; click Earth to create a surface target', '- top bar: primary **Now** and **Search** actions, compact time state, then secondary Brief / Here / Display tools\n- left: five primary layers, with only the selected layer’s detailed controls expanded\n- right: selected-object inspector appears only when an object is selected\n- bottom: Time 2.0 timeline with 24H / 7D / 30D replay ranges and a +24H future cap\n- globe: zoom-aware country/city context and country borders; hover signals for a compact preview, click to inspect, or click Earth to create a surface target')
readme = readme.replace('- persistent bottom dock\n- one bottom sheet at a time for Layers, Here, Time, or Inspect\n- the Time sheet exposes the same timeline state and controls as desktop', '- persistent bottom dock prioritizing **Now / Search / Layers / Time / Here**\n- one bottom sheet at a time; selecting a globe signal opens Inspect automatically\n- the Time sheet exposes the same timeline state and controls as desktop')
readme = readme.replace('- Three.js + Globe.gl for rendering\n', '- Three.js + Globe.gl for rendering\n- presentation-only Natural Earth borders and zoom-aware geographic labels are isolated in a dedicated renderer and can fail without affecting signal layers\n- hover previews are renderer callbacks into low-frequency React UI state; high-frequency render data remains outside React\n')
readme = readme.replace('- [`docs/PHASE-18-ACCEPTANCE.md`](docs/PHASE-18-ACCEPTANCE.md)\n', '- [`docs/PHASE-18-ACCEPTANCE.md`](docs/PHASE-18-ACCEPTANCE.md)\n- [`docs/PHASE-19-ACCEPTANCE.md`](docs/PHASE-19-ACCEPTANCE.md)\n')
Path('README.md').write_text(readme)

print('Phase 19 visual polish and release metadata applied.')
