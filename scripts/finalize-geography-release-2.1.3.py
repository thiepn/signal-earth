from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, got {count}')
    target.write_text(text.replace(old, new, 1))


# Runtime version identity. package.json/package-lock.json are updated by npm version.
Path('src/app/version.ts').write_text("export const APP_VERSION = '2.1.3';\n")

# Share one regional-LOD threshold between the detailed surface and the old
# overview context lines. This prevents a low-resolution outline from being
# drawn over the corrected 1:50m coastline.
replace_once(
    'src/core/engine/geographyFidelity.ts',
    "export const GEOGRAPHY_FALLBACK_PATH = 'data/natural-earth-lowres.geojson';\n\n",
    "export const GEOGRAPHY_FALLBACK_PATH = 'data/natural-earth-lowres.geojson';\nexport const REGIONAL_GEOGRAPHY_MAX_ALTITUDE = 0.9;\n\n",
)

replace_once(
    'src/core/engine/GeographyRenderer.ts',
    "import { GEOGRAPHY_DETAIL_PATH, GEOGRAPHY_FALLBACK_PATH, LAND_CURVATURE_DEGREES } from './geographyFidelity';\n",
    "import { GEOGRAPHY_DETAIL_PATH, GEOGRAPHY_FALLBACK_PATH, LAND_CURVATURE_DEGREES, REGIONAL_GEOGRAPHY_MAX_ALTITUDE } from './geographyFidelity';\n",
)
replace_once('src/core/engine/GeographyRenderer.ts', 'const LOCAL_DETAIL_MAX_ALTITUDE = 0.9;\n', '')
replace_once(
    'src/core/engine/GeographyRenderer.ts',
    'const shouldUseDetail = pov.altitude <= LOCAL_DETAIL_MAX_ALTITUDE;',
    'const shouldUseDetail = pov.altitude <= REGIONAL_GEOGRAPHY_MAX_ALTITUDE;',
)

replace_once(
    'src/core/engine/GeoContextRenderer.ts',
    "import type { QualityProfile } from './QualityManager';\n",
    "import type { QualityProfile } from './QualityManager';\nimport { REGIONAL_GEOGRAPHY_MAX_ALTITUDE } from './geographyFidelity';\n",
)
replace_once(
    'src/core/engine/GeoContextRenderer.ts',
    "  update(timestamp: number): void {\n    if (!this.#context || timestamp - this.#lastUpdateAt < 500) return;\n    this.#lastUpdateAt = timestamp;\n    this.#syncLabels();\n  }\n",
    "  update(timestamp: number): void {\n    if (!this.#context) return;\n    // Detailed polygons own borders/coastlines at regional zoom. Keep the\n    // lightweight low-res context mesh for overview only.\n    if (this.#countryLines) {\n      this.#countryLines.visible = this.#context.globe.pointOfView().altitude > REGIONAL_GEOGRAPHY_MAX_ALTITUDE;\n    }\n    if (timestamp - this.#lastUpdateAt < 500) return;\n    this.#lastUpdateAt = timestamp;\n    this.#syncLabels();\n  }\n",
)
replace_once(
    'src/core/engine/GeoContextRenderer.ts',
    "    lines.name = 'signal-earth-country-boundaries';\n    lines.renderOrder = 2;\n",
    "    lines.name = 'signal-earth-country-boundaries';\n    lines.renderOrder = 2;\n    lines.visible = this.#context.globe.pointOfView().altitude > REGIONAL_GEOGRAPHY_MAX_ALTITUDE;\n",
)

replace_once(
    'src/tests/geography-fidelity.test.ts',
    "  LAND_CURVATURE_DEGREES,\n",
    "  LAND_CURVATURE_DEGREES,\n  REGIONAL_GEOGRAPHY_MAX_ALTITUDE,\n",
)
replace_once(
    'src/tests/geography-fidelity.test.ts',
    "  it('keeps regional polygon fill tessellation bounded without simplifying coastline vertices', () => {\n    expect(LAND_CURVATURE_DEGREES).toBeLessThanOrEqual(5);\n  });\n",
    "  it('keeps regional polygon fill tessellation bounded without simplifying coastline vertices', () => {\n    expect(LAND_CURVATURE_DEGREES).toBeLessThanOrEqual(5);\n    expect(REGIONAL_GEOGRAPHY_MAX_ALTITUDE).toBe(0.9);\n  });\n",
)

Path('docs/RELEASE-2.1.3.md').write_text('''# Signal Earth 2.1.3

Signal Earth 2.1.3 fixes the blocky, low-detail geography exposed by close regional zoom while preserving the runtime-performance improvements shipped in 2.1.1 and 2.1.2.

## Geography fidelity correction

- Regional and local views now use bundled **Natural Earth 1:50m country geometry** instead of magnifying the low-resolution world-overview asset.
- The bundled regional asset contains 241 polygon features and roughly 99,600 source coordinate points after deterministic size reduction. Boundary vertices are preserved by the runtime renderer; quality adaptation does not simplify the coastline source data.
- The original textured globe remains the lightweight whole-Earth overview surface. At regional zoom, Signal Earth switches to a separate smooth ocean shell plus detailed vector land polygons so reduced overview tessellation cannot become the visible close-zoom coastline.
- The detailed layer is spatially culled around the current point of view rather than triangulating the entire 1:50m world on every frame.
- Polygon cap curvature is bounded at 5 degrees for interior spherical fill. This affects fill tessellation only; it does not discard coastline vertices.
- The older low-resolution country-outline mesh is overview-only. When the 1:50m regional layer is active, detailed polygon strokes own the visible coast/border line so coarse outlines cannot be drawn over corrected geography.
- If the detailed bundled asset cannot load, the existing low-resolution local asset remains a presentation fallback rather than breaking the observatory.

## Performance and regression protection

- A Chromium production regression moves the camera to the Istanbul region and verifies that runtime activates `regional-50m` geography rather than the low-resolution fallback.
- Existing capable-desktop resolution-floor and constrained-device cadence gates remain mandatory.
- The implementation passed Verify Release and the complete seven-target browser/device-emulation matrix across Chromium, Firefox, WebKit, ultrawide desktop, Android/Chromium, iPhone/WebKit and iPad/WebKit before release closure.
- The final stable commit is re-certified after version/docs/cleanup so the release tag, retained production artifact and deployment all resolve to one exact SHA.

## Data/source boundary

Natural Earth geometry is a bundled public-domain visual asset. Signal Earth makes no runtime Natural Earth network request and does not add a tile service or backend. The 1:50m geometry is presentation/cartographic context, not scientific observation data.

## Product boundary

No provider contract, normalized scientific schema, IndexedDB schema, observer privacy rule, Saved Worlds representation, astronomical/orbital math, service-worker reliability contract, or primary product workflow changes in 2.1.3.
''')

readme = Path('README.md')
text = readme.read_text()
old = '''**Signal Earth 2.1.2 — Adaptive visual-quality correction** is the current production release on GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

The final product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), Time 2.0 replay, Observatory UX 2.0, deterministic Signal Intelligence, Above Me 2.0, Orbit 2.0, Dynamic Briefings 2.0, Saved Worlds, shareable views, capture/recording, PWA/offline-shell support, progressive loading, cross-browser interaction hardening, Data Reliability 2.0, the Visual & Motion Finish presentation layer, Phase 29 release hardening, and Phase 30 exact-commit release closure.

Version **2.1.2** is the current stable release. Its canonical GitHub Release is published only after the exact production SHA passes Verify Release, 7/7 Cross-browser QA and GitHub Pages deployment.

## 2.1.2 adaptive visual-quality correction
'''
new = '''**Signal Earth 2.1.3 — Geography fidelity correction** is the current production release on GitHub Pages.

Live deployment: **https://thiepn.dev/signal-earth/**

The final product includes Signal Earth Now, five primary layers (Weather, Earthquakes, Natural Events, Orbit, Aurora), Time 2.0 replay, Observatory UX 2.0, deterministic Signal Intelligence, Above Me 2.0, Orbit 2.0, Dynamic Briefings 2.0, Saved Worlds, shareable views, capture/recording, PWA/offline-shell support, progressive loading, cross-browser interaction hardening, Data Reliability 2.0, the Visual & Motion Finish presentation layer, Phase 29 release hardening, and Phase 30 exact-commit release closure.

Version **2.1.3** is the current stable release. Its canonical GitHub Release is published only after the exact production SHA passes Verify Release, 7/7 Cross-browser QA and GitHub Pages deployment.

## 2.1.3 geography fidelity correction

Signal Earth 2.1.3 replaces magnified low-resolution world geography with a bundled Natural Earth 1:50m regional vector surface at close zoom. Whole-Earth overview rendering stays lightweight, while regional/local views switch to detailed land polygons and a smooth ocean shell with spatial culling. The low-resolution border mesh is hidden whenever detailed geography is active, preventing coarse outlines from being drawn over the corrected coastline. See [`docs/RELEASE-2.1.3.md`](docs/RELEASE-2.1.3.md).

## 2.1.2 adaptive visual-quality correction
'''
if text.count(old) != 1:
    raise SystemExit(f'README release-status target count = {text.count(old)}')
readme.write_text(text.replace(old, new, 1))

data_sources = Path('docs/DATA-SOURCES.md')
text = data_sources.read_text()
old = '''## Natural Earth — local visual assets

Natural Earth public-domain low-resolution vector geometry is bundled/used to generate the Phase 1 project-local Earth textures and geographic context assets.

Runtime behavior:

- no map tile requests
- no runtime Natural Earth network request
- 2K texture is the low/medium default
- 4K texture is lazy-selected by the high quality profile
- decorative surface variation in the generated texture is not scientific data

Courtesy attribution: **Made with Natural Earth — naturalearthdata.com**.
'''
new = '''## Natural Earth — local visual assets

Natural Earth public-domain geometry is bundled locally for cartographic presentation. The original low-resolution world geometry remains the lightweight overview/search/context fallback and the source for the Phase 1 project-local Earth textures. Signal Earth 2.1.3 additionally bundles a slimmed **1:50m admin-0 country geometry** asset for regional/local coastline and land rendering.

Runtime behavior:

- no map tile requests
- no runtime Natural Earth network request
- 2K texture is the low/medium overview default
- 4K texture is lazy-selected by the high quality profile
- regional/local zoom activates the bundled 1:50m vector land surface and spatially culls it around the camera
- performance quality may change framebuffer/effect cost but does not simplify the 1:50m coastline source vertices
- low-resolution geometry remains an asset-failure fallback and overview context rather than the close-zoom visible coastline
- decorative surface variation in the generated texture is not scientific data

Courtesy attribution: **Made with Natural Earth — naturalearthdata.com**.
'''
if text.count(old) != 1:
    raise SystemExit(f'DATA-SOURCES Natural Earth target count = {text.count(old)}')
data_sources.write_text(text.replace(old, new, 1))

print('Prepared Signal Earth 2.1.3 release sources and documentation.')
