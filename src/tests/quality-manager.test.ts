import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES, QualityManager } from '../core/engine/QualityManager';

describe('QualityManager', () => {
  it('degrades one level at a time', () => {
    const quality = new QualityManager('high');
    expect(quality.degrade()).toBe('medium');
    expect(quality.degrade()).toBe('low');
    expect(quality.degrade()).toBe('low');
  });

  it('degrades within two sustained unhealthy reports', () => {
    const quality = new QualityManager('high');
    quality.observeFps(40);
    expect(quality.level).toBe('high');
    quality.observeFps(40);
    expect(quality.level).toBe('medium');
  });

  it('uses p95 and long-frame health instead of average FPS alone', () => {
    const quality = new QualityManager('high');
    quality.observePerformance({ fps: 60, p95FrameMs: 42, longFrameRate: 0.14 });
    quality.observePerformance({ fps: 60, p95FrameMs: 39, longFrameRate: 0.11 });
    expect(quality.level).toBe('medium');
  });

  it('recovers conservatively after sustained healthy rendering', () => {
    let now = 0;
    const quality = new QualityManager('low', () => now);
    for (let i = 0; i < 12; i += 1) quality.observePerformance({ fps: 60, p95FrameMs: 17, longFrameRate: 0 });
    expect(quality.level).toBe('medium');
    for (let i = 0; i < 20; i += 1) quality.observePerformance({ fps: 60, p95FrameMs: 17, longFrameRate: 0 });
    expect(quality.level).toBe('medium');
    now = 21_000;
    for (let i = 0; i < 12; i += 1) quality.observePerformance({ fps: 60, p95FrameMs: 17, longFrameRate: 0 });
    expect(quality.level).toBe('high');
  });

  it('does not auto-degrade a manually selected profile', () => {
    const quality = new QualityManager('high');
    quality.set('high', 'manual');
    for (let i = 0; i < 8; i += 1) quality.observePerformance({ fps: 10, p95FrameMs: 100, longFrameRate: 1 });
    expect(quality.level).toBe('high');
  });

  it('keeps 2.1.1 GPU budgets bounded', () => {
    expect(QUALITY_PROFILES.low.pixelRatio).toBeLessThanOrEqual(1);
    expect(QUALITY_PROFILES.medium.pixelRatio).toBeLessThanOrEqual(1.25);
    expect(QUALITY_PROFILES.high.pixelRatio).toBeLessThanOrEqual(1.6);
    expect(QUALITY_PROFILES.low.satelliteCap).toBeLessThanOrEqual(220);
    expect(QUALITY_PROFILES.medium.satelliteCap).toBeLessThanOrEqual(400);
    expect(QUALITY_PROFILES.high.satelliteCap).toBeLessThanOrEqual(600);
  });
});
