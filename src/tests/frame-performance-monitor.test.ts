import { describe, expect, it } from 'vitest';
import { FramePerformanceMonitor } from '../core/engine/FramePerformanceMonitor';

describe('FramePerformanceMonitor', () => {
  it('reports average and p95 frame pacing', () => {
    const monitor = new FramePerformanceMonitor(100, 120);
    let sample = null;
    let t = 0;
    for (let i = 0; i < 40; i += 1) {
      t += i === 25 ? 55 : 16.67;
      sample = monitor.push(t) ?? sample;
    }
    expect(sample).not.toBeNull();
    expect(sample!.fps).toBeGreaterThan(40);
    expect(sample!.p95FrameMs).toBeGreaterThanOrEqual(16);
    expect(sample!.longFrameRate).toBeGreaterThan(0);
  });
});
