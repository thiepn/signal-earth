from pathlib import Path
import json

def replace(path: str, old: str, new: str, count: int=1):
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f'{path}: expected at least {count} occurrence(s), found {actual}: {old[:140]!r}')
    target.write_text(text.replace(old, new, count), encoding='utf-8')
replace('src/features/share/shareState.ts', '  layers: Record<LayerId, boolean>;\n  clock: SimulationClockSnapshot | null;', '  layers: Record<LayerId, boolean>;\n  weatherSettings: WeatherLayerSettings;\n  clock: SimulationClockSnapshot | null;', 1)
replace('src/features/share/shareState.ts', "const LAYERS: LayerId[] = ['earthquakes', 'events', 'orbit', 'aurora'];", "const LAYERS: LayerId[] = ['weather', 'earthquakes', 'events', 'orbit', 'aurora'];", 1)
replace('src/features/share/shareState.ts', "  q.set('layers', enabledList(state.layers, LAYERS));\n\n  if (!state.clock || state.clock.mode === 'live') {", "  q.set('layers', enabledList(state.layers, LAYERS));\n  q.set('wx', `${state.weatherSettings.clouds ? 'c' : ''}${state.weatherSettings.precipitation ? 'p' : ''}${state.weatherSettings.stormTracks ? 's' : ''}` || 'none');\n  q.set('wo', fixed(state.weatherSettings.opacity, 2));\n\n  if (!state.clock || state.clock.mode === 'live') {", 1)
replace('src/features/share/shareState.ts', "  const layers = enabledMap(q.get('layers'), LAYERS);\n  if (layers) parsed.layers = layers;\n\n  const time = q.get('time');", "  const layers = enabledMap(q.get('layers'), LAYERS);\n  if (layers) parsed.layers = layers;\n\n  const weatherFlags = q.get('wx');\n  const weatherOpacity = finiteNumber(q.get('wo'));\n  if (weatherFlags !== null || weatherOpacity !== null) {\n    const flags = weatherFlags ?? 'cs';\n    parsed.weatherSettings = {\n      clouds: flags.includes('c'),\n      precipitation: flags.includes('p'),\n      stormTracks: flags.includes('s'),\n      opacity: Math.max(0.25, Math.min(1, weatherOpacity ?? DEFAULT_WEATHER_SETTINGS.opacity)),\n    };\n  }\n\n  const time = q.get('time');", 1)
replace('src/features/search/index.ts', "const SYSTEM_DOCUMENTS: SearchDocument[] = [\n  { id: 'layer:earthquakes'", "const SYSTEM_DOCUMENTS: SearchDocument[] = [\n  { id: 'layer:weather', kind: 'layer', title: 'Weather', subtitle: 'NASA cloud, precipitation and storm context', keywords: ['weather layer', 'atmosphere', 'cloud', 'clouds', 'precipitation', 'rain', 'gibs', 'imerg', 'viirs'], layer: 'weather', priority: 88 },\n  { id: 'layer:earthquakes'", 1)
replace('src/features/search/commands.ts', 'const LAYERS: Record<string, LayerId> = {\n  earthquake:', "const LAYERS: Record<string, LayerId> = {\n  atmosphere: 'weather', cloud: 'weather', clouds: 'weather', precipitation: 'weather', rain: 'weather', 'weather layer': 'weather',\n  earthquake:", 1)
replace('src/features/search/commands.ts', "'goto tokyo', 'follow iss', 'show earthquakes', 'only weather', 'hide aurora',", "'goto tokyo', 'follow iss', 'show earthquakes', 'show clouds', 'hide aurora',", 1)
replace('src/features/globe/GlobeViewport.tsx', "import { EarthRenderer } from '../../core/engine/EarthRenderer';", "import { EarthRenderer } from '../../core/engine/EarthRenderer';\nimport { AtmosphereRenderer } from '../../core/engine/AtmosphereRenderer';", 1)
replace('src/features/globe/GlobeViewport.tsx', "import type { ObserverLocation, ObserverPassForecast, ObserverSkySnapshot, ObserverSkySatellite } from '../above-me/types';", "import type { ObserverLocation, ObserverPassForecast, ObserverSkySnapshot, ObserverSkySatellite } from '../above-me/types';\nimport type { AtmosphereStatus, WeatherLayerSettings } from '../weather/types';", 1)
replace('src/features/globe/GlobeViewport.tsx', '  captureStream(fps?: number): MediaStream | null;\n}', '  captureStream(fps?: number): MediaStream | null;\n  refreshAtmosphere(): void;\n}', 1)
