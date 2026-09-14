import { describe, expect, it } from 'vitest';
import { displayAltitudeKm, visualAltitudeFactor } from '../features/orbit/interaction';

describe('orbit visual scale', () => {
  it('preserves true altitude in true mode', () => {
    expect(displayAltitudeKm(420, 'true')).toBe(420);
  });

  it('exaggerates LEO more than MEO/GEO', () => {
    expect(visualAltitudeFactor(420)).toBe(4);
    expect(visualAltitudeFactor(20_200)).toBe(1.55);
    expect(visualAltitudeFactor(35_786)).toBe(1.18);
  });

  it('never changes invalid/zero altitude', () => {
    expect(visualAltitudeFactor(0)).toBe(1);
    expect(visualAltitudeFactor(Number.NaN)).toBe(1);
  });
});
