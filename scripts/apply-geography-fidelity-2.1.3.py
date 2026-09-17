from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_0_countries.json'
DEST = ROOT / 'public/data/natural-earth-50m-countries.geojson'


def round_coords(value):
    if isinstance(value, list):
        return [round_coords(item) for item in value]
    if isinstance(value, float):
        return round(value, 4)
    return value


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one patch target, got {count}')
    target.write_text(text.replace(old, new, 1))


print(f'Downloading Natural Earth 1:50m countries from {SOURCE}')
with urllib.request.urlopen(SOURCE, timeout=60) as response:
    payload = json.load(response)

features = []
for feature in payload.get('features', []):
    geometry = feature.get('geometry') or {}
    if geometry.get('type') not in {'Polygon', 'MultiPolygon'}:
        continue
    props = feature.get('properties') or {}
    name = props.get('NAME') or props.get('ADMIN') or props.get('name') or ''
    features.append({
        'type': 'Feature',
        'properties': {'name': name},
        'geometry': {
            'type': geometry['type'],
            'coordinates': round_coords(geometry.get('coordinates')),
        },
    })

if len(features) < 200:
    raise SystemExit(f'Natural Earth 50m import unexpectedly small: {len(features)} features')

DEST.parent.mkdir(parents=True, exist_ok=True)
DEST.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')))
size = DEST.stat().st_size
if not (750_000 <= size <= 4_500_000):
    raise SystemExit(f'Natural Earth 50m slim asset has unexpected size: {size:,} bytes')
print(f'Wrote {len(features)} features / {size:,} bytes to {DEST.relative_to(ROOT)}')

replace_once(
    'src/core/engine/EarthRenderer.ts',
    "    const curvature = profile.effects === 'reduced' ? 10 : profile.effects === 'normal' ? 6 : 4;\n    this.#context.globe\n      .globeCurvatureResolution(curvature)\n",
    "    // Sphere shape is geographic fidelity, not an effects budget. Keeping\n    // this constant prevents reduced-quality mode from turning close views\n    // into visibly faceted 10-degree globe patches.\n    this.#context.globe\n      .globeCurvatureResolution(2)\n",
)

replace_once(
    'src/features/globe/GlobeViewportBase.tsx',
    "import { GeoContextRenderer } from '../../core/engine/GeoContextRenderer';\n",
    "import { GeoContextRenderer } from '../../core/engine/GeoContextRenderer';\nimport { GeographyRenderer } from '../../core/engine/GeographyRenderer';\n",
)
replace_once(
    'src/features/globe/GlobeViewportBase.tsx',
    "    const geoContext = new GeoContextRenderer({ getVisualMode: () => callbacksRef.current.visualMode, onNavigate: (label) => callbacksRef.current.onGeoContextNavigate?.(label) });\n",
    "    const geoContext = new GeoContextRenderer({ getVisualMode: () => callbacksRef.current.visualMode, onNavigate: (label) => callbacksRef.current.onGeoContextNavigate?.(label) });\n    const geography = new GeographyRenderer({ getVisualMode: () => callbacksRef.current.visualMode });\n",
)
replace_once(
    'src/features/globe/GlobeViewportBase.tsx',
    "      engine.registerRenderer(geoContext);\n      engine.registerRenderer(atmosphere);\n",
    "      engine.registerRenderer(geoContext);\n      // Register after GeoContext: its legacy mount clears the polygon layer.\n      // Geography owns that layer from this point forward.\n      engine.registerRenderer(geography);\n      engine.registerRenderer(atmosphere);\n",
)

performance_spec = ROOT / 'tests/e2e/performance.spec.ts'
text = performance_spec.read_text()
if "regional geography uses the bundled 50m vector surface" not in text:
    text += """

test('regional geography uses the bundled 50m vector surface @performance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Geography fidelity gate runs once on Chromium desktop.');
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(
    async () => canvas.getAttribute('data-geography-detail'),
    { timeout: 15_000, message: 'The rendered Earth must use bundled 1:50m vector geography rather than the low-res fallback.' },
  ).toBe('50m');
});
"""
    performance_spec.write_text(text)

unit_test = ROOT / 'src/tests/geography-fidelity.test.ts'
unit_test.write_text("""import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Coordinates = unknown;

function countPoints(value: Coordinates): number {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return 1;
  return value.reduce<number>((sum, item) => sum + countPoints(item), 0);
}

describe('geography fidelity', () => {
  it('bundles regional-scale Natural Earth vector geometry', () => {
    const raw = readFileSync(new URL('../../public/data/natural-earth-50m-countries.geojson', import.meta.url), 'utf8');
    const payload = JSON.parse(raw) as { features?: Array<{ geometry?: { coordinates?: unknown } }> };
    const features = payload.features ?? [];
    const pointCount = features.reduce((sum, feature) => sum + countPoints(feature.geometry?.coordinates), 0);
    expect(features.length).toBeGreaterThan(200);
    expect(pointCount).toBeGreaterThan(20_000);
  });

  it('keeps globe curvature independent from reduced effects quality', () => {
    const source = readFileSync(new URL('../core/engine/EarthRenderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('.globeCurvatureResolution(2)');
    expect(source).not.toContain("profile.effects === 'reduced' ? 10");
  });

  it('renders land through the vector polygon layer instead of the baked raster coastline', () => {
    const source = readFileSync(new URL('../core/engine/GeographyRenderer.ts', import.meta.url), 'utf8');
    expect(source).toContain("natural-earth-50m-countries.geojson");
    expect(source).toContain('.polygonCapCurvatureResolution(1)');
    expect(source).toContain('globeMaterial.colorWrite = false');
  });
});
""")

print('Applied geography-fidelity source and regression-test patches.')
