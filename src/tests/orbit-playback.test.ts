import { describe, expect, it } from 'vitest';
import { isTemporalDiscontinuity, makeTemporalSamplePlan, orbitPlaybackProfile, trailLabel } from '../features/orbit/playback';
import type { SimulationClockSnapshot } from '../core/time/temporal';

function clock(speed: 0 | 1 | 10 | 100 | 1000, playing = speed !== 0): SimulationClockSnapshot {
  return { mode: speed === 1 ? 'live' : 'simulation', realTime: 1_000_000, simulationTime: 1_000_000, speed, isPlaying: playing };
}

describe('orbit predictive playback', () => {
  it('increases prediction horizon and sample density for high playback speeds', () => {
    const normal = orbitPlaybackProfile(clock(1));
    const fast = orbitPlaybackProfile(clock(1000));
    expect(fast.horizonMs).toBeGreaterThan(normal.horizonMs);
    expect(fast.samples).toBeGreaterThan(normal.samples);
    expect(fast.cadenceMs).toBeLessThan(normal.cadenceMs);
  });

  it('builds a prediction window that brackets current simulation time', () => {
    const plan = makeTemporalSamplePlan(5_000_000, clock(100));
    expect(plan.startTimestamp).toBeLessThan(5_000_000);
    expect(plan.endTimestamp).toBeGreaterThan(5_000_000);
    expect(plan.sampleCount).toBeGreaterThanOrEqual(2);
  });

  it('detects large seek jumps but accepts continuous accelerated time', () => {
    const previous = { simulationTime: 10_000, performanceTime: 1_000, speed: 100 as const, playing: true };
    expect(isTemporalDiscontinuity(previous, { simulationTime: 20_000, performanceTime: 1_100, speed: 100, playing: true })).toBe(false);
    expect(isTemporalDiscontinuity(previous, { simulationTime: 3_600_000, performanceTime: 1_100, speed: 100, playing: true })).toBe(true);
  });

  it('keeps trail labels explicit', () => {
    expect(trailLabel('past-10m')).toBe('PAST 10 MIN');
    expect(trailLabel('next-orbit')).toBe('NEXT ORBIT');
  });
});
