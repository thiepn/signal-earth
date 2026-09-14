export type TimeMode = 'live' | 'replay' | 'simulation';
export type SimulationSpeed = 0 | 1 | 10 | 100 | 1000;
export type TemporalType = 'observed' | 'propagated' | 'forecast' | 'historical' | 'static';

export interface SimulationClockSnapshot {
  mode: TimeMode;
  realTime: number;
  simulationTime: number;
  speed: SimulationSpeed;
  isPlaying: boolean;
}

export const GLOBAL_PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const GLOBAL_FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Backward-compatible alias for code that still needs a single window value.
 * Time 2.0 is asymmetric: up to 30 days of replay, but only 24 hours forward.
 */
export const GLOBAL_SIMULATION_WINDOW_MS = GLOBAL_PAST_WINDOW_MS;
