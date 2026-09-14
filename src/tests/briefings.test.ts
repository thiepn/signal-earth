import { describe, expect, it } from 'vitest';
import { BRIEFINGS } from '../features/briefings/briefings';
import { TourEngine } from '../features/briefings/TourEngine';
import type { BriefingDefinition } from '../features/briefings/types';

describe('Phase 13 briefings', () => {
  it('ships the four V1 briefing identities with stable steps', () => {
    expect(Object.keys(BRIEFINGS).sort()).toEqual(['earth-now', 'night-earth', 'orbit-now', 'planet-motion']);
    for (const briefing of Object.values(BRIEFINGS)) {
      expect(briefing.steps.length).toBeGreaterThanOrEqual(4);
      expect(briefing.steps.every((step) => step.holdMs >= 0 && step.instructions.length > 0)).toBe(true);
    }
  });

  it('Planet in Motion explicitly returns to live time after accelerated playback', () => {
    const instructions = BRIEFINGS['planet-motion'].steps.flatMap((step) => step.instructions);
    expect(instructions.some((instruction) => instruction.type === 'set-speed' && instruction.speed === 1000)).toBe(true);
    expect(instructions.at(-1)?.type === 'frame-earth' || instructions.some((instruction) => instruction.type === 'return-live')).toBe(true);
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
