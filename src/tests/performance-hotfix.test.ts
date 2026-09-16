import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES, QualityManager } from '../core/engine/QualityManager';

describe('2.1.1 performance emergency', () => {
  it('keeps automatic quality within bounded GPU budgets', () => {
    expect(QUALITY_PROFILES.low.pixelRatio).toBeLessThanOrEqual(0.5);
    expect(QUALITY_PROFILES.medium.pixelRatio).toBeLessThanOrEqual(1.0);
    expect(QUALITY_PROFILES.high.pixelRatio).toBeLessThanOrEqual(1.4);
    expect(QUALITY_PROFILES.low.satelliteCap).toBeLessThanOrEqual(180);
    expect(QUALITY_PROFILES.medium.satelliteCap).toBeLessThanOrEqual(360);
    expect(QUALITY_PROFILES.high.satelliteCap).toBeLessThanOrEqual(560);
  });

  it('degrades when p95 and long-frame health are bad even at 60 average FPS', () => {
    const quality = new QualityManager('high');
    quality.observePerformance({ fps: 60, p95FrameMs: 40, longFrameRate: 0.12 });
    quality.observePerformance({ fps: 60, p95FrameMs: 38, longFrameRate: 0.10 });
    expect(quality.level).toBe('medium');
  });
});
