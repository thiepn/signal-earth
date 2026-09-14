import { describe, expect, it } from 'vitest';
import { parseCommand } from '../features/search/commands';

describe('deterministic search commands', () => {
  it('parses navigation and follow commands', () => {
    expect(parseCommand('goto Tokyo')?.intent).toEqual({ type: 'navigate', query: 'Tokyo' });
    expect(parseCommand('follow ISS')?.intent).toEqual({ type: 'follow', query: 'ISS' });
  });

  it('parses layer and category commands', () => {
    expect(parseCommand('show earthquakes')?.intent).toEqual({ type: 'layer', operation: 'show', layer: 'earthquakes' });
    expect(parseCommand('show clouds')?.intent).toEqual({ type: 'layer', operation: 'show', layer: 'weather' });
    expect(parseCommand('show weather')?.intent).toEqual({ type: 'satellite-category', operation: 'show', category: 'weather' });
    expect(parseCommand('only GPS')?.intent).toEqual({ type: 'satellite-category', operation: 'only', category: 'navigation' });
  });

  it('parses simulation controls', () => {
    expect(parseCommand('speed 100x')?.intent).toEqual({ type: 'speed', speed: 100 });
    expect(parseCommand('rewind 6h')?.intent).toEqual({ type: 'time-offset', hours: -6 });
    expect(parseCommand('night')?.intent).toEqual({ type: 'visual-mode', mode: 'night' });
    expect(parseCommand('live')?.intent).toEqual({ type: 'live' });
  });
  it('parses release commands', () => {
    expect(parseCommand('share')?.intent).toEqual({ type: 'share' });
    expect(parseCommand('capture')?.intent).toEqual({ type: 'capture' });
    expect(parseCommand('record')?.intent).toEqual({ type: 'record' });
    expect(parseCommand('install app')?.intent).toEqual({ type: 'install' });
  });

  it('parses briefing commands', () => {
    expect(parseCommand('briefing')?.intent).toEqual({ type: 'briefings' });
    expect(parseCommand('earth now')?.intent).toEqual({ type: 'briefings', briefingId: 'earth-now' });
    expect(parseCommand('night earth')?.intent).toEqual({ type: 'briefings', briefingId: 'night-earth' });
  });

});
