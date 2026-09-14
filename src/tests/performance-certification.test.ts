import { describe, expect, it } from 'vitest';
import { assessPerformance } from '../core/performance/certification';
import type { GlobeEngineMetrics } from '../core/engine/globe.types';

const healthy: GlobeEngineMetrics = {
  fps: 60, frameMs: 16.7, p95FrameMs: 18, longFrameRate: 0,
  width: 1920, height: 1080, pixelRatio: 1.5, quality: 'high',
  drawCalls: 80, triangles: 400_000, geometries: 40, textures: 20,
};

describe('runtime performance certification', () => {
  it('passes healthy balanced metrics', () => {
    expect(assessPerformance(healthy, 'balanced').health).toBe('good');
  });

  it('flags sustained poor frame pacing', () => {
    const result = assessPerformance({ ...healthy, fps: 20, frameMs: 50, p95FrameMs: 75, longFrameRate: 0.2 }, 'balanced');
    expect(result.health).toBe('poor');
    expect(result.failed.length).toBeGreaterThan(0);
  });
});
