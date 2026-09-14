import { GLOBAL_SIMULATION_WINDOW_MS, type SimulationClockSnapshot } from '../../core/time/temporal';

export const TIMELINE_WINDOW_HOURS = GLOBAL_SIMULATION_WINDOW_MS / 3_600_000;

export const TIMELINE_PRESETS = [-24, -6, -1, 0, 6, 24] as const;

export function timelineOffsetMs(clock: SimulationClockSnapshot | null): number {
  if (!clock) return 0;
  return Math.max(
    -GLOBAL_SIMULATION_WINDOW_MS,
    Math.min(GLOBAL_SIMULATION_WINDOW_MS, clock.simulationTime - clock.realTime),
  );
}

export function timelineOffsetHours(clock: SimulationClockSnapshot | null): number {
  return timelineOffsetMs(clock) / 3_600_000;
}

export function timelineModeLabel(clock: SimulationClockSnapshot | null): 'LIVE' | 'REPLAY' | 'FUTURE' | 'READY' {
  if (!clock) return 'READY';
  if (clock.mode === 'live') return 'LIVE';
  return clock.simulationTime < clock.realTime ? 'REPLAY' : 'FUTURE';
}

export function timelineProgress(clock: SimulationClockSnapshot | null): number {
  const hours = timelineOffsetHours(clock);
  return ((hours + TIMELINE_WINDOW_HOURS) / (TIMELINE_WINDOW_HOURS * 2)) * 100;
}
