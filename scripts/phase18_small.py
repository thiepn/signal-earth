from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# App action contract
replace_once(
    'src/app/actions.ts',
    "  | { type: 'SET_TIME_SPEED'; speed: SimulationSpeed }\n  | { type: 'RETURN_LIVE' }",
    "  | { type: 'SET_TIME_SPEED'; speed: SimulationSpeed }\n  | { type: 'START_REPLAY_TO_LIVE'; fromTimestamp: number; speed: Exclude<SimulationSpeed, 0> }\n  | { type: 'RETURN_LIVE' }",
)

# Command intent + parser
replace_once(
    'src/features/search/types.ts',
    "  | { type: 'play' }\n  | { type: 'speed'; speed: 1 | 10 | 100 | 1000 }",
    "  | { type: 'play' }\n  | { type: 'replay-day' }\n  | { type: 'speed'; speed: 1 | 10 | 100 | 1000 }",
)
replace_once(
    'src/features/search/commands.ts',
    "  const match = raw.match(/^([+-]?\\d+(?:\\.\\d+)?)\\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?$/i);",
    "  const match = raw.match(/^([+-]?\\d+(?:\\.\\d+)?)\\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)?$/i);",
)
replace_once(
    'src/features/search/commands.ts',
    "  const unit = match[2]?.toLowerCase();\n  return unit?.startsWith('m') ? value / 60 : value;",
    "  const unit = match[2]?.toLowerCase();\n  if (unit?.startsWith('m')) return value / 60;\n  if (unit?.startsWith('d')) return value * 24;\n  return value;",
)
replace_once(
    'src/features/search/commands.ts',
    "  if (['live', 'now', 'return live', 'go live'].includes(normalized)) return { intent: { type: 'live' }, canonical: 'live', description: 'Return the simulation to live time' };\n  if (['pause', 'stop time', 'freeze'].includes(normalized))",
    "  if (['live', 'now', 'return live', 'go live'].includes(normalized)) return { intent: { type: 'live' }, canonical: 'live', description: 'Return the simulation to live time' };\n  if (['replay 24h', 'replay day', 'last 24 hours', 'play last 24h'].includes(normalized)) return { intent: { type: 'replay-day' }, canonical: 'replay 24h', description: 'Replay the previous 24 hours and stop at LIVE' };\n  if (['pause', 'stop time', 'freeze'].includes(normalized))",
)
replace_once(
    'src/features/search/commands.ts',
    "      const signed = Math.max(-24, Math.min(24, Math.abs(hours) * (backwards ? -1 : 1)));",
    "      const absolute = Math.abs(hours);\n      const signed = backwards ? -Math.min(30 * 24, absolute) : Math.min(24, absolute);",
)
replace_once(
    'src/features/search/commands.ts',
    "  'mode night', 'speed 100x', 'rewind 6h', 'live', 'pause', 'reset', 'here', 'share', 'capture', 'record', 'briefing', 'earth now',",
    "  'mode night', 'speed 100x', 'rewind 7d', 'replay 24h', 'live', 'pause', 'reset', 'here', 'share', 'capture', 'record', 'briefing', 'earth now',",
)

# Share-state timeline range (backward-compatible query parameter)
replace_once(
    'src/features/share/shareState.ts',
    "import type { OrbitTrailMode } from '../orbit/playback';\nimport type { SatelliteCategory }",
    "import type { OrbitTrailMode } from '../orbit/playback';\nimport type { TimelineRange } from '../timeline/timeline';\nimport type { SatelliteCategory }",
)
replace_once(
    'src/features/share/shareState.ts',
    "  weatherSettings: WeatherLayerSettings;\n  clock: SimulationClockSnapshot | null;",
    "  weatherSettings: WeatherLayerSettings;\n  timelineRange: TimelineRange;\n  clock: SimulationClockSnapshot | null;",
)
replace_once(
    'src/features/share/shareState.ts',
    "const WINDOWS: EarthquakeTimeWindow[] = ['hour', 'day', 'week', 'month'];\nconst SAT_CATEGORIES",
    "const WINDOWS: EarthquakeTimeWindow[] = ['hour', 'day', 'week', 'month'];\nconst TIMELINE_RANGE_IDS: TimelineRange[] = ['day', 'week', 'month'];\nconst SAT_CATEGORIES",
)
replace_once(
    'src/features/share/shareState.ts',
    "  q.set('wo', fixed(state.weatherSettings.opacity, 2));\n\n  if (!state.clock",
    "  q.set('wo', fixed(state.weatherSettings.opacity, 2));\n  q.set('tr', state.timelineRange);\n\n  if (!state.clock",
)
replace_once(
    'src/features/share/shareState.ts',
    "  const layers = enabledMap(q.get('layers'), LAYERS);\n  if (layers) parsed.layers = layers;\n\n  const weatherFlags",
    "  const layers = enabledMap(q.get('layers'), LAYERS);\n  if (layers) parsed.layers = layers;\n\n  const timelineRange = q.get('tr') as TimelineRange | null;\n  if (timelineRange && TIMELINE_RANGE_IDS.includes(timelineRange)) parsed.timelineRange = timelineRange;\n\n  const weatherFlags",
)

# Tests for command range/replay and shared visible range
replace_once(
    'src/tests/search-commands.test.ts',
    "    expect(parseCommand('rewind 6h')?.intent).toEqual({ type: 'time-offset', hours: -6 });",
    "    expect(parseCommand('rewind 6h')?.intent).toEqual({ type: 'time-offset', hours: -6 });\n    expect(parseCommand('rewind 7d')?.intent).toEqual({ type: 'time-offset', hours: -168 });\n    expect(parseCommand('forward 7d')?.intent).toEqual({ type: 'time-offset', hours: 24 });\n    expect(parseCommand('replay 24h')?.intent).toEqual({ type: 'replay-day' });",
)
replace_once(
    'src/tests/share-state.test.ts',
    "  weatherSettings: { clouds: true, precipitation: true, stormTracks: false, opacity: 0.65 },\n  clock:",
    "  weatherSettings: { clouds: true, precipitation: true, stormTracks: false, opacity: 0.65 },\n  timelineRange: 'week',\n  clock:",
)
replace_once(
    'src/tests/share-state.test.ts',
    "    expect(parsed.weatherSettings).toEqual({ clouds: true, precipitation: true, stormTracks: false, opacity: 0.65 });\n    expect(parsed.selectedEntityId)",
    "    expect(parsed.weatherSettings).toEqual({ clouds: true, precipitation: true, stormTracks: false, opacity: 0.65 });\n    expect(parsed.timelineRange).toBe('week');\n    expect(parsed.selectedEntityId)",
)
