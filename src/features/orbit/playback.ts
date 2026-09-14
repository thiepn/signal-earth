import type { SimulationClockSnapshot, SimulationSpeed } from '../../core/time/temporal';

export type OrbitTrailMode = 'off' | 'past-10m' | 'past-orbit' | 'next-orbit';

export interface OrbitPlaybackProfile {
  cadenceMs: number;
  horizonMs: number;
  samples: number;
  trackCadenceMs: number;
}

const PROFILE_BY_SPEED: Record<SimulationSpeed, OrbitPlaybackProfile> = {
  0: { cadenceMs: 1_200, horizonMs: 1_000, samples: 2, trackCadenceMs: 5_000 },
  1: { cadenceMs: 900, horizonMs: 3_000, samples: 2, trackCadenceMs: 5_000 },
  10: { cadenceMs: 700, horizonMs: 18_000, samples: 3, trackCadenceMs: 4_000 },
  100: { cadenceMs: 500, horizonMs: 180_000, samples: 5, trackCadenceMs: 2_500 },
  1000: { cadenceMs: 350, horizonMs: 1_500_000, samples: 9, trackCadenceMs: 1_250 },
};

export function orbitPlaybackProfile(clock: SimulationClockSnapshot | null): OrbitPlaybackProfile {
  if (!clock || !clock.isPlaying) return PROFILE_BY_SPEED[0];
  return PROFILE_BY_SPEED[clock.speed];
}

export interface TemporalSamplePlan {
  startTimestamp: number;
  endTimestamp: number;
  sampleCount: number;
}

export function makeTemporalSamplePlan(simulationTime: number, clock: SimulationClockSnapshot | null): TemporalSamplePlan {
  const profile = orbitPlaybackProfile(clock);
  // Start slightly behind the current simulation clock to absorb worker latency.
  // The forward horizon scales with playback speed and is sampled sparsely in the
  // worker, then interpolated in globe space on the render thread.
  const behindMs = Math.min(profile.horizonMs * 0.08, Math.max(250, (clock?.speed ?? 1) * 120));
  return {
    startTimestamp: simulationTime - behindMs,
    endTimestamp: simulationTime + profile.horizonMs,
    sampleCount: profile.samples,
  };
}

export interface TemporalContinuitySample {
  simulationTime: number;
  performanceTime: number;
  speed: SimulationSpeed;
  playing: boolean;
}

export function isTemporalDiscontinuity(previous: TemporalContinuitySample | null, next: TemporalContinuitySample): boolean {
  if (!previous) return true;
  const realElapsed = Math.max(0, next.performanceTime - previous.performanceTime);
  const expectedDelta = previous.playing ? realElapsed * previous.speed : 0;
  const actualDelta = next.simulationTime - previous.simulationTime;
  const tolerance = Math.max(8_000, Math.abs(expectedDelta) * 2.5 + 2_000);
  if (Math.abs(actualDelta - expectedDelta) > tolerance) return true;
  if (Math.sign(actualDelta) !== Math.sign(expectedDelta) && Math.abs(actualDelta) > 5_000) return true;
  return false;
}

export function trailLabel(mode: OrbitTrailMode): string {
  switch (mode) {
    case 'past-10m': return 'PAST 10 MIN';
    case 'past-orbit': return 'PAST ORBIT';
    case 'next-orbit': return 'NEXT ORBIT';
    default: return 'OFF';
  }
}
