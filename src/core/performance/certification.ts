import type { DeviceTier } from '../device/capabilities';

export interface CertificationMetrics {
  fps: number;
  frameMs: number;
  p95FrameMs: number;
  longFrameRate: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
}

export type RuntimeHealth = 'good' | 'watch' | 'poor' | 'unknown';

export interface PerformanceBudget {
  minFps: number;
  maxFrameMs: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextures: number;
  maxGeometries: number;
}

export interface PerformanceAssessment {
  health: RuntimeHealth;
  failed: string[];
  warned: string[];
}

export const PERFORMANCE_BUDGETS: Record<DeviceTier, PerformanceBudget> = {
  constrained: { minFps: 27, maxFrameMs: 37, maxDrawCalls: 145, maxTriangles: 850_000, maxTextures: 56, maxGeometries: 110 },
  balanced: { minFps: 45, maxFrameMs: 23, maxDrawCalls: 180, maxTriangles: 1_250_000, maxTextures: 72, maxGeometries: 145 },
  capable: { minFps: 55, maxFrameMs: 19, maxDrawCalls: 220, maxTriangles: 1_750_000, maxTextures: 96, maxGeometries: 180 },
};

export function assessPerformance(metrics: CertificationMetrics | null, tier: DeviceTier): PerformanceAssessment {
  if (!metrics) return { health: 'unknown', failed: [], warned: [] };
  const budget = PERFORMANCE_BUDGETS[tier];
  const failed: string[] = [];
  const warned: string[] = [];
  const checkMax = (label: string, actual: number, max: number) => {
    if (actual > max * 1.2) failed.push(`${label} ${Math.round(actual)} > ${Math.round(max)}`);
    else if (actual > max) warned.push(`${label} ${Math.round(actual)} > ${Math.round(max)}`);
  };

  if (metrics.fps < budget.minFps * 0.75) failed.push(`FPS ${metrics.fps.toFixed(0)} < ${budget.minFps}`);
  else if (metrics.fps < budget.minFps) warned.push(`FPS ${metrics.fps.toFixed(0)} < ${budget.minFps}`);
  checkMax('Frame', metrics.frameMs, budget.maxFrameMs);
  checkMax('P95 frame', metrics.p95FrameMs, budget.maxFrameMs * 1.7);
  if (metrics.longFrameRate > 0.12) failed.push(`Long frames ${(metrics.longFrameRate * 100).toFixed(0)}% > 12%`);
  else if (metrics.longFrameRate > 0.05) warned.push(`Long frames ${(metrics.longFrameRate * 100).toFixed(0)}% > 5%`);
  checkMax('Draw calls', metrics.drawCalls, budget.maxDrawCalls);
  checkMax('Triangles', metrics.triangles, budget.maxTriangles);
  checkMax('Textures', metrics.textures, budget.maxTextures);
  checkMax('Geometries', metrics.geometries, budget.maxGeometries);

  return { health: failed.length ? 'poor' : warned.length ? 'watch' : 'good', failed, warned };
}
