import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { SatelliteCategory } from '../../shared/types/orbit';
import { normalizeSearchText } from './ranking';
import type { ParsedCommand } from './types';

const LAYERS: Record<string, LayerId> = {
  atmosphere: 'weather', cloud: 'weather', clouds: 'weather', precipitation: 'weather', rain: 'weather', 'weather layer': 'weather',
  earthquake: 'earthquakes', earthquakes: 'earthquakes', quake: 'earthquakes', quakes: 'earthquakes', seismic: 'earthquakes',
  event: 'events', events: 'events', natural: 'events', 'natural events': 'events', wildfire: 'events', wildfires: 'events', volcano: 'events', volcanoes: 'events', storm: 'events', storms: 'events',
  orbit: 'orbit', satellites: 'orbit', satellite: 'orbit', sats: 'orbit',
  aurora: 'aurora', auroras: 'aurora', 'space weather': 'aurora', spaceweather: 'aurora',
};

const CATEGORIES: Record<string, SatelliteCategory> = {
  stations: 'stations', station: 'stations', iss: 'stations',
  weather: 'weather', 'weather satellites': 'weather', meteorological: 'weather',
  'earth observation': 'earth-observation', 'earth observation satellites': 'earth-observation', 'earth-observation': 'earth-observation', observation: 'earth-observation', sentinel: 'earth-observation', landsat: 'earth-observation',
  navigation: 'navigation', 'navigation satellites': 'navigation', gps: 'navigation', 'gps satellites': 'navigation', gnss: 'navigation', galileo: 'navigation', glonass: 'navigation',
  science: 'science', scientific: 'science',
};

const MODES: Record<string, VisualMode> = {
  earth: 'earth', normal: 'earth', signal: 'signal', tactical: 'signal', night: 'night', nighttime: 'night', wireframe: 'wireframe', wire: 'wireframe',
};

function parseOffset(raw: string): number | null {
  const match = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase();
  return unit?.startsWith('m') ? value / 60 : value;
}

export function parseCommand(input: string): ParsedCommand | null {
  const raw = input.trim().replace(/^>/, '').trim();
  const normalized = normalizeSearchText(raw);
  if (!normalized) return null;

  if (['help', '?', 'commands'].includes(normalized)) return { intent: { type: 'help' }, canonical: 'help', description: 'Show command help' };
  if (['reset', 'reset globe', 'home'].includes(normalized)) return { intent: { type: 'reset' }, canonical: 'reset', description: 'Return to the global Earth view' };
  if (['live', 'now', 'return live', 'go live'].includes(normalized)) return { intent: { type: 'live' }, canonical: 'live', description: 'Return the simulation to live time' };
  if (['pause', 'stop time', 'freeze'].includes(normalized)) return { intent: { type: 'pause' }, canonical: 'pause', description: 'Pause simulation time' };
  if (['play', 'resume', 'resume time'].includes(normalized)) return { intent: { type: 'play' }, canonical: 'play', description: 'Resume simulation at 1×' };
  if (['here', 'above me', 'my sky'].includes(normalized)) return { intent: { type: 'here' }, canonical: 'here', description: 'Open the local observatory' };
  if (['share', 'share view', 'copy link', 'copy view link'].includes(normalized)) return { intent: { type: 'share' }, canonical: 'share', description: 'Copy a link to the current public view' };
  if (['capture', 'screenshot', 'snapshot', 'capture png'].includes(normalized)) return { intent: { type: 'capture' }, canonical: 'capture', description: 'Save a PNG of the current globe' };
  if (['record', 'record 10s', 'record clip'].includes(normalized)) return { intent: { type: 'record' }, canonical: 'record', description: 'Record a 10-second globe clip' };
  if (['install', 'install app', 'install signal earth'].includes(normalized)) return { intent: { type: 'install' }, canonical: 'install', description: 'Install Signal Earth as an app when supported' };

  if (['briefing', 'briefings', 'tour', 'tours'].includes(normalized)) return { intent: { type: 'briefings' }, canonical: 'briefing', description: 'Open planetary briefings' };
  const briefingAliases: Record<string, 'earth-now' | 'orbit-now' | 'planet-motion' | 'night-earth'> = {
    'earth now': 'earth-now', 'briefing earth': 'earth-now', 'earth briefing': 'earth-now',
    'orbit now': 'orbit-now', 'briefing orbit': 'orbit-now', 'orbit briefing': 'orbit-now',
    'planet in motion': 'planet-motion', 'briefing motion': 'planet-motion', 'motion briefing': 'planet-motion',
    'night earth': 'night-earth', 'briefing night': 'night-earth', 'night briefing': 'night-earth',
  };
  if (briefingAliases[normalized]) {
    const briefingId = briefingAliases[normalized]!;
    return { intent: { type: 'briefings', briefingId }, canonical: normalized, description: `Start ${normalized.replace('briefing ', '').replace(' briefing', '')}` };
  }

  const speed = normalized.match(/^speed\s+(1|10|100|1000)\s*x?$/);
  if (speed) return { intent: { type: 'speed', speed: Number(speed[1]) as 1 | 10 | 100 | 1000 }, canonical: `speed ${speed[1]}x`, description: `Set simulation speed to ${speed[1]}×` };

  const offset = normalized.match(/^(?:time\s+)?(back|rewind|past|forward|ahead|future)\s+(.+)$/);
  if (offset) {
    const hours = parseOffset(offset[2]!);
    if (hours !== null) {
      const backwards = ['back', 'rewind', 'past'].includes(offset[1]!);
      const signed = Math.max(-24, Math.min(24, Math.abs(hours) * (backwards ? -1 : 1)));
      return { intent: { type: 'time-offset', hours: signed }, canonical: `${backwards ? 'rewind' : 'forward'} ${Math.abs(hours)}h`, description: `Seek ${Math.abs(hours)} hour${Math.abs(hours) === 1 ? '' : 's'} ${backwards ? 'back' : 'forward'}` };
    }
  }

  const modeMatch = normalized.match(/^(?:mode\s+)?(earth|normal|signal|tactical|night|nighttime|wireframe|wire)$/);
  if (modeMatch) {
    const mode = MODES[modeMatch[1]!]!;
    return { intent: { type: 'visual-mode', mode }, canonical: `mode ${mode}`, description: `Switch to ${mode.toUpperCase()} visual mode` };
  }

  const layerMatch = normalized.match(/^(show|hide|only)\s+(.+)$/);
  if (layerMatch) {
    const operation = layerMatch[1] as 'show' | 'hide' | 'only';
    const target = layerMatch[2]!;
    const category = CATEGORIES[target];
    if (category) return { intent: { type: 'satellite-category', operation, category }, canonical: `${operation} ${category}`, description: `${operation === 'hide' ? 'Hide' : operation === 'only' ? 'Show only' : 'Show'} ${category.replace('-', ' ')} satellites` };
    const layer = LAYERS[target];
    if (layer) return { intent: { type: 'layer', operation, layer }, canonical: `${operation} ${layer}`, description: `${operation === 'hide' ? 'Hide' : operation === 'only' ? 'Show only' : 'Show'} ${layer}` };
  }

  const follow = raw.match(/^follow\s+(.+)$/i);
  if (follow?.[1]?.trim()) return { intent: { type: 'follow', query: follow[1].trim() }, canonical: `follow ${follow[1].trim()}`, description: `Find and follow ${follow[1].trim()}` };

  const nav = raw.match(/^(?:go to|goto|fly to|focus|go)\s+(.+)$/i);
  if (nav?.[1]?.trim()) return { intent: { type: 'navigate', query: nav[1].trim() }, canonical: `goto ${nav[1].trim()}`, description: `Navigate to ${nav[1].trim()}` };

  const search = raw.match(/^search\s+(.+)$/i);
  if (search?.[1]?.trim()) return { intent: { type: 'search', query: search[1].trim() }, canonical: `search ${search[1].trim()}`, description: `Search for ${search[1].trim()}` };

  return null;
}

export const COMMAND_EXAMPLES = [
  'goto tokyo', 'follow iss', 'show earthquakes', 'show clouds', 'hide aurora',
  'mode night', 'speed 100x', 'rewind 6h', 'live', 'pause', 'reset', 'here', 'share', 'capture', 'record', 'briefing', 'earth now',
];
