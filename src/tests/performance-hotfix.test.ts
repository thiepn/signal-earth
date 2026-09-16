import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES, QualityManager } from '../core/engine/QualityManager';

describe('2.1.1 performance emergency', () => {
  it('keeps automatic quality within bounded GPU budgets', () => {
    expect(QUALITY_PROFILES.low.pixelRatio).toBeLessThanOrEqual(1);
    expect(QUALITY_PROFILES.medium.pixelRatio).toBeLessThanOrEqual(1.25);
    expect(QUALITY_PROFILES.high.pixelRatio).toBeLessThanOrEqual(1.6);
    expect(QUALITY_PROFILES.low.satelliteCap).toBeLessThanOrEqual(220);
    expect(QUALITY_PROFILES.medium.satelliteCap).toBeLessThanOrEqual(400);
    expect(QUALITY_PROFILES.high.satelliteCap).toBeLessThanOrEqual(600);
  });

  it('degrades when p95 and long-frame health are bad even at 60 average FPS', () => {
    const quality = new QualityManager('high');
    quality.observePerformance({ fps: 60, p95FrameMs: 40, longFrameRate: 0.12 });
    quality.observePerformance({ fps: 60, p95FrameMs: 38, longFrameRate: 0.10 });
    expect(quality.level).toBe('medium');
  });
});
