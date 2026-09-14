import type { BriefingDefinition, BriefingId } from './types';

const fallbackEarthNow: BriefingDefinition = {
  id: 'earth-now', eyebrow: 'LIVE BRIEFING', title: 'Earth Right Now',
  description: 'A data-driven tour of the strongest current Earth, space-weather and orbital signals.', estimatedSeconds: 38,
  dataDriven: true, dataState: 'fallback', dataSummary: 'Refreshes public provider snapshots when the launcher opens.',
  steps: [
    { id: 'earth-overview', eyebrow: 'EARTH RIGHT NOW', title: 'Planetary overview', body: 'Signal Earth will use the latest available public provider snapshots for this tour.', holdMs: 4_000, instructions: [{ type: 'return-live' }, { type: 'set-speed', speed: 1 }, { type: 'set-visual-mode', mode: 'earth' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'frame-earth', lat: 18, lng: 8, altitude: 2.25, durationMs: 1_200 }] },
    { id: 'earth-quake', eyebrow: 'SEISMIC', title: 'Strongest recent earthquake', body: 'The strongest applicable USGS event is selected from the loaded day feed.', holdMs: 6_000, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] },
    { id: 'earth-event', eyebrow: 'NATURAL EVENTS', title: 'Featured active event', body: 'The tour chooses a currently applicable NASA EONET event.', holdMs: 6_000, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] },
    { id: 'earth-space', eyebrow: 'SPACE WEATHER', title: 'Earth meets space', body: 'NOAA auroral context is shown on the night-facing globe.', holdMs: 5_000, instructions: [{ type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'set-visual-mode', mode: 'night' }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 63, lng: 5, altitude: 2.0 }] },
    { id: 'earth-return', eyebrow: 'GLOBAL', title: 'One planet, distinct data semantics', body: 'Observed events, propagated orbits and modeled space weather remain explicitly separate.', holdMs: 3_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth' }] },
  ],
};

const fallbackOrbitNow: BriefingDefinition = {
  id: 'orbit-now', eyebrow: 'LIVE ORBIT BRIEFING', title: 'Orbit Highlights',
  description: 'A data-driven tour through stations, weather, navigation and Earth-observation missions.', estimatedSeconds: 39,
  dataDriven: true, dataState: 'fallback', dataSummary: 'Refreshes the cached CelesTrak catalog when opened.',
  steps: [
    { id: 'orbit-stage', eyebrow: 'ORBIT HIGHLIGHTS', title: 'Near-Earth space', body: 'Curated CelesTrak OMM groups are propagated locally with SGP4/SDP4.', holdMs: 4_000, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: 'signal' }, { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'set-orbit-categories', categories: ['stations', 'weather', 'earth-observation', 'navigation', 'science'] }, { type: 'frame-earth', lat: 15, lng: 0, altitude: 2.55 }] },
    { id: 'orbit-iss', eyebrow: 'STATIONS', title: 'International Space Station', body: 'Follow a propagated station position above the Earth-fixed globe.', holdMs: 7_000, instructions: [{ type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }] },
    { id: 'orbit-weather', eyebrow: 'WEATHER', title: 'Weather mission', body: 'A meteorological spacecraft reveals its orbital plane and ground track.', holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'weather' }, { type: 'frame-selected-orbit' }] },
    { id: 'orbit-navigation', eyebrow: 'NAVIGATION', title: 'Navigation orbit', body: 'A navigation spacecraft shows the scale difference between LEO and MEO.', holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'navigation' }, { type: 'frame-selected-orbit' }] },
    { id: 'orbit-return', eyebrow: 'ORBITAL CONTEXT', title: 'Propagated, not measured live', body: 'Every displayed spacecraft position comes from loaded orbital elements and local propagation.', holdMs: 3_500, instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.65 }] },
  ],
};

export const BRIEFINGS: Record<BriefingId, BriefingDefinition> = {
  'earth-now': fallbackEarthNow,
  'seismic-now': {
    id: 'seismic-now', eyebrow: 'LIVE SEISMIC BRIEFING', title: 'Seismic Activity', description: 'Current USGS earthquake activity summarized from the latest day feed.', estimatedSeconds: 22,
    dataDriven: true, dataState: 'fallback', dataSummary: 'Waiting for a USGS briefing snapshot.',
    steps: [
      { id: 'seismic-stage', eyebrow: 'SEISMIC ACTIVITY', title: 'Last 24 hours', body: 'The tour opens the USGS day feed at a useful global scale.', holdMs: 4_000, instructions: [{ type: 'return-live' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'frame-earth', altitude: 2.1 }] },
      { id: 'seismic-strongest', eyebrow: 'STRONGEST SIGNAL', title: 'Largest current event', body: 'The strongest applicable event is selected directly from the loaded feed.', holdMs: 7_000, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] },
      { id: 'seismic-return', eyebrow: 'GLOBAL CONTEXT', title: 'Back to the seismic field', body: 'Return to the full day of observed earthquake signals.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.15 }] },
    ],
  },
  'storm-watch': {
    id: 'storm-watch', eyebrow: 'LIVE EVENT BRIEFING', title: 'Active Storms', description: 'Current severe-storm observations from NASA EONET.', estimatedSeconds: 22,
    dataDriven: true, dataState: 'fallback', dataSummary: 'Waiting for a NASA EONET briefing snapshot.',
    steps: [
      { id: 'storm-stage', eyebrow: 'ACTIVE STORMS', title: 'Observed storm field', body: 'Only severe-storm EONET records are staged for the tour.', holdMs: 4_000, instructions: [{ type: 'return-live' }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'set-natural-event-categories', categories: ['severe-storm'] }, { type: 'frame-earth', altitude: 2.15 }] },
      { id: 'storm-featured', eyebrow: 'FEATURED STORM', title: 'Latest tracked system', body: 'Signal Earth focuses a source-observed EONET storm record without extrapolating its track.', holdMs: 7_000, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] },
      { id: 'storm-return', eyebrow: 'GLOBAL CONTEXT', title: 'Storms in context', body: 'Return to the current globally loaded severe-storm observations.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.2 }] },
    ],
  },
  'space-weather-now': {
    id: 'space-weather-now', eyebrow: 'LIVE SPACE-WEATHER BRIEFING', title: 'Space Weather', description: 'Current NOAA Kp, G/R/S scale and OVATION context.', estimatedSeconds: 18,
    dataDriven: true, dataState: 'fallback', dataSummary: 'Waiting for a NOAA SWPC briefing snapshot.',
    steps: [
      { id: 'space-stage', eyebrow: 'SPACE WEATHER', title: 'Geomagnetic context', body: 'The tour enables NOAA-derived auroral context on the night globe.', holdMs: 5_000, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: 'night' }, { type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'frame-earth', lat: 67, lng: 15, altitude: 1.8 }] },
      { id: 'space-wide', eyebrow: 'SUN–EARTH SYSTEM', title: 'Current model context', body: 'Operational scales and auroral modeling remain distinct from observed Earth events.', holdMs: 6_000, instructions: [{ type: 'frame-earth', lat: 50, lng: -20, altitude: 2.2 }] },
      { id: 'space-return', eyebrow: 'GLOBAL', title: 'Back to Earth', body: 'The tour returns control without changing NOAA source semantics.', holdMs: 3_000, instructions: [{ type: 'frame-earth' }] },
    ],
  },
  'above-me': {
    id: 'above-me', eyebrow: 'OBSERVER BRIEFING', title: 'Above Me', description: 'Local Sun, Moon, weather and aurora context for a remembered observer coordinate.', estimatedSeconds: 14,
    dataDriven: true, dataState: 'unavailable', dataSummary: 'Requires a remembered observer coordinate.', available: false, unavailableReason: 'Open Above Me, use your location, then enable “Remember this coordinate” to build a local briefing.',
    steps: [{ id: 'observer-fallback', eyebrow: 'ABOVE ME', title: 'Observer location required', body: 'Signal Earth will not request location merely to generate a briefing. Location remains explicit opt-in.', holdMs: 5_000, instructions: [{ type: 'frame-earth' }] }],
  },
  'orbit-now': fallbackOrbitNow,
  'last-24h': {
    id: 'last-24h', eyebrow: 'DATA RECAP', title: 'Last 24 Hours', description: 'A source-grounded recap of the previous day across earthquakes and natural events.', estimatedSeconds: 27,
    dataDriven: true, dataState: 'fallback', dataSummary: 'Waiting for day-scale Earth-event snapshots.',
    steps: [
      { id: 'day-stage', eyebrow: 'LAST 24 HOURS', title: 'A day of Earth signals', body: 'USGS day-scale earthquakes and current EONET observations form the recap.', holdMs: 5_000, instructions: [{ type: 'return-live' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'frame-earth', altitude: 2.25 }] },
      { id: 'day-quake', eyebrow: 'SEISMIC HIGHLIGHT', title: 'Largest earthquake', body: 'The strongest event in the loaded day feed is highlighted.', holdMs: 7_000, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] },
      { id: 'day-event', eyebrow: 'EARTH EVENT', title: 'Natural-event highlight', body: 'A source-observed EONET event provides a second view of the day.', holdMs: 7_000, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] },
      { id: 'day-return', eyebrow: '24-HOUR RECAP', title: 'Back to the full globe', body: 'The recap ends at live time with the original data semantics intact.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth' }] },
    ],
  },
  'planet-motion': {
    id: 'planet-motion', eyebrow: 'TIME BRIEFING', title: 'Planet in Motion', description: 'Accelerate the shared simulation clock and watch daylight and orbital motion evolve together.', estimatedSeconds: 34,
    dataState: 'static',
    steps: [
      { id: 'motion-start', eyebrow: 'PLANET IN MOTION', title: 'One shared clock', body: 'Sunlight, Earth systems and satellite propagation all read the same simulation timestamp.', holdMs: 4_000, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: 'signal' }, { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 20, lng: -25, altitude: 2.5 }] },
      { id: 'speed-100', eyebrow: 'TIME ×100', title: 'Accelerated orbit', body: 'Predictive ephemeris windows keep satellite motion continuous without running SGP4 at rendering frequency.', holdMs: 7_000, instructions: [{ type: 'set-speed', speed: 100 }] },
      { id: 'speed-1000', eyebrow: 'TIME ×1000', title: 'Hours become seconds', body: 'The terminator advances across Earth while satellite constellations sweep through their orbits.', holdMs: 10_000, instructions: [{ type: 'set-speed', speed: 1000 }] },
      { id: 'night-motion', eyebrow: 'DAY / NIGHT', title: 'The moving terminator', body: 'Night presentation makes the shared astronomical time model especially visible.', holdMs: 7_000, instructions: [{ type: 'set-visual-mode', mode: 'night' }, { type: 'frame-earth', lat: 25, lng: 80, altitude: 2.25 }] },
      { id: 'motion-live', eyebrow: 'RETURN LIVE', title: 'Back to wall time', body: 'The briefing explicitly reconnects Signal Earth to real wall time before returning control.', holdMs: 3_000, instructions: [{ type: 'return-live' }, { type: 'frame-earth' }] },
    ],
  },
  'night-earth': {
    id: 'night-earth', eyebrow: 'NIGHT BRIEFING', title: 'Night Earth', description: 'A quiet visual tour of the night side, auroral model and satellites crossing darkness.', estimatedSeconds: 37,
    dataState: 'static',
    steps: [
      { id: 'night-stage', eyebrow: 'NIGHT EARTH', title: 'The night side', body: 'City-light presentation, real astronomical darkness and a restrained signal layer share the same globe.', holdMs: 5_500, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: 'night' }, { type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 58, lng: -20, altitude: 2.1 }] },
      { id: 'aurora-north', eyebrow: 'AURORA', title: 'Northern auroral context', body: 'NOAA OVATION model output is shown only inside its own validity window.', holdMs: 7_000, instructions: [{ type: 'frame-earth', lat: 70, lng: 15, altitude: 1.55 }] },
      { id: 'night-station', eyebrow: 'ORBIT', title: 'A station over darkness', body: 'A propagated spacecraft crosses the night-facing Earth without changing the underlying geographic frame.', holdMs: 8_000, instructions: [{ type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }] },
      { id: 'night-wide', eyebrow: 'NIGHT SIGNALS', title: 'Earth after dark', body: 'The presentation is cinematic, but observed, propagated and forecast data remain explicitly separate.', holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 42, lng: 35, altitude: 2.45 }] },
    ],
  },
};

export const BRIEFING_ORDER: BriefingId[] = ['earth-now', 'last-24h', 'seismic-now', 'storm-watch', 'space-weather-now', 'above-me', 'orbit-now', 'planet-motion', 'night-earth'];

export function getBriefingList(): BriefingDefinition[] {
  return BRIEFING_ORDER.map((id) => BRIEFINGS[id]);
}

export function applyDynamicBriefings(definitions: Partial<Record<BriefingId, BriefingDefinition>>): void {
  for (const [id, definition] of Object.entries(definitions) as Array<[BriefingId, BriefingDefinition | undefined]>) {
    if (definition) BRIEFINGS[id] = definition;
  }
}

/** Compatibility export for code that only needs the initial registry snapshot. */
export const BRIEFING_LIST = getBriefingList();
