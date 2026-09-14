import { describe, expect, it } from 'vitest';
import type { SimulationClockSnapshot } from '../core/time/temporal';
import { TIMELINE_WINDOW_HOURS, timelineModeLabel, timelineOffsetHours, timelineProgress } from '../features/timeline/timeline';

function clock(overrides: Partial<SimulationClockSnapshot> = {}): SimulationClockSnapshot {
  return {
    mode: 'live',
    realTime: 100_000,
    simulationTime: 100_000,
    speed: 1,
    isPlaying: true,
    ...overrides,
  };
}

describe('timeline helpers', () => {
  it('maps the ±24 hour window to slider offsets and progress', () => {
    expect(TIMELINE_WINDOW_HOURS).toBe(24);
    expect(timelineOffsetHours(clock({ simulationTime: 100_000 - 6 * 3_600_000 }))).toBe(-6);
    expect(timelineProgress(clock({ simulationTime: 100_000 - 24 * 3_600_000 }))).toBe(0);
    expect(timelineProgress(clock())).toBe(50);
    expect(timelineProgress(clock({ simulationTime: 100_000 + 24 * 3_600_000 }))).toBe(100);
  });

  it('labels replay and future states from actual timestamps', () => {
    expect(timelineModeLabel(clock())).toBe('LIVE');
    expect(timelineModeLabel(clock({ mode: 'replay', simulationTime: 99_000 }))).toBe('REPLAY');
    expect(timelineModeLabel(clock({ mode: 'simulation', simulationTime: 101_000 }))).toBe('FUTURE');
  });
});
