export type QualityLevel = 'low' | 'medium' | 'high';
export type QualityMode = 'auto' | 'manual';

export interface QualityProfile {
  pixelRatio: number;
  earthTexture: '2k' | '4k';
  atmosphere: 'basic' | 'normal' | 'full';
  satelliteCap: number;
  effects: 'reduced' | 'normal' | 'enhanced';
  starCount: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    pixelRatio: 1,
    earthTexture: '2k',
    atmosphere: 'basic',
    satelliteCap: 350,
    effects: 'reduced',
    starCount: 700,
  },
  medium: {
    pixelRatio: 1.5,
    earthTexture: '2k',
    atmosphere: 'normal',
    satelliteCap: 600,
    effects: 'normal',
    starCount: 1200,
  },
  high: {
    pixelRatio: 2,
    earthTexture: '4k',
    atmosphere: 'full',
    satelliteCap: 800,
    effects: 'enhanced',
    starCount: 1900,
  },
};

type QualityListener = (level: QualityLevel, profile: QualityProfile) => void;

function initialAutoLevel(): QualityLevel {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'medium';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 4;
  const pixels = window.innerWidth * window.innerHeight * Math.max(1, window.devicePixelRatio);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (memory <= 2 || cores <= 2 || pixels > 7_000_000) return 'low';
  if (!coarsePointer && memory >= 8 && cores >= 8 && pixels < 5_000_000) return 'high';
  return 'medium';
}

export class QualityManager {
  #level: QualityLevel;
  #mode: QualityMode = 'auto';
  #listeners = new Set<QualityListener>();
  #lowFpsStrikes = 0;
  #highFpsStrikes = 0;
  #lastAdjustmentAt = -Infinity;
  #now: () => number;

  constructor(level: QualityLevel = initialAutoLevel(), now: () => number = () => performance.now()) {
    this.#level = level;
    this.#now = now;
  }

  get level(): QualityLevel { return this.#level; }
  get profile(): QualityProfile { return QUALITY_PROFILES[this.#level]; }
  get mode(): QualityMode { return this.#mode; }

  set(level: QualityLevel, mode: QualityMode = 'manual'): void {
    this.#mode = mode;
    this.#resetStrikes();
    this.#apply(level);
  }

  setAuto(): void {
    this.#mode = 'auto';
    this.#resetStrikes();
    this.#apply(initialAutoLevel());
  }

  degrade(): QualityLevel {
    if (this.#level === 'high') this.#apply('medium');
    else if (this.#level === 'medium') this.#apply('low');
    this.#lastAdjustmentAt = this.#now();
    return this.#level;
  }

  upgrade(): QualityLevel {
    if (this.#level === 'low') this.#apply('medium');
    else if (this.#level === 'medium') this.#apply('high');
    this.#lastAdjustmentAt = this.#now();
    return this.#level;
  }

  /**
   * Adaptive quality with hysteresis:
   * - downgrade after three sustained low-FPS reports;
   * - upgrade only after 25 sustained high-FPS reports;
   * - wait 30 seconds after any automatic change before changing again.
   *
   * This keeps Auto useful on changing devices while preventing profile flapping.
   */
  observeFps(fps: number): QualityLevel {
    if (this.#mode !== 'auto' || !Number.isFinite(fps) || fps <= 0) return this.#level;

    const now = this.#now();
    const cooldownActive = now - this.#lastAdjustmentAt < 30_000;
    const lowThreshold = this.#level === 'high' ? 46 : 27;
    const highThreshold = this.#level === 'low' ? 56 : 59;

    if (fps < lowThreshold && this.#level !== 'low') {
      this.#lowFpsStrikes += 1;
      this.#highFpsStrikes = 0;
      if (!cooldownActive && this.#lowFpsStrikes >= 3) {
        this.#resetStrikes();
        return this.degrade();
      }
      return this.#level;
    }

    this.#lowFpsStrikes = 0;
    if (fps >= highThreshold && this.#level !== 'high') {
      this.#highFpsStrikes += 1;
      if (!cooldownActive && this.#highFpsStrikes >= 25) {
        this.#resetStrikes();
        return this.upgrade();
      }
    } else {
      this.#highFpsStrikes = 0;
    }

    return this.#level;
  }

  subscribe(listener: QualityListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #resetStrikes(): void {
    this.#lowFpsStrikes = 0;
    this.#highFpsStrikes = 0;
  }

  #apply(level: QualityLevel): void {
    if (level === this.#level) return;
    this.#level = level;
    const profile = QUALITY_PROFILES[level];
    for (const listener of this.#listeners) listener(level, profile);
  }
}
