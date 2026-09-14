import {
  GLOBAL_FUTURE_WINDOW_MS,
  GLOBAL_PAST_WINDOW_MS,
  type SimulationClockSnapshot,
  type SimulationSpeed,
  type TimeMode,
} from './temporal';

export interface TimeEngineOptions {
  now?: () => number;
  /** Backward-compatible symmetric override used by older tests/callers. */
  windowMs?: number;
  pastWindowMs?: number;
  futureWindowMs?: number;
}

export interface SimulationWindowBounds {
  min: number;
  max: number;
}

/**
 * The single authoritative simulation clock for Signal Earth.
 *
 * Time 2.0 keeps LIVE explicitly coupled to wall time while supporting an
 * asymmetric global window: up to 30 days of replay and 24 hours forward.
 * Manual seeks detach the simulation. A guided replay can optionally stop
 * exactly when it catches wall time instead of drifting into future simulation.
 */
export class TimeEngine {
  readonly #now: () => number;
  readonly #pastWindowMs: number;
  readonly #futureWindowMs: number;
  #mode: TimeMode = 'live';
  #speed: SimulationSpeed = 1;
  #isPlaying = true;
  #simulationTime: number;
  #lastRealTime: number;
  #stopAtLive = false;

  constructor(options: TimeEngineOptions = {}) {
    this.#now = options.now ?? Date.now;
    const symmetric = options.windowMs;
    this.#pastWindowMs = Math.max(1, options.pastWindowMs ?? symmetric ?? GLOBAL_PAST_WINDOW_MS);
    this.#futureWindowMs = Math.max(1, options.futureWindowMs ?? symmetric ?? GLOBAL_FUTURE_WINDOW_MS);
    const initial = this.#now();
    this.#simulationTime = initial;
    this.#lastRealTime = initial;
  }

  get currentTime(): number {
    this.#advance();
    return this.#simulationTime;
  }

  /** Retained for callers that only need the largest supported side. */
  get windowMs(): number {
    return Math.max(this.#pastWindowMs, this.#futureWindowMs);
  }

  get pastWindowMs(): number { return this.#pastWindowMs; }
  get futureWindowMs(): number { return this.#futureWindowMs; }
  get replayToLiveActive(): boolean { return this.#stopAtLive; }

  bounds(realTime = this.#now()): SimulationWindowBounds {
    return {
      min: realTime - this.#pastWindowMs,
      max: realTime + this.#futureWindowMs,
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
    this.#stopAtLive = false;
  }

  seekOffset(offsetMs: number): void {
    if (!Number.isFinite(offsetMs)) throw new TypeError('Simulation offset must be finite.');
    const clampedOffset = Math.max(-this.#pastWindowMs, Math.min(this.#futureWindowMs, offsetMs));
    this.setTime(this.#now() + clampedOffset);
  }

  setSpeed(speed: SimulationSpeed): void {
    const now = this.#now();
    this.#advance(now);

    // Any explicit speed choice hands playback control back to the user.
    this.#stopAtLive = false;

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

  /**
   * Start a guided historical replay that automatically reconnects to LIVE when
   * simulated time catches wall time. This prevents a "last 24 hours" sequence
   * from silently continuing into invented future context.
   */
  startReplayToLive(fromTimestamp: number, speed: Exclude<SimulationSpeed, 0> = 1000): void {
    if (!Number.isFinite(fromTimestamp)) throw new TypeError('Replay timestamp must be finite.');
    const now = this.#now();
    const { min } = this.bounds(now);
    const start = Math.max(min, Math.min(now, fromTimestamp));
    if (start >= now) {
      this.#returnLiveAt(now);
      return;
    }
    this.#simulationTime = start;
    this.#mode = 'replay';
    this.#speed = speed;
    this.#isPlaying = true;
    this.#lastRealTime = now;
    this.#stopAtLive = true;
  }

  pause(): void {
    this.setSpeed(0);
  }

  returnLive(): void {
    this.#returnLiveAt(this.#now());
  }

  #returnLiveAt(realTime: number): void {
    this.#mode = 'live';
    this.#speed = 1;
    this.#isPlaying = true;
    this.#simulationTime = realTime;
    this.#lastRealTime = realTime;
    this.#stopAtLive = false;
  }

  #advance(realTime = this.#now()): void {
    if (this.#mode === 'live') {
      this.#simulationTime = realTime;
    } else if (this.#isPlaying) {
      const elapsed = Math.max(0, realTime - this.#lastRealTime);
      this.#simulationTime += elapsed * this.#speed;

      if (this.#stopAtLive && this.#simulationTime >= realTime) {
        this.#returnLiveAt(realTime);
        return;
      }

      const { min, max } = this.bounds(realTime);
      if (this.#simulationTime <= min) {
        this.#simulationTime = min;
        this.#speed = 0;
        this.#isPlaying = false;
        this.#mode = 'replay';
        this.#stopAtLive = false;
      } else if (this.#simulationTime >= max) {
        this.#simulationTime = max;
        this.#speed = 0;
        this.#isPlaying = false;
        this.#mode = 'simulation';
        this.#stopAtLive = false;
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
