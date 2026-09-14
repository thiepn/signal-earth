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

export const GLOBAL_SIMULATION_WINDOW_MS = 24 * 60 * 60 * 1000;
