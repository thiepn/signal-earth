import type { PerformanceSample } from './FramePerformanceMonitor';

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
    pixelRatio: 0.5,
    earthTexture: '2k',
    atmosphere: 'basic',
    satelliteCap: 180,
    effects: 'reduced',
    starCount: 240,
  },
  medium: {
    pixelRatio: 1.0,
    earthTexture: '2k',
    atmosphere: 'normal',
    satelliteCap: 360,
    effects: 'normal',
    starCount: 800,
  },
  high: {
    pixelRatio: 1.4,
    earthTexture: '4k',
    atmosphere: 'full',
    satelliteCap: 560,
    effects: 'enhanced',
    starCount: 1200,
  },
};

type QualityListener = (level: QualityLevel, profile: QualityProfile) => void;
type FrameHealth = Pick<PerformanceSample, 'fps' | 'p95FrameMs' | 'longFrameRate'>;

function initialAutoLevel(): QualityLevel {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'medium';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 4;
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const framebufferPixels = window.innerWidth * window.innerHeight * dpr * dpr;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  // Never guess High from CPU/RAM alone. Auto can promote only after sustained
  // measured frame health. This avoids over-driving integrated GPUs, high-DPI
  // displays, and browsers that do not expose deviceMemory.
  if (memory <= 2 || cores <= 4 || coarsePointer || framebufferPixels > 5_500_000) return 'low';
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
    this.#lastAdjustmentAt = -Infinity;
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

  observeFps(fps: number): QualityLevel {
    const frameMs = fps > 0 ? 1000 / fps : Number.POSITIVE_INFINITY;
    return this.#observe({ fps, p95FrameMs: frameMs, longFrameRate: 0 });
  }

  observePerformance(sample: FrameHealth): QualityLevel {
    return this.#observe(sample);
  }

  #observe(sample: FrameHealth): QualityLevel {
    const { fps, p95FrameMs, longFrameRate } = sample;
    if (this.#mode !== 'auto' || !Number.isFinite(fps) || fps <= 0) return this.#level;

    const lowFpsThreshold = this.#level === 'high' ? 52 : 48;
    const p95Budget = this.#level === 'high' ? 23 : 27;
    const unhealthy = fps < lowFpsThreshold
      || (Number.isFinite(p95FrameMs) && p95FrameMs > p95Budget)
      || (Number.isFinite(longFrameRate) && longFrameRate > 0.06);

    if (unhealthy && this.#level !== 'low') {
      this.#lowFpsStrikes += 1;
      this.#highFpsStrikes = 0;
      // Degradation is intentionally not cooldown-gated. If an upgrade hurts,
      // Auto must recover within seconds instead of leaving the UI janky.
      if (this.#lowFpsStrikes >= 2) {
        this.#resetStrikes();
        return this.degrade();
      }
      return this.#level;
    }

    this.#lowFpsStrikes = 0;
    const healthyFpsThreshold = this.#level === 'low' ? 56 : 58;
    const healthy = fps >= healthyFpsThreshold
      && (!Number.isFinite(p95FrameMs) || p95FrameMs <= 20)
      && (!Number.isFinite(longFrameRate) || longFrameRate <= 0.025);
    const upgradeCooldownActive = this.#now() - this.#lastAdjustmentAt < 20_000;

    if (healthy && this.#level !== 'high' && !upgradeCooldownActive) {
      this.#highFpsStrikes += 1;
      if (this.#highFpsStrikes >= 12) {
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
