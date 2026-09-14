import type { BriefingDefinition, BriefingId } from './types';

export const BRIEFINGS: Record<BriefingId, BriefingDefinition> = {
  'earth-now': {
    id: 'earth-now',
    eyebrow: 'PLANETARY BRIEFING',
    title: 'Earth Now',
    description: 'A fast tour of the strongest current Earth signals, natural events and near-Earth context.',
    estimatedSeconds: 46,
    steps: [
      {
        id: 'earth-overview', eyebrow: 'EARTH NOW', title: 'Planetary overview',
        body: 'Current public signals are staged together on one Earth-fixed globe.', holdMs: 3_800,
        instructions: [
          { type: 'return-live' }, { type: 'set-speed', speed: 1 }, { type: 'set-visual-mode', mode: 'earth' },
          { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' },
          { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'set-layer', layer: 'events', enabled: true },
          { type: 'set-natural-event-categories', categories: ['severe-storm', 'wildfire', 'volcano'] },
          { type: 'set-layer', layer: 'aurora', enabled: false }, { type: 'clear-selection' },
          { type: 'frame-earth', lat: 18, lng: 8, altitude: 2.25, durationMs: 1_300 },
        ],
      },
      {
        id: 'strongest-quake', eyebrow: 'SEISMIC ACTIVITY', title: 'Strongest recent earthquake',
        body: 'The briefing selects the strongest earthquake currently valid at the simulation timestamp.', holdMs: 6_200,
        instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }],
      },
      {
        id: 'natural-event', eyebrow: 'NATURAL EVENTS', title: 'Active Earth event',
        body: 'Storms, wildfires and volcanoes use NASA EONET observations rather than synthetic motion.', holdMs: 6_200,
        instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }],
      },
      {
        id: 'space-weather', eyebrow: 'SPACE WEATHER', title: 'Earth meets space',
        body: 'NOAA geomagnetic and auroral model context is layered over the night-facing planet.', holdMs: 5_600,
        instructions: [
          { type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'set-visual-mode', mode: 'night' },
          { type: 'clear-selection' }, { type: 'frame-earth', lat: 63, lng: 5, altitude: 2.0, durationMs: 1_300 },
        ],
      },
      {
        id: 'iss-handoff', eyebrow: 'LOW EARTH ORBIT', title: 'International Space Station',
        body: 'The final handoff moves from Earth systems into a propagated object in low Earth orbit.', holdMs: 7_000,
        instructions: [
          { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'select-satellite', target: 'iss' },
          { type: 'follow-selected-satellite' },
        ],
      },
      {
        id: 'earth-return', eyebrow: 'GLOBAL OVERVIEW', title: 'Earth right now',
        body: 'One planet, observed events, propagated orbits and modelled space weather—kept temporally distinct.', holdMs: 4_000,
        instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', durationMs: 1_200 }],
      },
    ],
  },

  'orbit-now': {
    id: 'orbit-now', eyebrow: 'ORBITAL BRIEFING', title: 'Orbit Now',
    description: 'Stations, weather, navigation and Earth-observation satellites viewed as orbital systems.',
    estimatedSeconds: 43,
    steps: [
      {
        id: 'orbit-stage', eyebrow: 'ORBIT NOW', title: 'Near-Earth space',
        body: 'Curated CelesTrak OMM groups are propagated locally with SGP4.', holdMs: 4_000,
        instructions: [
          { type: 'return-live' }, { type: 'set-speed', speed: 1 }, { type: 'set-visual-mode', mode: 'signal' },
          { type: 'set-layer', layer: 'orbit', enabled: true },
          { type: 'set-orbit-categories', categories: ['stations', 'weather', 'earth-observation', 'navigation', 'science'] },
          { type: 'frame-earth', lat: 15, lng: 0, altitude: 2.55, durationMs: 1_200 },
        ],
      },
      {
        id: 'iss', eyebrow: 'STATIONS', title: 'International Space Station',
        body: 'Follow a propagated station position while the Earth remains geographically fixed beneath it.', holdMs: 7_000,
        instructions: [{ type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }],
      },
      {
        id: 'weather-orbit', eyebrow: 'WEATHER', title: 'Weather satellites',
        body: 'A selected meteorological spacecraft reveals its orbital plane and current ground track.', holdMs: 7_000,
        instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'weather' }, { type: 'frame-selected-orbit' }],
      },
      {
        id: 'navigation', eyebrow: 'NAVIGATION', title: 'Navigation constellation',
        body: 'Medium-Earth-orbit navigation assets sit much farther out than the low Earth orbit population.', holdMs: 7_000,
        instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'navigation' }, { type: 'frame-selected-orbit' }],
      },
      {
        id: 'earth-observation', eyebrow: 'EARTH OBSERVATION', title: 'Watching the planet',
        body: 'Earth-observation missions connect orbital mechanics back to the living planet below.', holdMs: 7_000,
        instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'earth-observation' }, { type: 'frame-selected-orbit' }],
      },
      {
        id: 'orbit-return', eyebrow: 'ORBITAL CONTEXT', title: 'A layered orbital system',
        body: 'Every point is propagated from orbital elements; visual exaggeration remains separate from true telemetry.', holdMs: 3_500,
        instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.65, durationMs: 1_200 }],
      },
    ],
  },

  'planet-motion': {
    id: 'planet-motion', eyebrow: 'TIME BRIEFING', title: 'Planet in Motion',
    description: 'Accelerate the shared simulation clock and watch daylight and orbital motion evolve together.',
    estimatedSeconds: 34,
    steps: [
      {
        id: 'motion-start', eyebrow: 'PLANET IN MOTION', title: 'One shared clock',
        body: 'Sunlight, Earth systems and satellite propagation all read the same simulation timestamp.', holdMs: 4_000,
        instructions: [
          { type: 'return-live' }, { type: 'set-visual-mode', mode: 'signal' }, { type: 'set-layer', layer: 'orbit', enabled: true },
          { type: 'clear-selection' }, { type: 'frame-earth', lat: 20, lng: -25, altitude: 2.5, durationMs: 1_000 },
        ],
      },
      {
        id: 'speed-100', eyebrow: 'TIME ×100', title: 'Accelerated orbit',
        body: 'Predictive ephemeris windows keep satellite motion continuous without running SGP4 at rendering frequency.', holdMs: 7_000,
        instructions: [{ type: 'set-speed', speed: 100 }],
      },
      {
        id: 'speed-1000', eyebrow: 'TIME ×1000', title: 'Hours become seconds',
        body: 'The terminator advances across Earth while satellite constellations sweep through their orbits.', holdMs: 10_000,
        instructions: [{ type: 'set-speed', speed: 1000 }],
      },
      {
        id: 'night-motion', eyebrow: 'DAY / NIGHT', title: 'The moving terminator',
        body: 'Night presentation makes the shared astronomical time model especially visible.', holdMs: 7_000,
        instructions: [{ type: 'set-visual-mode', mode: 'night' }, { type: 'frame-earth', lat: 25, lng: 80, altitude: 2.25, durationMs: 1_200 }],
      },
      {
        id: 'motion-live', eyebrow: 'RETURN LIVE', title: 'Back to wall time',
        body: 'The briefing explicitly reconnects Signal Earth to real wall time before returning control.', holdMs: 3_000,
        instructions: [{ type: 'return-live' }, { type: 'frame-earth', durationMs: 1_000 }],
      },
    ],
  },

  'night-earth': {
    id: 'night-earth', eyebrow: 'NIGHT BRIEFING', title: 'Night Earth',
    description: 'A quiet visual tour of the night side, auroral model and satellites crossing darkness.',
    estimatedSeconds: 37,
    steps: [
      {
        id: 'night-stage', eyebrow: 'NIGHT EARTH', title: 'The night side',
        body: 'City-light presentation, real astronomical darkness and a restrained signal layer share the same globe.', holdMs: 5_500,
        instructions: [
          { type: 'return-live' }, { type: 'set-visual-mode', mode: 'night' }, { type: 'set-layer', layer: 'aurora', enabled: true },
          { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'clear-selection' },
          { type: 'frame-earth', lat: 58, lng: -20, altitude: 2.1, durationMs: 1_400 },
        ],
      },
      {
        id: 'aurora-north', eyebrow: 'AURORA', title: 'Northern auroral context',
        body: 'NOAA OVATION model output is shown only inside its own validity window.', holdMs: 7_000,
        instructions: [{ type: 'frame-earth', lat: 70, lng: 15, altitude: 1.55, durationMs: 1_300 }],
      },
      {
        id: 'night-station', eyebrow: 'ORBIT', title: 'A station over darkness',
        body: 'A propagated spacecraft crosses the night-facing Earth without changing the underlying geographic frame.', holdMs: 8_000,
        instructions: [{ type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }],
      },
      {
        id: 'night-wide', eyebrow: 'NIGHT SIGNALS', title: 'Earth after dark',
        body: 'The presentation is cinematic, but observed, propagated and forecast data remain explicitly separate.', holdMs: 7_000,
        instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 42, lng: 35, altitude: 2.45, durationMs: 1_400 }],
      },
    ],
  },
};

export const BRIEFING_LIST = Object.values(BRIEFINGS);
