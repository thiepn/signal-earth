import { describe, expect, it } from 'vitest';
import type { SimulationClockSnapshot } from '../core/time/temporal';
import {
  TIMELINE_RANGES,
  earthquakeWindowForTimelineRange,
  orbitTemporallyAvailable,
  rangeForOffsetHours,
  timelineLivePosition,
  timelineModeLabel,
  timelineOffsetHours,
  timelineProgress,
  widenEarthquakeWindow,
} from '../features/timeline/timeline';

function clock(overrides: Partial<SimulationClockSnapshot> = {}): SimulationClockSnapshot {
  return {
    mode: 'live',
    realTime: 4_000_000_000,
    simulationTime: 4_000_000_000,
    speed: 1,
    isPlaying: true,
    ...overrides,
  };
}

describe('timeline helpers', () => {
  it('maps each asymmetric Time 2.0 range correctly', () => {
    const base = clock();
    const hour = 3_600_000;

    expect(TIMELINE_RANGES.day.pastHours).toBe(24);
    expect(TIMELINE_RANGES.week.pastHours).toBe(168);
    expect(TIMELINE_RANGES.month.pastHours).toBe(720);
    expect(timelineProgress(clock({ simulationTime: base.realTime - 24 * hour }), 'day')).toBe(0);
    expect(timelineProgress(base, 'day')).toBe(50);
    expect(timelineLivePosition('week')).toBe(87.5);
    expect(timelineLivePosition('month')).toBeCloseTo(96.774, 3);
    expect(timelineProgress(clock({ simulationTime: base.realTime + 24 * hour }), 'month')).toBe(100);
  });

  it('preserves raw offsets while choosing the smallest useful visible range', () => {
    const hour = 3_600_000;
    expect(timelineOffsetHours(clock({ simulationTime: 4_000_000_000 - 6 * hour }))).toBe(-6);
    expect(rangeForOffsetHours(-6)).toBe('day');
    expect(rangeForOffsetHours(-72)).toBe('week');
    expect(rangeForOffsetHours(-240)).toBe('month');
  });

  it('maps historical ranges to sufficient USGS feed coverage without narrowing an existing wider choice', () => {
    expect(earthquakeWindowForTimelineRange('day')).toBe('day');
    expect(earthquakeWindowForTimelineRange('week')).toBe('week');
    expect(earthquakeWindowForTimelineRange('month')).toBe('month');
    expect(widenEarthquakeWindow('hour', 'week')).toBe('week');
    expect(widenEarthquakeWindow('month', 'day')).toBe('month');
  });

  it('marks current OMM propagation unavailable outside the certified ±24 hour orbit window', () => {
    const hour = 3_600_000;
    expect(orbitTemporallyAvailable(clock({ simulationTime: 4_000_000_000 - 23 * hour }))).toBe(true);
    expect(orbitTemporallyAvailable(clock({ simulationTime: 4_000_000_000 - 25 * hour }))).toBe(false);
    expect(orbitTemporallyAvailable(clock({ simulationTime: 4_000_000_000 + 25 * hour }))).toBe(false);
  });

  it('labels replay and future states from actual timestamps', () => {
    expect(timelineModeLabel(clock())).toBe('LIVE');
    expect(timelineModeLabel(clock({ mode: 'replay', simulationTime: 3_999_999_000 }))).toBe('REPLAY');
    expect(timelineModeLabel(clock({ mode: 'simulation', simulationTime: 4_000_001_000 }))).toBe('FUTURE');
  });
});
