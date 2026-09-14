import {
  GLOBAL_SIMULATION_WINDOW_MS,
  type SimulationClockSnapshot,
  type SimulationSpeed,
  type TimeMode,
} from './temporal';

export interface TimeEngineOptions {
  now?: () => number;
  windowMs?: number;
}

export interface SimulationWindowBounds {
  min: number;
  max: number;
}

/**
 * The single authoritative simulation clock for Signal Earth.
 *
 * LIVE is explicitly coupled to wall time. Any pause, non-1× speed, or manual
 * seek detaches the simulation into replay/simulation mode until returnLive()
 * is called. Detached time is constrained to the configured global window so
 * high playback speeds cannot silently run outside V1's supported ±24h range.
 */
export class TimeEngine {
  readonly #now: () => number;
  readonly #windowMs: number;
  #mode: TimeMode = 'live';
  #speed: SimulationSpeed = 1;
  #isPlaying = true;
  #simulationTime: number;
  #lastRealTime: number;

  constructor(options: TimeEngineOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#windowMs = options.windowMs ?? GLOBAL_SIMULATION_WINDOW_MS;
    const initial = this.#now();
    this.#simulationTime = initial;
    this.#lastRealTime = initial;
  }

  get currentTime(): number {
    this.#advance();
    return this.#simulationTime;
  }

  get windowMs(): number {
    return this.#windowMs;
  }

  bounds(realTime = this.#now()): SimulationWindowBounds {
    return {
      min: realTime - this.#windowMs,
      max: realTime + this.#windowMs,
    };
  }

  snapshot(): SimulationClockSnapshot {
    const realTime = this.#now();
    this.#advance(realTime);

    return {
      mode: this.#mode,
      realTime,
      simulationTime: this.#simulationTime,
      speed: this.#speed,
      isPlaying: this.#isPlaying,
    };
  }

  setTime(timestamp: number): void {
    if (!Number.isFinite(timestamp)) throw new TypeError('Simulation timestamp must be finite.');
    const now = this.#now();
    const { min, max } = this.bounds(now);
    this.#simulationTime = Math.max(min, Math.min(max, timestamp));
    this.#mode = this.#simulationTime < now ? 'replay' : 'simulation';
    this.#lastRealTime = now;
  }

  seekOffset(offsetMs: number): void {
    if (!Number.isFinite(offsetMs)) throw new TypeError('Simulation offset must be finite.');
    const clampedOffset = Math.max(-this.#windowMs, Math.min(this.#windowMs, offsetMs));
    this.setTime(this.#now() + clampedOffset);
  }

  setSpeed(speed: SimulationSpeed): void {
    const now = this.#now();
    this.#advance(now);

    // LIVE only means real wall time at 1×. Pausing or accelerating explicitly
    // detaches the simulation until RETURN_LIVE is invoked.
    if (this.#mode === 'live' && speed !== 1) {
      this.#mode = 'simulation';
      this.#simulationTime = now;
    }

    this.#speed = speed;
    this.#isPlaying = speed !== 0;
    this.#lastRealTime = now;
  }

  pause(): void {
    this.setSpeed(0);
  }

  returnLive(): void {
    const now = this.#now();
    this.#mode = 'live';
    this.#speed = 1;
    this.#isPlaying = true;
    this.#simulationTime = now;
    this.#lastRealTime = now;
  }

  #advance(realTime = this.#now()): void {
    if (this.#mode === 'live') {
      this.#simulationTime = realTime;
    } else if (this.#isPlaying) {
      const elapsed = Math.max(0, realTime - this.#lastRealTime);
      this.#simulationTime += elapsed * this.#speed;

      const { min, max } = this.bounds(realTime);
      if (this.#simulationTime <= min) {
        this.#simulationTime = min;
        this.#speed = 0;
        this.#isPlaying = false;
        this.#mode = 'replay';
      } else if (this.#simulationTime >= max) {
        this.#simulationTime = max;
        this.#speed = 0;
        this.#isPlaying = false;
        this.#mode = 'simulation';
      } else {
        this.#mode = this.#simulationTime < realTime ? 'replay' : 'simulation';
      }
    } else {
      // A paused absolute timestamp naturally moves into the past as wall time
      // advances. Keep the semantic mode honest even while the clock is frozen.
      this.#mode = this.#simulationTime < realTime ? 'replay' : 'simulation';
    }
    this.#lastRealTime = realTime;
  }
}
