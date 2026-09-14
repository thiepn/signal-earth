export interface PerformanceSample {
  fps: number;
  frameMs: number;
  p95FrameMs: number;
  longFrameRate: number;
}

export class FramePerformanceMonitor {
  #lastTimestamp: number | null = null;
  #samples: number[] = [];
  #lastReportAt = 0;

  constructor(
    private readonly reportEveryMs = 1_000,
    private readonly maxSamples = 120,
  ) {}

  push(timestamp: number): PerformanceSample | null {
    if (this.#lastTimestamp === null) {
      this.#lastTimestamp = timestamp;
      this.#lastReportAt = timestamp;
      return null;
    }

    const delta = timestamp - this.#lastTimestamp;
    this.#lastTimestamp = timestamp;

    // Ignore hidden-tab pauses, debugger stops and major scheduling stalls.
    if (delta > 0 && delta < 250) {
      this.#samples.push(delta);
      if (this.#samples.length > this.maxSamples) this.#samples.shift();
    }

    if (timestamp - this.#lastReportAt < this.reportEveryMs || this.#samples.length < 15) return null;
    this.#lastReportAt = timestamp;

    const average = this.#samples.reduce((sum, value) => sum + value, 0) / this.#samples.length;
    const sorted = [...this.#samples].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
    const p95FrameMs = sorted[p95Index] ?? average;
    const longFrames = this.#samples.filter((value) => value > 50).length;
    return {
      fps: average > 0 ? 1000 / average : 0,
      frameMs: average,
      p95FrameMs,
      longFrameRate: this.#samples.length ? longFrames / this.#samples.length : 0,
    };
  }

  reset(): void {
    this.#lastTimestamp = null;
    this.#samples = [];
    this.#lastReportAt = 0;
  }
}
