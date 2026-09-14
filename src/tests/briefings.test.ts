import { describe, expect, it } from 'vitest';
import { BRIEFINGS, BRIEFING_ORDER } from '../features/briefings/briefings';
import { TourEngine } from '../features/briefings/TourEngine';
import type { BriefingDefinition } from '../features/briefings/types';

describe('briefing registry and tour engine', () => {
  it('ships Phase 23 dynamic briefing identities alongside the curated tours', () => {
    expect(Object.keys(BRIEFINGS).sort()).toEqual([
      'above-me',
      'earth-now',
      'last-24h',
      'night-earth',
      'orbit-now',
      'planet-motion',
      'seismic-now',
      'space-weather-now',
      'storm-watch',
    ]);
    expect(BRIEFING_ORDER).toHaveLength(9);
    expect(new Set(BRIEFING_ORDER).size).toBe(BRIEFING_ORDER.length);

    const dynamicIds = ['earth-now', 'seismic-now', 'storm-watch', 'space-weather-now', 'above-me', 'orbit-now', 'last-24h'] as const;
    for (const id of dynamicIds) {
      expect(BRIEFINGS[id].dataDriven).toBe(true);
      expect(BRIEFINGS[id].dataState).toBeTruthy();
    }
    expect(BRIEFINGS['planet-motion'].dataDriven).not.toBe(true);
    expect(BRIEFINGS['night-earth'].dataDriven).not.toBe(true);

    for (const briefing of Object.values(BRIEFINGS).filter((item) => item.available !== false)) {
      expect(briefing.steps.length).toBeGreaterThan(0);
      expect(briefing.steps.every((step) => step.holdMs >= 0 && step.instructions.length > 0)).toBe(true);
    }
  });

  it('Planet in Motion explicitly returns to live time after accelerated playback', () => {
    const instructions = BRIEFINGS['planet-motion'].steps.flatMap((step) => step.instructions);
    expect(instructions.some((instruction) => instruction.type === 'set-speed' && instruction.speed === 1000)).toBe(true);
    expect(instructions.some((instruction) => instruction.type === 'return-live')).toBe(true);
  });

  it('executes steps sequentially', async () => {
    const definition: BriefingDefinition = {
      id: 'earth-now', eyebrow: 'TEST', title: 'Test', description: 'Test', estimatedSeconds: 0,
      steps: [
        { id: 'a', eyebrow: 'A', title: 'A', body: 'A', holdMs: 0, instructions: [{ type: 'return-live' }] },
        { id: 'b', eyebrow: 'B', title: 'B', body: 'B', holdMs: 0, instructions: [{ type: 'frame-earth' }] },
      ],
    };
    const engine = new TourEngine();
    const seen: string[] = [];
    const outcome = await engine.start(definition, (step) => { seen.push(step.id); });
    expect(outcome).toBe('completed');
    expect(seen).toEqual(['a', 'b']);
    expect(engine.state.progress).toBe(1);
  });

  it('cancels an active hold without running later steps', async () => {
    const definition: BriefingDefinition = {
      id: 'earth-now', eyebrow: 'TEST', title: 'Test', description: 'Test', estimatedSeconds: 1,
      steps: [
        { id: 'a', eyebrow: 'A', title: 'A', body: 'A', holdMs: 5_000, instructions: [{ type: 'return-live' }] },
        { id: 'b', eyebrow: 'B', title: 'B', body: 'B', holdMs: 0, instructions: [{ type: 'frame-earth' }] },
      ],
    };
    const engine = new TourEngine();
    const seen: string[] = [];
    const run = engine.start(definition, (step) => { seen.push(step.id); });
    await Promise.resolve();
    engine.cancel();
    expect(await run).toBe('cancelled');
    expect(seen).toEqual(['a']);
  });
});
