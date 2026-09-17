import { describe, expect, it } from 'vitest';
import {
  GEOGRAPHY_DETAIL_PATH,
  GEOGRAPHY_FALLBACK_PATH,
  GLOBE_CURVATURE_DEGREES,
  LAND_CURVATURE_DEGREES,
} from '../core/engine/geographyFidelity';

describe('geography fidelity invariants', () => {
  it('uses regional vector geography as the primary visible land source', () => {
    expect(GEOGRAPHY_DETAIL_PATH).toContain('natural-earth-50m');
    expect(GEOGRAPHY_FALLBACK_PATH).toContain('lowres');
  });

  it('keeps the base globe smooth while leaving polygon fill tessellation bounded', () => {
    expect(GLOBE_CURVATURE_DEGREES).toBeLessThanOrEqual(2);
    expect(LAND_CURVATURE_DEGREES).toBeLessThanOrEqual(5);
  });
});
