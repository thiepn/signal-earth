import { describe, expect, it } from 'vitest';
import { classifyDevice } from '../core/device/capabilities';

describe('device classification', () => {
  it('classifies constrained hardware conservatively', () => {
    expect(classifyDevice({ coarsePointer: true, hoverCapable: false, maxTouchPoints: 5, hardwareConcurrency: 2, deviceMemoryGb: 2, devicePixelRatio: 2, viewportPixels: 3_000_000, webgl2: true })).toBe('constrained');
  });

  it('classifies capable desktop hardware', () => {
    expect(classifyDevice({ coarsePointer: false, hoverCapable: true, maxTouchPoints: 0, hardwareConcurrency: 12, deviceMemoryGb: 16, devicePixelRatio: 1.5, viewportPixels: 3_500_000, webgl2: true })).toBe('capable');
  });
});
